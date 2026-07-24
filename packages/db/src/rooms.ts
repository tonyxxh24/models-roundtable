import { createHash, randomUUID } from "node:crypto";
import type { ProviderEvent } from "@models-roundtable/contracts";
import type Database from "better-sqlite3";

const providerPromptCharacterLimit = 16_000;
const truncationMarker = "\n\n[Truncated by local context policy]";

export interface RoomRepository {
  listRooms(): readonly RoomSummary[];
  createRoom(input: {
    readonly title: string;
    readonly ownerHandle: string;
    readonly ownerDisplayName: string;
  }): { readonly roomId: string; readonly ownerParticipantId: string };
  addAgent(input: {
    readonly roomId: string;
    readonly handle: string;
    readonly displayName: string;
  }): { readonly participantId: string };
  sendHumanMessage(input: {
    readonly roomId: string;
    readonly authorParticipantId: string;
    readonly body: string;
    readonly idempotencyKey: string;
    readonly mentions?: readonly PersistedMention[];
    readonly targetAgentParticipantIds?: readonly string[];
  }): {
    readonly messageId: string;
    readonly roomSequence: number;
    readonly runIds: readonly string[];
    readonly duplicate: boolean;
  };
  listQueuedRuns(): readonly QueuedRun[];
  listActiveRuns(roomId: string): readonly ActiveRun[];
  retryRun(input: {
    readonly runId: string;
    readonly idempotencyKey: string;
  }): {
    readonly messageId: string;
    readonly roomSequence: number;
    readonly runIds: readonly string[];
    readonly duplicate: boolean;
  };
  transitionRun(input: {
    readonly runId: string;
    readonly from: "queued" | "starting" | "running";
    readonly to: "starting" | "running" | "completed" | "failed" | "cancelled";
  }): boolean;
  recordProviderEvent(runId: string, event: ProviderEvent): void;
  listMessages(roomId: string): readonly RoomMessage[];
  listParticipants(roomId: string): readonly RoomParticipant[];
  recoverInterruptedRuns(): number;
  searchMessages(roomId: string, query: string): readonly MessageSearchResult[];
  exportRoom(roomId: string): RoomExport | undefined;
  replayRoomEvents(
    roomId: string,
    afterSequence: number,
  ): readonly ReplayedRoomEvent[];
  getRunContext(runId: string): RunContext | undefined;
}

export interface RoomSummary {
  readonly roomId: string;
  readonly title: string;
  readonly version: number;
}

export interface QueuedRun {
  readonly runId: string;
  readonly roomId: string;
  readonly targetParticipantId: string;
  readonly prompt: string;
  readonly inputRoomSequence: number;
  readonly contextSnapshotId: string;
  readonly providerSessionId?: string | undefined;
}

export interface ActiveRun {
  readonly runId: string;
  readonly roomId: string;
  readonly targetParticipantId: string;
  readonly targetHandle: string;
  readonly state: "queued" | "starting" | "running";
}

export interface RoomMessage {
  readonly messageId: string;
  readonly authorParticipantId: string;
  readonly kind: "human" | "agent" | "system";
  readonly body: string;
  readonly incomplete: boolean;
  readonly runId: string | null;
  readonly roomSequence: number;
}

export interface RoomParticipant {
  readonly id: string;
  readonly handle: string;
  readonly kind: "human" | "agent" | "system";
  readonly enabled: boolean;
  readonly displayName: string;
}

export interface MessageSearchResult {
  readonly messageId: string;
  readonly body: string;
  readonly snippet: string;
}

export interface RoomExport {
  readonly version: 1;
  readonly room: RoomSummary;
  readonly participants: readonly RoomParticipant[];
  readonly messages: readonly RoomMessage[];
}

