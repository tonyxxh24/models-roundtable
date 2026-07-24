import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "./index.js";
import { applyMigrations, migrations, type Migration } from "./migrations.js";

const directories: string[] = [];

function createTemporaryDataDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "models-roundtable-db-"));
  directories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("SQLite database initialization", () => {
  it("migrates the expected schema in a temporary database and safely reopens it", () => {
    const dataDirectory = createTemporaryDataDirectory();
    const first = openDatabase({ dataDirectory });

    expect(first.health()).toBe("ready");
    expect(first.appliedMigrationVersions()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(first.path).toContain(dataDirectory);
    first.close();

    const inspector = new Database(join(dataDirectory, "roundtable.sqlite"), {
      readonly: true,
    });
    const tableNames = (
      inspector
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        )
        .all() as readonly { readonly name: string }[]
    ).map((row) => row.name);
    inspector.close();
    expect(tableNames).toEqual(
      expect.arrayContaining([
        "app_metadata",
        "schema_migrations",
        "rooms",
        "participants",
        "messages",
        "room_events",
        "idempotency_records",
        "context_snapshots",
        "runs",
        "mentions",
        "run_events",
        "agent_profiles",
        "provider_sessions",
        "workspaces",
      ]),
    );

    const second = openDatabase({ dataDirectory });
    expect(second.appliedMigrationVersions()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    second.close();
  });

  it("creates a room and persists an idempotent human message with ordered events", () => {
    const dataDirectory = createTemporaryDataDirectory();
    const database = openDatabase({ dataDirectory });
    const room = database.rooms.createRoom({
      title: "Local test room",
      ownerHandle: "owner",
      ownerDisplayName: "Owner",
    });
    const fakeA = database.rooms.addAgent({
      roomId: room.roomId,
      handle: "fakeA",
      displayName: "Fake A",
    });
    const fakeB = database.rooms.addAgent({
      roomId: room.roomId,
      handle: "fakeB",
      displayName: "Fake B",
    });

    const first = database.rooms.sendHumanMessage({
      roomId: room.roomId,
      authorParticipantId: room.ownerParticipantId,
      body: "Hello @fake",
      idempotencyKey: "message-1",
      mentions: [
        {
          sourceHandle: "all",
          startOffset: 6,
          endOffset: 10,
          resolution: "group_expansion",
        },
      ],
      targetAgentParticipantIds: [fakeA.participantId, fakeB.participantId],
    });
    const duplicate = database.rooms.sendHumanMessage({
      roomId: room.roomId,
      authorParticipantId: room.ownerParticipantId,
      body: "Hello @fake",
      idempotencyKey: "message-1",
      mentions: [
        {
          sourceHandle: "all",
          startOffset: 6,
          endOffset: 10,
          resolution: "group_expansion",
        },
      ],
      targetAgentParticipantIds: [fakeA.participantId, fakeB.participantId],
    });

    expect(first.duplicate).toBe(false);
    expect(first.roomSequence).toBe(4);
    expect(first.runIds).toHaveLength(2);
    const queuedRuns = database.rooms.listQueuedRuns();
    expect(queuedRuns.every((run) => run.adapterId === "fake")).toBe(true);
    expect(queuedRuns.every((run) => run.permission === "chat_only")).toBe(
      true,
    );
    expect(queuedRuns.map((run) => run.runId).sort()).toEqual(
      [...first.runIds].sort(),
    );
    expect(new Set(queuedRuns.map((run) => run.inputRoomSequence))).toEqual(
      new Set([4]),
    );
    expect(new Set(queuedRuns.map((run) => run.contextSnapshotId)).size).toBe(
      1,
    );
    expect(
      database.rooms.getRunContext(first.runIds[0] as string),
    ).toMatchObject({
      targetHandle: "fakeA",
      state: "queued",
      manifest: {
        roomSequence: 4,
        mode: "new",
        messageIds: [first.messageId],
        truncations: [],
      },
    });
    expect(
      database.rooms
        .replayRoomEvents(room.roomId, 0)
        .map((event) => event.type),
    ).toEqual([
      "room.created",
      "participant.updated",
      "participant.updated",
      "message.created",
      "run.queued",
      "run.queued",
    ]);
    const run = queuedRuns[0];
    expect(run).toBeDefined();
    if (run === undefined) {
      throw new Error("Expected a queued fake run.");
    }
    expect(
      database.rooms.transitionRun({
        runId: run.runId,
        from: "queued",
        to: "starting",
      }),
    ).toBe(true);
    expect(
      database.rooms.transitionRun({
        runId: run.runId,
        from: "starting",
        to: "running",
      }),
    ).toBe(true);
    database.rooms.recordProviderEvent(run.runId, {
      type: "session_started",
      providerSessionId: "fake-session:" + run.targetParticipantId,
    });
    database.rooms.recordProviderEvent(run.runId, {
      type: "text_delta",
      text: "Fake response",
    });
    database.rooms.recordProviderEvent(run.runId, {
      type: "completed",
      finalText: "Fake response",
    });
    expect(
      database.rooms.transitionRun({
        runId: run.runId,
        from: "running",
        to: "completed",
      }),
    ).toBe(true);
    expect(database.rooms.listMessages(room.roomId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "agent",
          body: "Fake response",
          incomplete: false,
          runId: run.runId,
        }),
      ]),
    );
    expect(database.rooms.listQueuedRuns()).toHaveLength(1);
    const resumed = database.rooms.sendHumanMessage({
      roomId: room.roomId,
      authorParticipantId: room.ownerParticipantId,
      body: "Resume the same fake session",
      idempotencyKey: "message-resume",
      targetAgentParticipantIds: [run.targetParticipantId],
    });
    const resumedRun = database.rooms
      .listQueuedRuns()
      .find((candidate) => candidate.runId === resumed.runIds[0]);
    expect(resumedRun?.providerSessionId).toBe(
      "fake-session:" + run.targetParticipantId,
    );
    expect(
      database.rooms.getRunContext(resumed.runIds[0] as string)?.manifest.mode,
    ).toBe("resume");
    expect(duplicate).toEqual({ ...first, duplicate: true });
    expect(() =>
      database.rooms.sendHumanMessage({
        roomId: room.roomId,
        authorParticipantId: room.ownerParticipantId,
        body: "Different body",
        idempotencyKey: "message-1",
      }),
    ).toThrow("Idempotency key");
    database.close();
  });

  it("recovers an interrupted run and preserves its partial output after reopen", () => {
    const dataDirectory = createTemporaryDataDirectory();
    const first = openDatabase({ dataDirectory });
    const room = first.rooms.createRoom({
      title: "Recovery room",
      ownerHandle: "owner",
      ownerDisplayName: "Owner",
    });
    const agent = first.rooms.addAgent({
      roomId: room.roomId,
      handle: "fake",
      displayName: "Fake",
    });
    first.rooms.sendHumanMessage({
      roomId: room.roomId,
      authorParticipantId: room.ownerParticipantId,
      body: "@fake begin",
      idempotencyKey: "recovery-message",
      targetAgentParticipantIds: [agent.participantId],
    });
    const run = first.rooms.listQueuedRuns()[0];
    if (run === undefined) {
      throw new Error("Expected queued recovery run.");
    }
    first.rooms.transitionRun({
      runId: run.runId,
      from: "queued",
      to: "starting",
    });
    first.rooms.transitionRun({
      runId: run.runId,
      from: "starting",
      to: "running",
    });
    first.rooms.recordProviderEvent(run.runId, {
      type: "text_delta",
      text: "Partial before restart",
    });
    first.close();

    const reopened = openDatabase({ dataDirectory });
    expect(reopened.rooms.listMessages(room.roomId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "agent",
          body: "Partial before restart",
          incomplete: true,
          runId: run.runId,
        }),
      ]),
    );
    reopened.close();
  });

  it("applies a deterministic character budget and records the truncation", () => {
    const dataDirectory = createTemporaryDataDirectory();
    const database = openDatabase({ dataDirectory });
    const room = database.rooms.createRoom({
      title: "Context budget room",
      ownerHandle: "owner",
      ownerDisplayName: "Owner",
    });
    const agent = database.rooms.addAgent({
      roomId: room.roomId,
      handle: "fake",
      displayName: "Fake",
    });
    const sent = database.rooms.sendHumanMessage({
      roomId: room.roomId,
      authorParticipantId: room.ownerParticipantId,
      body: "x".repeat(20_000),
      idempotencyKey: "oversized-context",
      targetAgentParticipantIds: [agent.participantId],
    });
    const queued = database.rooms.listQueuedRuns()[0];
    expect(queued?.prompt).toHaveLength(16_000);
    expect(queued?.prompt).toMatch(/\[Truncated by local context policy\]$/);
    expect(
      database.rooms.getRunContext(sent.runIds[0] as string)?.manifest,
    ).toMatchObject({
      estimatedCharacters: 16_000,
      truncations: [expect.stringContaining("excerpted_from_20000_to_16000")],
    });
    database.close();
  });

  it("rolls back a failed numbered migration in the temporary database", () => {
    const dataDirectory = createTemporaryDataDirectory();
    const handle = openDatabase({ dataDirectory });
    handle.close();

    const database = new Database(join(dataDirectory, "roundtable.sqlite"));
    const brokenMigration: Migration = {
      version: 8,
      name: "intentional-failure",
      checksum: "test-only",
      sql: [
        "CREATE TABLE rollback_probe (id INTEGER PRIMARY KEY) STRICT;",
        "THIS IS NOT VALID SQL;",
      ].join("\\n"),
    };

    expect(() =>
      applyMigrations(database, [...migrations, brokenMigration]),
    ).toThrow();
    const rollbackProbe = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rollback_probe'",
      )
      .get();
    expect(rollbackProbe).toBeUndefined();
    database.close();
  });
});
