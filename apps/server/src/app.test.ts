import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "@models-roundtable/db";
import { buildServer } from "./app.js";
import { loadServerConfig, type ServerConfig } from "./config.js";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "models-roundtable-server-"));
  temporaryDirectories.push(directory);
  return directory;
}

function testConfig(dataDirectory: string): ServerConfig {
  return {
    host: "127.0.0.1",
    port: 4317,
    dataDirectory,
    allowedOrigins: ["http://127.0.0.1:4317"],
    webAssetsDirectory: join(dataDirectory, "missing-web-assets"),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("local server security shell", () => {
  it("rejects non-loopback host configuration", () => {
    expect(() =>
      loadServerConfig({
        MODELS_ROUNDTABLE_HOST: "0.0.0.0",
      }),
    ).toThrow("127.0.0.1");
  });

  it("reports validated health, rejects foreign origins, and establishes a local session", async () => {
    const dataDirectory = temporaryDirectory();
    const database = openDatabase({ dataDirectory });
    const server = await buildServer({
      config: testConfig(dataDirectory),
      database,
      codexProbe: async () => ({
        health: "ready",
        providerVersion: "0.145.0",
        capabilityHash: "test-capability-hash",
        safeMessage: "Codex CLI is ready for tests.",
      }),
    });

    const health = await server.inject({
      method: "GET",
      url: "/api/v1/health",
    });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      protocolVersion: 1,
      status: "ready",
      database: "ready",
    });

    const foreignRequest = await server.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { origin: "https://not-local.example" },
    });
    expect(foreignRequest.statusCode).toBe(403);

    const bootstrap = await server.inject({
      method: "POST",
      url: "/api/v1/bootstrap",
    });
    expect(bootstrap.statusCode).toBe(201);
    const cookieHeader = bootstrap.headers["set-cookie"];
    expect(cookieHeader).toBeTypeOf("string");

    const session = await server.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { cookie: cookieHeader as string },
    });
    expect(session.statusCode).toBe(200);

    const codexReadiness = await server.inject({
      method: "GET",
      url: "/api/v1/providers/codex",
      headers: { cookie: cookieHeader as string },
    });
    expect(codexReadiness.statusCode).toBe(200);
    expect(codexReadiness.json()).toMatchObject({
      health: "ready",
      providerVersion: "0.145.0",
      capabilityHash: "test-capability-hash",
      workspaceConfigured: false,
    });

    const createRoom = await server.inject({
      method: "POST",
      url: "/api/v1/rooms",
      headers: { cookie: cookieHeader as string },
      payload: { title: "Fake provider room" },
    });
    expect(createRoom.statusCode).toBe(201);
    const created = createRoom.json<{
      roomId: string;
      participants: readonly { kind: string }[];
    }>();
    const addCodexWithoutWorkspace = await server.inject({
      method: "POST",
      url: "/api/v1/rooms/" + created.roomId + "/participants/codex",
      headers: { cookie: cookieHeader as string },
      payload: {},
    });
    expect(addCodexWithoutWorkspace.statusCode).toBe(409);
    expect(
      created.participants.filter((item) => item.kind === "agent"),
    ).toHaveLength(2);

    const realtime = await server.injectWS("/api/v1/realtime", {
      headers: { cookie: cookieHeader as string },
    });
    const replayedTypes: string[] = [];
    const streamedTexts: string[] = [];
    let finishReplay: (() => void) | undefined;
    let finishLiveRuns: (() => void) | undefined;
    let liveRunCompletions = 0;
    const replayComplete = new Promise<void>((resolve) => {
      finishReplay = resolve;
    });
    const liveRunsComplete = new Promise<void>((resolve) => {
      finishLiveRuns = resolve;
    });
    realtime.on("message", (raw: { toString(): string }) => {
      const event = JSON.parse(raw.toString()) as {
        readonly type?: string;
        readonly payload?: {
          readonly replayComplete?: boolean;
          readonly text?: string;
        };
      };
      if (event.type !== undefined) {
        replayedTypes.push(event.type);
      }
      if (event.payload?.replayComplete === true) {
        finishReplay?.();
      }
      if (event.type === "run.completed") {
        liveRunCompletions += 1;
        if (liveRunCompletions === 2) {
          finishLiveRuns?.();
        }
      }
      if (
        event.type === "run.text_delta" &&
        event.payload?.text !== undefined
      ) {
        streamedTexts.push(event.payload.text);
      }
    });
    realtime.send(
      JSON.stringify({
        v: 1,
        type: "connection.resume",
        afterRoomSequences: { [created.roomId]: 0 },
      }),
    );
    await replayComplete;
    expect(replayedTypes).toContain("room.created");
    expect(
      replayedTypes.filter((type) => type === "participant.updated"),
    ).toHaveLength(2);
    expect(replayedTypes.at(-1)).toBe("connection.ready");

    const send = await server.inject({
      method: "POST",
      url: "/api/v1/rooms/" + created.roomId + "/messages",
      headers: { cookie: cookieHeader as string },
      payload: {
        body: "@all answer deterministically",
        idempotencyKey: "command-1",
      },
    });
    expect(send.statusCode).toBe(201);
    const acknowledgement = send.json<{ runIds: readonly string[] }>();
    expect(acknowledgement.runIds).toHaveLength(2);
    await liveRunsComplete;
    expect(replayedTypes.filter((type) => type === "run.queued")).toHaveLength(
      2,
    );
    expect(
      replayedTypes.filter((type) => type === "run.completed"),
    ).toHaveLength(2);
    expect(
      replayedTypes.filter((type) => type === "run.text_delta"),
    ).toHaveLength(2);
    expect(streamedTexts).toEqual([
      "Deterministic fake response.",
      "Deterministic fake response.",
    ]);

    const duplicate = await server.inject({
      method: "POST",
      url: "/api/v1/rooms/" + created.roomId + "/messages",
      headers: { cookie: cookieHeader as string },
      payload: {
        body: "@all answer deterministically",
        idempotencyKey: "command-1",
      },
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json()).toMatchObject({
      duplicate: true,
      runIds: acknowledgement.runIds,
    });

    const timeline = await server.inject({
      method: "GET",
      url: "/api/v1/rooms/" + created.roomId + "/messages",
      headers: { cookie: cookieHeader as string },
    });
    expect(timeline.statusCode).toBe(200);
    const messages = timeline.json<{
      messages: readonly { kind: string; body: string }[];
    }>().messages;
    expect(messages.filter((message) => message.kind === "human")).toHaveLength(
      1,
    );
    expect(messages.filter((message) => message.kind === "agent")).toHaveLength(
      2,
    );
    expect(
      messages
        .filter((message) => message.kind === "agent")
        .every((message) => message.body === "Deterministic fake response."),
    ).toBe(true);

    const contextResponse = await server.inject({
      method: "GET",
      url: "/api/v1/runs/" + acknowledgement.runIds[0] + "/context",
      headers: { cookie: cookieHeader as string },
    });
    expect(contextResponse.statusCode).toBe(200);
    expect(contextResponse.json()).toMatchObject({
      context: {
        state: "completed",
        manifest: {
          roomSequence: expect.any(Number),
          messageIds: [expect.any(String)],
          truncations: [],
        },
      },
    });

    const search = await server.inject({
      method: "GET",
      url:
        "/api/v1/rooms/" +
        created.roomId +
        "/search?q=" +
        encodeURIComponent("Deterministic fake response."),
      headers: { cookie: cookieHeader as string },
    });
    expect(search.statusCode).toBe(200);
    const searchResults = search.json<{
      results: readonly { snippet: string }[];
    }>().results;
    expect(searchResults).toHaveLength(2);
    expect(searchResults[0]?.snippet).toContain(
      "[Deterministic fake response]",
    );

    const exported = await server.inject({
      method: "POST",
      url: "/api/v1/rooms/" + created.roomId + "/export",
      headers: { cookie: cookieHeader as string },
      payload: { format: "markdown" },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.json()).toMatchObject({
      export: {
        version: 1,
        format: "markdown",
      },
    });
    expect(exported.body).toContain("@owner");
    expect(exported.body).toContain("@fakeA");

    const jsonExport = await server.inject({
      method: "POST",
      url: "/api/v1/rooms/" + created.roomId + "/export",
      headers: { cookie: cookieHeader as string },
      payload: { format: "json" },
    });
    expect(jsonExport.statusCode).toBe(200);
    const exportedMessages = jsonExport.json<{
      export: { messages: readonly { roomSequence: number }[] };
    }>().export.messages;
    expect(exportedMessages.map((message) => message.roomSequence)).toEqual(
      [...exportedMessages]
        .map((message) => message.roomSequence)
        .sort((left, right) => left - right),
    );

    const hanging = await server.inject({
      method: "POST",
      url: "/api/v1/rooms/" + created.roomId + "/messages",
      headers: { cookie: cookieHeader as string },
      payload: {
        body: "@fakeA [hang]",
        idempotencyKey: "command-cancel",
      },
    });
    expect(hanging.statusCode).toBe(201);
    const hangingRun = hanging.json<{ runIds: readonly string[] }>().runIds[0];
    expect(hangingRun).toBeDefined();
    if (hangingRun === undefined) {
      throw new Error("Expected a cancellable fake run.");
    }
    const reconnect = await server.injectWS("/api/v1/realtime", {
      headers: { cookie: cookieHeader as string },
    });
    const activeSnapshots: string[] = [];
    let finishReconnect: (() => void) | undefined;
    const reconnectComplete = new Promise<void>((resolve) => {
      finishReconnect = resolve;
    });
    reconnect.on("message", (raw: { toString(): string }) => {
      const event = JSON.parse(raw.toString()) as {
        readonly type?: string;
        readonly runId?: string;
        readonly payload?: { readonly replayComplete?: boolean };
      };
      if (event.type === "run.snapshot" && event.runId !== undefined) {
        activeSnapshots.push(event.runId);
      }
      if (event.payload?.replayComplete === true) {
        finishReconnect?.();
      }
    });
    reconnect.send(
      JSON.stringify({
        v: 1,
        type: "connection.resume",
        afterRoomSequences: { [created.roomId]: 0 },
      }),
    );
    await reconnectComplete;
    expect(activeSnapshots).toContain(hangingRun);
    reconnect.close();
    const cancelled = await server.inject({
      method: "POST",
      url: "/api/v1/runs/" + hangingRun + "/cancel",
      headers: { cookie: cookieHeader as string },
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({
      runId: hangingRun,
      state: "cancelled",
    });
    const afterCancel = await server.inject({
      method: "GET",
      url: "/api/v1/rooms/" + created.roomId + "/messages",
      headers: { cookie: cookieHeader as string },
    });
    expect(
      afterCancel.json<{
        messages: readonly { runId: string | null; incomplete: boolean }[];
      }>().messages,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runId: hangingRun,
          incomplete: true,
        }),
      ]),
    );

    const retried = await server.inject({
      method: "POST",
      url: "/api/v1/runs/" + hangingRun + "/retry",
      headers: { cookie: cookieHeader as string },
      payload: { idempotencyKey: "retry-cancelled-run" },
    });
    expect(retried.statusCode).toBe(201);
    const retriedRun = retried.json<{ runIds: readonly string[] }>().runIds[0];
    expect(retriedRun).toBeDefined();
    if (retriedRun === undefined) {
      throw new Error("Expected a retry run.");
    }
    const retryContext = await server.inject({
      method: "GET",
      url: "/api/v1/runs/" + retriedRun + "/context",
      headers: { cookie: cookieHeader as string },
    });
    expect(retryContext.json()).toMatchObject({
      context: { state: "completed", manifest: { mode: "resume" } },
    });
    const activeAfterRetry = await server.inject({
      method: "GET",
      url: "/api/v1/rooms/" + created.roomId + "/runs/active",
      headers: { cookie: cookieHeader as string },
    });
    expect(activeAfterRetry.json()).toMatchObject({ runs: [] });

    const afterCancellationRun = await server.inject({
      method: "POST",
      url: "/api/v1/rooms/" + created.roomId + "/messages",
      headers: { cookie: cookieHeader as string },
      payload: {
        body: "@fakeB next run still works",
        idempotencyKey: "command-after-cancel",
      },
    });
    expect(afterCancellationRun.statusCode).toBe(201);
    expect(
      afterCancellationRun.json<{ runIds: readonly string[] }>().runIds,
    ).toHaveLength(1);
    const finalTimeline = await server.inject({
      method: "GET",
      url: "/api/v1/rooms/" + created.roomId + "/messages",
      headers: { cookie: cookieHeader as string },
    });
    expect(
      finalTimeline.json<{
        messages: readonly { body: string; incomplete: boolean }[];
      }>().messages,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: "Deterministic fake response.",
          incomplete: false,
        }),
      ]),
    );

    const websocketCommandAccepted = new Promise<readonly string[]>(
      (resolve) => {
        const listener = (raw: { toString(): string }) => {
          const event = JSON.parse(raw.toString()) as {
            readonly type?: string;
            readonly payload?: {
              readonly commandId?: string;
              readonly runIds?: readonly string[];
            };
          };
          if (
            event.type === "command.accepted" &&
            event.payload?.commandId === "ws-message-1"
          ) {
            realtime.off("message", listener);
            resolve(event.payload.runIds ?? []);
          }
        };
        realtime.on("message", listener);
      },
    );
    const websocketRunCompleted = new Promise<void>((resolve) => {
      const listener = (raw: { toString(): string }) => {
        const event = JSON.parse(raw.toString()) as { readonly type?: string };
        if (event.type === "run.completed") {
          realtime.off("message", listener);
          resolve();
        }
      };
      realtime.on("message", listener);
    });
    realtime.send(
      JSON.stringify({
        v: 1,
        commandId: "ws-message-1",
        idempotencyKey: "ws-idempotency-1",
        type: "message.send",
        roomId: created.roomId,
        payload: { body: "@fakeA sent over websocket" },
      }),
    );
    await expect(websocketCommandAccepted).resolves.toHaveLength(1);
    await websocketRunCompleted;

    const malformed = await server.injectWS("/api/v1/realtime", {
      headers: { cookie: cookieHeader as string },
    });
    const malformedClosed = new Promise<number>((resolve) => {
      malformed.on("close", (code: number) => resolve(code));
    });
    malformed.send("{not-json");
    await expect(malformedClosed).resolves.toBe(1003);
    const healthAfterMalformedFrame = await server.inject({
      method: "GET",
      url: "/api/v1/health",
    });
    expect(healthAfterMalformedFrame.statusCode).toBe(200);

    realtime.close();
    await server.close();
    database.close();
  });
});