export interface ReplayedRoomEvent {
  readonly eventId: string;
  readonly roomId: string;
  readonly roomSequence: number;
  readonly type: string;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ContextManifest {
  readonly roomSequence: number;
  readonly mode: "new" | "resume";
  readonly messageIds: readonly string[];
  readonly replyMessageIds: readonly string[];
  readonly instructionRefs: readonly string[];
  readonly skillRefs: readonly string[];
  readonly attachmentIds: readonly string[];
  readonly truncations: readonly string[];
  readonly estimatedCharacters: number;
}

export interface RunContext {
  readonly runId: string;
  readonly roomId: string;
  readonly targetParticipantId: string;
  readonly targetHandle: string;
  readonly state:
    "queued" | "starting" | "running" | "completed" | "failed" | "cancelled";
  readonly contextSnapshotId: string;
  readonly manifest: ContextManifest;
}

export interface PersistedMention {
  readonly sourceHandle: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly targetParticipantId?: string | undefined;
  readonly resolution: "resolved" | "unknown" | "disabled" | "group_expansion";
}

function now(): string {
  return new Date().toISOString();
}

function requestHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicProviderPrompt(body: string): {
  readonly text: string;
  readonly truncated: boolean;
} {
  if (body.length <= providerPromptCharacterLimit) {
    return { text: body, truncated: false };
  }
  return {
    text:
      body.slice(0, providerPromptCharacterLimit - truncationMarker.length) +
      truncationMarker,
    truncated: true,
  };
}

export function createRoomRepository(
  database: Database.Database,
): RoomRepository {
  return {
    listRooms() {
      return database
        .prepare(
          "SELECT id AS roomId, title, version FROM rooms WHERE archived_at IS NULL ORDER BY updated_at DESC, id",
        )
        .all() as readonly RoomSummary[];
    },

    createRoom(input) {
      const roomId = randomUUID();
      const ownerParticipantId = randomUUID();
      const createdAt = now();
      database.transaction(() => {
        database
          .prepare(
            "INSERT INTO rooms (id, title, next_sequence, version, created_at, updated_at) VALUES (?, ?, 2, 1, ?, ?)",
          )
          .run(roomId, input.title, createdAt, createdAt);
        database
          .prepare(
            "INSERT INTO participants (id, room_id, kind, handle, handle_normalized, display_name, created_at, updated_at) VALUES (?, ?, 'human', ?, ?, ?, ?, ?)",
          )
          .run(
            ownerParticipantId,
            roomId,
            input.ownerHandle,
            input.ownerHandle.normalize("NFC").toLocaleLowerCase("en-US"),
            input.ownerDisplayName,
            createdAt,
            createdAt,
          );
        database
          .prepare(
            "INSERT INTO room_events (id, room_id, room_sequence, event_type, entity_id, payload_json, occurred_at) VALUES (?, ?, 1, 'room.created', ?, ?, ?)",
          )
          .run(
            randomUUID(),
            roomId,
            roomId,
            JSON.stringify({ title: input.title }),
            createdAt,
          );
      })();
      return { roomId, ownerParticipantId };
    },

    addAgent(input) {
      const participantId = randomUUID();
      const agentProfileId = randomUUID();
      const createdAt = now();
      database.transaction(() => {
        const room = database
          .prepare("SELECT next_sequence FROM rooms WHERE id = ?")
          .get(input.roomId) as { readonly next_sequence: number } | undefined;
        if (room === undefined) {
          throw new Error("Room does not exist.");
        }
        database
          .prepare(
            "INSERT INTO agent_profiles (id, name, adapter_id, permission_profile, created_at, updated_at) VALUES (?, ?, 'fake', 'chat_only', ?, ?)",
          )
          .run(agentProfileId, input.displayName, createdAt, createdAt);
        database
          .prepare(
            "INSERT INTO participants (id, room_id, kind, handle, handle_normalized, display_name, agent_profile_id, created_at, updated_at) VALUES (?, ?, 'agent', ?, ?, ?, ?, ?, ?)",
          )
          .run(
            participantId,
            input.roomId,
            input.handle,
            input.handle.normalize("NFC").toLocaleLowerCase("en-US"),
            input.displayName,
            agentProfileId,
            createdAt,
            createdAt,
          );
        database
          .prepare(
            "INSERT INTO room_events (id, room_id, room_sequence, event_type, entity_id, payload_json, occurred_at) VALUES (?, ?, ?, 'participant.updated', ?, ?, ?)",
          )
          .run(
            randomUUID(),
            input.roomId,
            room.next_sequence,
            participantId,
            JSON.stringify({
              participantId,
              handle: input.handle,
              kind: "agent",
              enabled: true,
            }),
            createdAt,
          );
        database
          .prepare(
            "UPDATE rooms SET next_sequence = next_sequence + 1, version = version + 1, updated_at = ? WHERE id = ?",
          )
          .run(createdAt, input.roomId);
      })();
      return { participantId };
    },

    sendHumanMessage(input) {
      const scope = "room:" + input.roomId;
      const hash = requestHash(
        JSON.stringify({
          authorParticipantId: input.authorParticipantId,
          body: input.body,
          mentions: input.mentions ?? [],
          targetAgentParticipantIds: input.targetAgentParticipantIds ?? [],
        }),
      );
      return database.transaction(() => {
        const prior = database
          .prepare(
            "SELECT request_hash, response_json FROM idempotency_records WHERE scope = ? AND idempotency_key = ?",
          )
          .get(scope, input.idempotencyKey) as
          | { readonly request_hash: string; readonly response_json: string }
          | undefined;
        if (prior !== undefined) {
          if (prior.request_hash !== hash) {
            throw new Error(
              "Idempotency key was reused with a different request.",
            );
          }
          const response = JSON.parse(prior.response_json) as {
            messageId: string;
            roomSequence: number;
            runIds: string[];
          };
          return { ...response, duplicate: true };
        }
        const room = database
          .prepare("SELECT next_sequence FROM rooms WHERE id = ?")
          .get(input.roomId) as { readonly next_sequence: number } | undefined;
        if (room === undefined) {
          throw new Error("Room does not exist.");
        }
        const author = database
          .prepare("SELECT room_id, kind FROM participants WHERE id = ?")
          .get(input.authorParticipantId) as
          { readonly room_id: string; readonly kind: string } | undefined;
        if (
          author === undefined ||
          author.room_id !== input.roomId ||
          author.kind !== "human"
        ) {
          throw new Error(
            "Message author is not a human participant in this room.",
          );
        }
        const messageId = randomUUID();
        const occurredAt = now();
        const targetIds = [...new Set(input.targetAgentParticipantIds ?? [])];
        for (const targetId of targetIds) {
          const target = database
            .prepare(
              "SELECT id FROM participants WHERE id = ? AND room_id = ? AND kind = 'agent' AND enabled = 1",
            )
            .get(targetId, input.roomId);
          if (target === undefined) {
            throw new Error("Run target is not an enabled agent in this room.");
          }
        }
        database
          .prepare(
            "INSERT INTO messages (id, room_id, author_participant_id, kind, body_markdown, created_at, room_sequence) VALUES (?, ?, ?, 'human', ?, ?, ?)",
          )
          .run(
            messageId,
            input.roomId,
            input.authorParticipantId,
            input.body,
            occurredAt,
            room.next_sequence,
          );
        for (const mention of input.mentions ?? []) {
          database
            .prepare(
              "INSERT INTO mentions (id, message_id, target_participant_id, source_handle, start_offset, end_offset, resolution, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              randomUUID(),
              messageId,
              mention.targetParticipantId ?? null,
              mention.sourceHandle,
              mention.startOffset,
              mention.endOffset,
              mention.resolution,
              occurredAt,
            );
        }
        const contextSnapshotId = randomUUID();
        const providerPrompt = deterministicProviderPrompt(input.body);
        const resumableTargetCount = targetIds.reduce((count, targetId) => {
          const existingSession = database
            .prepare(
              "SELECT provider_sessions.id FROM provider_sessions JOIN participants ON participants.agent_profile_id = provider_sessions.agent_profile_id WHERE participants.id = ? AND provider_sessions.state = 'active' LIMIT 1",
            )
            .get(targetId);
          return count + (existingSession === undefined ? 0 : 1);
        }, 0);
        database
          .prepare(
            "INSERT INTO context_snapshots (id, room_id, room_sequence, manifest_json, created_at) VALUES (?, ?, ?, ?, ?)",
          )
          .run(
            contextSnapshotId,
            input.roomId,
            room.next_sequence,
            JSON.stringify({
              roomSequence: room.next_sequence,
              messageIds: [messageId],
              mode:
                targetIds.length > 0 &&
                resumableTargetCount === targetIds.length
                  ? "resume"
                  : "new",
              replyMessageIds: [],
              instructionRefs: [],
              skillRefs: [],
              attachmentIds: [],
              truncations: providerPrompt.truncated
                ? [
                    "message:" +
                      messageId +
                      ":excerpted_from_" +
                      input.body.length +
                      "_to_" +
                      providerPrompt.text.length +
                      "_characters",
                  ]
                : [],
              estimatedCharacters: providerPrompt.text.length,
            }),
            occurredAt,
          );
        const runIds = targetIds.map((targetId) => {
          const runId = randomUUID();
          database
            .prepare(
              "INSERT INTO runs (id, room_id, trigger_message_id, target_participant_id, context_snapshot_id, state, input_room_sequence, queued_at, updated_at) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?)",
            )
            .run(
              runId,
              input.roomId,
              messageId,
              targetId,
              contextSnapshotId,
              room.next_sequence,
              occurredAt,
              occurredAt,
            );
          return runId;
        });
        database
          .prepare(
            "INSERT INTO room_events (id, room_id, room_sequence, event_type, entity_id, payload_json, occurred_at) VALUES (?, ?, ?, 'message.created', ?, ?, ?)",
          )
          .run(
            randomUUID(),
            input.roomId,
            room.next_sequence,
            messageId,
            JSON.stringify({ messageId }),
            occurredAt,
          );
        runIds.forEach((runId, index) => {
          database
            .prepare(
              "INSERT INTO room_events (id, room_id, room_sequence, event_type, entity_id, payload_json, occurred_at) VALUES (?, ?, ?, 'run.queued', ?, ?, ?)",
            )
            .run(
              randomUUID(),
              input.roomId,
              room.next_sequence + index + 1,
              runId,
              JSON.stringify({
                runId,
                triggerMessageId: messageId,
                targetParticipantId: targetIds[index],
                inputRoomSequence: room.next_sequence,
              }),
              occurredAt,
            );
        });
        database
          .prepare(
            "UPDATE rooms SET next_sequence = next_sequence + ?, version = version + 1, updated_at = ? WHERE id = ?",
          )
          .run(1 + runIds.length, occurredAt, input.roomId);
        const response = {
          messageId,
          roomSequence: room.next_sequence,
          runIds,
        };
        database
          .prepare(
            "INSERT INTO idempotency_records (scope, idempotency_key, command_type, request_hash, response_json, created_at, expires_at) VALUES (?, ?, 'message.send', ?, ?, ?, ?)",
          )
          .run(
            scope,
            input.idempotencyKey,
            hash,
            JSON.stringify(response),
            occurredAt,
            occurredAt,
          );
        return { ...response, duplicate: false };
      })();
    },

    listQueuedRuns() {
      const rows = database
        .prepare(
          "SELECT runs.id AS runId, runs.room_id AS roomId, runs.target_participant_id AS targetParticipantId, messages.body_markdown AS prompt, runs.input_room_sequence AS inputRoomSequence, runs.context_snapshot_id AS contextSnapshotId, provider_sessions.external_session_id AS providerSessionId FROM runs JOIN messages ON messages.id = runs.trigger_message_id JOIN participants ON participants.id = runs.target_participant_id LEFT JOIN provider_sessions ON provider_sessions.agent_profile_id = participants.agent_profile_id AND provider_sessions.state = 'active' WHERE runs.state = 'queued' ORDER BY runs.queued_at, runs.id",
        )
        .all() as readonly (Omit<QueuedRun, "providerSessionId"> & {
        readonly providerSessionId: string | null;
      })[];
      return rows.map(({ providerSessionId, ...run }) => ({
        ...run,
        prompt: deterministicProviderPrompt(run.prompt).text,
        ...(providerSessionId === null ? {} : { providerSessionId }),
      }));
    },

    listActiveRuns(roomId) {
      return database
        .prepare(
          "SELECT runs.id AS runId, runs.room_id AS roomId, runs.target_participant_id AS targetParticipantId, participants.handle AS targetHandle, runs.state FROM runs JOIN participants ON participants.id = runs.target_participant_id WHERE runs.room_id = ? AND runs.state IN ('queued', 'starting', 'running') ORDER BY runs.queued_at, runs.id",
        )
        .all(roomId) as readonly ActiveRun[];
    },

    retryRun(input) {
      const original = database
        .prepare(
          "SELECT runs.room_id AS roomId, runs.target_participant_id AS targetParticipantId, messages.author_participant_id AS authorParticipantId, messages.body_markdown AS body FROM runs JOIN messages ON messages.id = runs.trigger_message_id WHERE runs.id = ?",
        )
        .get(input.runId) as
        | {
            readonly roomId: string;
            readonly targetParticipantId: string;
            readonly authorParticipantId: string;
            readonly body: string;
          }
        | undefined;
      if (original === undefined) {
        throw new Error("Run does not exist.");
      }
      const retried = this.sendHumanMessage({
        roomId: original.roomId,
        authorParticipantId: original.authorParticipantId,
        body: original.body,
        idempotencyKey: input.idempotencyKey,
        targetAgentParticipantIds: [original.targetParticipantId],
      });
      const retryRunId = retried.runIds[0];
      if (retryRunId !== undefined) {
        database
          .prepare("UPDATE runs SET retry_of_run_id = ? WHERE id = ?")
          .run(input.runId, retryRunId);
      }
      return retried;
    },

    transitionRun(input) {
      return database.transaction(() => {
        const occurredAt = now();
        const result = database
          .prepare(
            "UPDATE runs SET state = ?, updated_at = ? WHERE id = ? AND state = ?",
          )
          .run(input.to, occurredAt, input.runId, input.from);
        if (result.changes !== 1) {
          return false;
        }
        const eventType =
          input.to === "running"
            ? "run.started"
            : input.to === "completed"
              ? "run.completed"
              : input.to === "failed"
                ? "run.failed"
                : input.to === "cancelled"
                  ? "run.cancelled"
                  : undefined;
        if (eventType !== undefined) {
          const run = database
            .prepare(
              "SELECT runs.room_id AS roomId, rooms.next_sequence AS roomSequence FROM runs JOIN rooms ON rooms.id = runs.room_id WHERE runs.id = ?",
            )
            .get(input.runId) as {
            readonly roomId: string;
            readonly roomSequence: number;
          };
          database
            .prepare(
              "INSERT INTO room_events (id, room_id, room_sequence, event_type, entity_id, payload_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              randomUUID(),
              run.roomId,
              run.roomSequence,
              eventType,
              input.runId,
              JSON.stringify({ runId: input.runId, state: input.to }),
              occurredAt,
            );
          database
            .prepare(
              "UPDATE rooms SET next_sequence = next_sequence + 1, version = version + 1, updated_at = ? WHERE id = ?",
            )
            .run(occurredAt, run.roomId);
        }
        return true;
      })();
    },

    recordProviderEvent(runId, event) {
      database.transaction(() => {
        const run = database
          .prepare(
            "SELECT room_id, target_participant_id FROM runs WHERE id = ?",
          )
          .get(runId) as
          | { readonly room_id: string; readonly target_participant_id: string }
          | undefined;
        if (run === undefined) {
          throw new Error("Run does not exist.");
        }
        const sequenceRow = database
          .prepare(
            "SELECT COALESCE(MAX(run_sequence), 0) + 1 AS next_sequence FROM run_events WHERE run_id = ?",
          )
          .get(runId) as { readonly next_sequence: number };
        const occurredAt = now();
        database
          .prepare(
            "INSERT INTO run_events (id, run_id, run_sequence, event_type, payload_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(
            randomUUID(),
            runId,
            sequenceRow.next_sequence,
            event.type,
            JSON.stringify(event),
            occurredAt,
          );

        if (event.type === "session_started") {
          const profile = database
            .prepare(
              "SELECT agent_profile_id AS agentProfileId FROM participants WHERE id = ? AND agent_profile_id IS NOT NULL",
            )
            .get(run.target_participant_id) as
            { readonly agentProfileId: string } | undefined;
          if (profile === undefined) {
            throw new Error("Run target has no agent profile.");
          }
          const existing = database
            .prepare(
              "SELECT id FROM provider_sessions WHERE adapter_id = 'fake' AND external_session_id = ?",
            )
            .get(event.providerSessionId) as
            { readonly id: string } | undefined;
          const providerSessionId = existing?.id ?? randomUUID();
          if (existing === undefined) {
            database
              .prepare(
                "INSERT INTO provider_sessions (id, agent_profile_id, adapter_id, external_session_id, state, created_at, last_used_at) VALUES (?, ?, 'fake', ?, 'active', ?, ?)",
              )
              .run(
                providerSessionId,
                profile.agentProfileId,
                event.providerSessionId,
                occurredAt,
                occurredAt,
              );
          } else {
            database
              .prepare(
                "UPDATE provider_sessions SET state = 'active', last_used_at = ? WHERE id = ?",
              )
              .run(occurredAt, providerSessionId);
          }
          database
            .prepare("UPDATE runs SET provider_session_id = ? WHERE id = ?")
            .run(providerSessionId, runId);
        }

        if (event.type === "completed" || event.type === "failed") {
          const deltaRows = database
            .prepare(
              "SELECT payload_json FROM run_events WHERE run_id = ? AND event_type = 'text_delta' ORDER BY run_sequence",
            )
            .all(runId) as readonly { readonly payload_json: string }[];
          const partialText = deltaRows
            .map((row) => {
              const delta = JSON.parse(row.payload_json) as {
                readonly text: string;
              };
              return delta.text;
            })
            .join("");
          const body =
            event.type === "completed" && event.finalText !== undefined
              ? event.finalText
              : partialText;
          if (body.length > 0) {
            const roomRow = database
              .prepare("SELECT next_sequence FROM rooms WHERE id = ?")
              .get(run.room_id) as { readonly next_sequence: number };
            const messageId = randomUUID();
            database
              .prepare(
                "INSERT INTO messages (id, room_id, author_participant_id, kind, body_markdown, incomplete, created_at, run_id, room_sequence) VALUES (?, ?, ?, 'agent', ?, ?, ?, ?, ?)",
              )
              .run(
                messageId,
                run.room_id,
                run.target_participant_id,
                body,
                event.type === "failed" ? 1 : 0,
                occurredAt,
                runId,
                roomRow.next_sequence,
              );
            database
              .prepare(
                "INSERT INTO room_events (id, room_id, room_sequence, event_type, entity_id, payload_json, occurred_at) VALUES (?, ?, ?, 'message.created', ?, ?, ?)",
              )
              .run(
                randomUUID(),
                run.room_id,
                roomRow.next_sequence,
                messageId,
                JSON.stringify({ messageId, runId }),
                occurredAt,
              );
            database
              .prepare(
                "UPDATE rooms SET next_sequence = next_sequence + 1, version = version + 1, updated_at = ? WHERE id = ?",
              )
              .run(occurredAt, run.room_id);
          }
        }
      })();
    },

    listMessages(roomId) {
      const rows = database
        .prepare(
          "SELECT id AS messageId, author_participant_id AS authorParticipantId, kind, body_markdown AS body, incomplete, run_id AS runId, room_sequence AS roomSequence FROM messages WHERE room_id = ? ORDER BY room_sequence",
        )
        .all(roomId) as readonly (Omit<RoomMessage, "incomplete"> & {
        readonly incomplete: number;
      })[];
      return rows.map((row) => ({
        ...row,
        incomplete: row.incomplete === 1,
      }));
    },

    listParticipants(roomId) {
      const rows = database
        .prepare(
          "SELECT id, handle, kind, enabled, display_name AS displayName FROM participants WHERE room_id = ? ORDER BY created_at, id",
        )
        .all(roomId) as readonly (Omit<RoomParticipant, "enabled"> & {
        readonly enabled: number;
      })[];
      return rows.map((row) => ({
        ...row,
        enabled: row.enabled === 1,
      }));
    },

    recoverInterruptedRuns() {
      const interrupted = database
        .prepare(
          "SELECT id, state FROM runs WHERE state IN ('starting', 'running') ORDER BY queued_at, id",
        )
        .all() as readonly {
        readonly id: string;
        readonly state: "starting" | "running";
      }[];
      for (const run of interrupted) {
        this.recordProviderEvent(run.id, {
          type: "failed",
          code: "provider_process_error",
          safeMessage: "The local server stopped before this run completed.",
          retryable: true,
        });
        this.transitionRun({
          runId: run.id,
          from: run.state,
          to: "failed",
        });
      }
      return interrupted.length;
    },

    searchMessages(roomId, query) {
      const phrase = '"' + query.replaceAll('"', '""') + '"';
      return database
        .prepare(
          "SELECT message_id AS messageId, body_markdown AS body, snippet(message_search, 2, '[', ']', '...', 12) AS snippet FROM message_search WHERE room_id = ? AND body_markdown MATCH ? ORDER BY rowid",
        )
        .all(roomId, phrase) as readonly MessageSearchResult[];
    },

    exportRoom(roomId) {
      const room = this.listRooms().find(
        (candidate) => candidate.roomId === roomId,
      );
      if (room === undefined) {
        return undefined;
      }
      return {
        version: 1,
        room,
        participants: this.listParticipants(roomId),
        messages: this.listMessages(roomId),
      };
    },

    replayRoomEvents(roomId, afterSequence) {
      const rows = database
        .prepare(
          "SELECT id AS eventId, room_id AS roomId, room_sequence AS roomSequence, event_type AS type, occurred_at AS occurredAt, payload_json AS payloadJson FROM room_events WHERE room_id = ? AND room_sequence > ? ORDER BY room_sequence LIMIT 500",
        )
        .all(roomId, afterSequence) as readonly {
        readonly eventId: string;
        readonly roomId: string;
        readonly roomSequence: number;
        readonly type: string;
        readonly occurredAt: string;
        readonly payloadJson: string;
      }[];
      return rows.map(({ payloadJson, ...row }) => ({
        ...row,
        payload: JSON.parse(payloadJson) as Readonly<Record<string, unknown>>,
      }));
    },

    getRunContext(runId) {
      const row = database
        .prepare(
          "SELECT runs.id AS runId, runs.room_id AS roomId, runs.target_participant_id AS targetParticipantId, participants.handle AS targetHandle, runs.state, runs.context_snapshot_id AS contextSnapshotId, context_snapshots.manifest_json AS manifestJson FROM runs JOIN participants ON participants.id = runs.target_participant_id JOIN context_snapshots ON context_snapshots.id = runs.context_snapshot_id WHERE runs.id = ?",
        )
        .get(runId) as
        | {
            readonly runId: string;
            readonly roomId: string;
            readonly targetParticipantId: string;
            readonly targetHandle: string;
            readonly state: RunContext["state"];
            readonly contextSnapshotId: string;
            readonly manifestJson: string;
          }
        | undefined;
      if (row === undefined) {
        return undefined;
      }
      const { manifestJson, ...context } = row;
      return {
        ...context,
        manifest: JSON.parse(manifestJson) as ContextManifest,
      };
    },
  };
}
