import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import {
  PROTOCOL_VERSION,
  createRoomRequestSchema,
  healthResponseSchema,
  idSchema,
  sendMessageRequestSchema,
  type HealthResponse,
  type ProviderAdapter,
  type ProviderEvent,
} from "@models-roundtable/contracts";
import {
  createRunSupervisor,
  parseMentions,
  resolvedAgentTargetIds,
  resolveMentions,
} from "@models-roundtable/core";
import type { DatabaseHandle } from "@models-roundtable/db";
import { createFakeAdapter } from "@models-roundtable/provider-fake";
import {
  createCodexAdapter,
  probeCodexExecutable,
} from "@models-roundtable/provider-codex";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import type { ServerConfig } from "./config.js";

const sessionCookieName = "roundtable_session";
const maximumRealtimeBufferedBytes = 1024 * 1024;

interface RealtimeSocket {
  readonly readyState: number;
  readonly bufferedAmount: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface RealtimeConnection {
  readonly socket: RealtimeSocket;
  readonly afterRoomSequences: Map<string, number>;
  replayComplete: boolean;
}

interface PendingTextDelta {
  readonly roomId: string;
  text: string;
  readonly timer: ReturnType<typeof setTimeout>;
}

export interface ServerDependencies {
  readonly config: ServerConfig;
  readonly database: DatabaseHandle;
  readonly codexProbe?: typeof probeCodexExecutable;
  /** Test/embedding seam; production uses the official local CLI adapter. */
  readonly codexAdapter?: ProviderAdapter;
}

function requestId(request: FastifyRequest): string {
  const value = request.headers["x-request-id"];
  return typeof value === "string" && value.length > 0 && value.length <= 128
    ? value
    : randomUUID();
}

function sendSafeError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  requestIdValue: string,
): FastifyReply {
  return reply.code(statusCode).send({
    code,
    message,
    retryable: false,
    requestId: requestIdValue,
  });
}

function isAllowedOrigin(origin: string, config: ServerConfig): boolean {
  return config.allowedOrigins.includes(origin);
}

function health(database: DatabaseHandle): HealthResponse {
  return healthResponseSchema.parse({
    protocolVersion: PROTOCOL_VERSION,
    status: "ready",
    database: database.health(),
    checkedAt: new Date().toISOString(),
  });
}

export async function buildServer(
  dependencies: ServerDependencies,
): Promise<FastifyInstance> {
  const application = Fastify({
    bodyLimit: 64 * 1024,
    logger: false,
  });
  const sessions = new Set<string>();
  const realtimeConnections = new Set<RealtimeConnection>();
  const transientRunSequences = new Map<string, number>();
  const pendingTextDeltas = new Map<string, PendingTextDelta>();
  const fakeAdapter = createFakeAdapter({
    sessionId: "fake-local-session",
    events: [
      { type: "text_delta", text: "Deterministic fake " },
      { type: "text_delta", text: "response." },
      { type: "completed", finalText: "Deterministic fake response." },
    ],
    hangWhenPromptIncludes: "[hang]",
  });
  const adapters = new Map<string, ProviderAdapter>([
    [fakeAdapter.id, fakeAdapter],
  ]);
  if (dependencies.config.codexWorkspace !== undefined) {
    const codexAdapter =
      dependencies.codexAdapter ??
      createCodexAdapter({
        workingDirectory: dependencies.config.codexWorkspace,
      });
    adapters.set(codexAdapter.id, codexAdapter);
  }
  const supervisor = createRunSupervisor(
    {
      listQueuedRuns: () => dependencies.database.rooms.listQueuedRuns(),
      transitionRun: (input) =>
        dependencies.database.rooms.transitionRun(input),
      recordProviderEvent: (runId, event) => {
        if (event.type === "completed" || event.type === "failed") {
          flushPendingTextDelta(runId);
        }
        dependencies.database.rooms.recordProviderEvent(runId, event);
        publishTransientProviderEvent(runId, event);
      },
    },
    adapters,
  );

  function sendRealtime<T extends object>(
    connection: RealtimeConnection,
    event: T,
  ): boolean {
    if (connection.socket.readyState !== 1) {
      return false;
    }
    if (connection.socket.bufferedAmount > maximumRealtimeBufferedBytes) {
      connection.socket.close(1013, "Realtime client is too slow; reconnect");
      return false;
    }
    connection.socket.send(JSON.stringify({ v: PROTOCOL_VERSION, ...event }));
    return true;
  }

  function replayToConnection(
    connection: RealtimeConnection,
    roomId: string,
    afterSequence: number,
  ): void {
    let cursor = afterSequence;
    let replayed = 0;
    while (replayed < 5_000) {
      const events = dependencies.database.rooms.replayRoomEvents(
        roomId,
        cursor,
      );
      for (const event of events) {
        if (!sendRealtime(connection, event)) {
          return;
        }
        cursor = event.roomSequence;
        replayed += 1;
      }
      if (events.length < 500) {
        connection.afterRoomSequences.set(roomId, cursor);
        return;
      }
    }
    sendRealtime(connection, {
      eventId: randomUUID(),
      type: "snapshot_required",
      occurredAt: new Date().toISOString(),
      roomId,
      payload: { reason: "replay_limit_exceeded" },
    });
  }

  function publishRoomEvents(roomId: string): void {
    for (const connection of realtimeConnections) {
      const cursor = connection.afterRoomSequences.get(roomId);
      if (connection.replayComplete && cursor !== undefined) {
        replayToConnection(connection, roomId, cursor);
      }
    }
  }

  function publishTransientProviderEvent(
    runId: string,
    providerEvent: ProviderEvent,
  ): void {
    const context = dependencies.database.rooms.getRunContext(runId);
    if (context === undefined) {
      return;
    }
    if (providerEvent.type === "text_delta") {
      const pending = pendingTextDeltas.get(runId);
      if (pending !== undefined) {
        pending.text += providerEvent.text;
      } else {
        pendingTextDeltas.set(runId, {
          roomId: context.roomId,
          text: providerEvent.text,
          timer: setTimeout(() => flushPendingTextDelta(runId), 16),
        });
      }
      return;
    }
    const normalized =
      providerEvent.type === "tool_started"
        ? {
            type: "run.tool_started",
            payload: {
              toolCallId: providerEvent.toolCallId,
              toolName: providerEvent.toolName,
            },
          }
        : providerEvent.type === "warning"
          ? {
              type: "run.warning",
              payload: {
                code: providerEvent.code,
                safeMessage: providerEvent.safeMessage,
              },
            }
          : providerEvent.type === "session_started"
            ? {
                type: "run.session_bound",
                payload: { session: "bound" },
              }
            : undefined;
    if (normalized === undefined) {
      return;
    }
    const runSequence = (transientRunSequences.get(runId) ?? 0) + 1;
    transientRunSequences.set(runId, runSequence);
    for (const connection of realtimeConnections) {
      if (
        connection.replayComplete &&
        connection.afterRoomSequences.has(context.roomId)
      ) {
        sendRealtime(connection, {
          eventId: randomUUID(),
          type: normalized.type,
          occurredAt: new Date().toISOString(),
          roomId: context.roomId,
          runId,
          runSequence,
          payload: normalized.payload,
        });
      }
    }
  }

  function flushPendingTextDelta(runId: string): void {
    const pending = pendingTextDeltas.get(runId);
    if (pending === undefined) {
      return;
    }
    pendingTextDeltas.delete(runId);
    clearTimeout(pending.timer);
    const runSequence = (transientRunSequences.get(runId) ?? 0) + 1;
    transientRunSequences.set(runId, runSequence);
    for (const connection of realtimeConnections) {
      if (
        connection.replayComplete &&
        connection.afterRoomSequences.has(pending.roomId)
      ) {
        sendRealtime(connection, {
          eventId: randomUUID(),
          type: "run.text_delta",
          occurredAt: new Date().toISOString(),
          roomId: pending.roomId,
          runId,
          runSequence,
          payload: { text: pending.text },
        });
      }
    }
  }

  await application.register(cookie);
  await application.register(websocket);

  application.addHook("onRequest", async (request, reply) => {
    const localRequestId = requestId(request);
    request.headers["x-request-id"] = localRequestId;
    reply.header("x-request-id", localRequestId);
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("cache-control", "no-store");

    const origin = request.headers.origin;
    if (
      typeof origin === "string" &&
      !isAllowedOrigin(origin, dependencies.config)
    ) {
      return sendSafeError(
        reply,
        403,
        "ORIGIN_NOT_ALLOWED",
        "Origin is not allowed.",
        localRequestId,
      );
    }
  });

  application.options("*", async (request, reply) => {
    const origin = request.headers.origin;
    if (
      typeof origin !== "string" ||
      !isAllowedOrigin(origin, dependencies.config)
    ) {
      return sendSafeError(
        reply,
        403,
        "ORIGIN_NOT_ALLOWED",
        "Origin is not allowed.",
        requestId(request),
      );
    }
    reply
      .header("access-control-allow-origin", origin)
      .header("access-control-allow-credentials", "true")
      .header("access-control-allow-methods", "GET,POST,OPTIONS")
      .header("access-control-allow-headers", "content-type,x-request-id");
    return reply.code(204).send();
  });

  application.addHook("onSend", async (request, reply, payload) => {
    const origin = request.headers.origin;
    if (
      typeof origin === "string" &&
      isAllowedOrigin(origin, dependencies.config)
    ) {
      reply.header("access-control-allow-origin", origin);
      reply.header("access-control-allow-credentials", "true");
      reply.header("vary", "origin");
    }
    return payload;
  });

  application.setErrorHandler((error, request, reply) => {
    void error;
    return sendSafeError(
      reply,
      500,
      "INTERNAL_ERROR",
      "An unexpected local server error occurred.",
      requestId(request),
    );
  });

  application.get("/api/v1/health", async () => health(dependencies.database));

  application.post("/api/v1/bootstrap", async (_request, reply) => {
    const newSession = randomUUID();
    sessions.add(newSession);
    reply.setCookie(sessionCookieName, newSession, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      secure: false,
    });
    return reply.code(201).send({
      protocolVersion: PROTOCOL_VERSION,
      session: "created",
    });
  });

  application.get("/api/v1/session", async (request, reply) => {
    const session = request.cookies[sessionCookieName];
    if (typeof session !== "string" || !sessions.has(session)) {
      return sendSafeError(
        reply,
        401,
        "SESSION_REQUIRED",
        "A local bootstrap session is required.",
        requestId(request),
      );
    }
    return {
      protocolVersion: PROTOCOL_VERSION,
      session: "active",
    };
  });

  application.get("/api/v1/providers/codex", async (request, reply) => {
    if (!hasSession(request)) {
      return sendSafeError(
        reply,
        401,
        "SESSION_REQUIRED",
        "A local bootstrap session is required.",
        requestId(request),
      );
    }
    return {
      ...(await (dependencies.codexProbe ?? probeCodexExecutable)()),
      workspaceConfigured: dependencies.config.codexWorkspace !== undefined,
    };
  });

  application.post(
    "/api/v1/rooms/:roomId/participants/codex",
    async (request, reply) => {
      if (!hasSession(request)) {
        return sendSafeError(
          reply,
          401,
          "SESSION_REQUIRED",
          "A local bootstrap session is required.",
          requestId(request),
        );
      }
      if (!adapters.has("codex")) {
        return sendSafeError(
          reply,
          409,
          "CODEX_WORKSPACE_REQUIRED",
          "Configure an absolute Codex workspace before adding @codex.",
          requestId(request),
        );
      }
      const { roomId } = request.params as { readonly roomId: string };
      const existing = dependencies.database.rooms
        .listParticipants(roomId)
        .find(
          (participant) =>
            participant.handle.toLocaleLowerCase("en-US") === "codex",
        );
      if (existing !== undefined) return reply.code(200).send(existing);
      const created = dependencies.database.rooms.addAgent({
        roomId,
        handle: "codex",
        displayName: "Codex",
        adapterId: "codex",
        permission: "workspace_read",
      });
      publishRoomEvents(roomId);
      return reply.code(201).send(created);
    },
  );

  function hasSession(request: FastifyRequest): boolean {
    const session = request.cookies[sessionCookieName];
    return typeof session === "string" && sessions.has(session);
  }

  function enqueueHumanMessage(
    roomId: string,
    body: string,
    idempotencyKey: string,
  ) {
    const participants = dependencies.database.rooms.listParticipants(roomId);
    const owner = participants.find(
      (participant) => participant.kind === "human",
    );
    if (owner === undefined) {
      return undefined;
    }
    const parsedMentions = parseMentions(body);
    const resolutions = resolveMentions(parsedMentions, participants);
    const targetIds = resolvedAgentTargetIds(resolutions, participants);
    return dependencies.database.rooms.sendHumanMessage({
      roomId,
      authorParticipantId: owner.id,
      body,
      idempotencyKey,
      mentions: resolutions.map((resolution) => ({
        sourceHandle: resolution.mention.sourceHandle,
        startOffset: resolution.mention.startOffset,
        endOffset: resolution.mention.endOffset,
        targetParticipantId:
          resolution.kind === "participant"
            ? resolution.participantId
            : undefined,
        resolution:
          resolution.kind === "group"
            ? "group_expansion"
            : resolution.kind === "participant"
              ? "resolved"
              : resolution.kind,
      })),
      targetAgentParticipantIds: targetIds,
    });
  }

  function startRunDrain(roomId: string): Promise<void> {
    publishRoomEvents(roomId);
    return supervisor.drainQueued().then(() => publishRoomEvents(roomId));
  }

  application.get(
    "/api/v1/realtime",
    { websocket: true },
    (socket, request) => {
      if (!hasSession(request)) {
        socket.close(1008, "Local session required");
        return;
      }
      const connection: RealtimeConnection = {
        socket,
        afterRoomSequences: new Map(),
        replayComplete: false,
      };
      realtimeConnections.add(connection);
      sendRealtime(connection, {
        eventId: randomUUID(),
        type: "connection.ready",
        occurredAt: new Date().toISOString(),
        payload: {
          minimumProtocolVersion: PROTOCOL_VERSION,
          maximumProtocolVersion: PROTOCOL_VERSION,
        },
      });
      socket.on("close", () => {
        realtimeConnections.delete(connection);
      });
      socket.on("message", async (data: { toString(): string }) => {
        try {
          const command = JSON.parse(data.toString()) as {
            readonly v?: unknown;
            readonly type?: unknown;
            readonly afterRoomSequences?: unknown;
            readonly commandId?: unknown;
            readonly idempotencyKey?: unknown;
            readonly roomId?: unknown;
            readonly payload?: unknown;
          };
          if (command.v !== PROTOCOL_VERSION) {
            socket.close(1003, "Unsupported realtime protocol version");
            return;
          }
          if (command.type === "connection.resume") {
            if (
              typeof command.afterRoomSequences !== "object" ||
              command.afterRoomSequences === null
            ) {
              socket.close(1003, "Invalid realtime command");
              return;
            }
            for (const [roomId, sequence] of Object.entries(
              command.afterRoomSequences,
            )) {
              if (
                !idSchema.safeParse(roomId).success ||
                typeof sequence !== "number" ||
                !Number.isSafeInteger(sequence) ||
                sequence < 0
              ) {
                socket.close(1003, "Invalid replay cursor");
                return;
              }
              replayToConnection(connection, roomId, sequence);
              for (const run of dependencies.database.rooms.listActiveRuns(
                roomId,
              )) {
                sendRealtime(connection, {
                  eventId: randomUUID(),
                  type: "run.snapshot",
                  occurredAt: new Date().toISOString(),
                  roomId,
                  runId: run.runId,
                  payload: {
                    state: run.state,
                    targetParticipantId: run.targetParticipantId,
                    targetHandle: run.targetHandle,
                  },
                });
              }
            }
            connection.replayComplete = true;
            sendRealtime(connection, {
              eventId: randomUUID(),
              type: "connection.ready",
              occurredAt: new Date().toISOString(),
              payload: { replayComplete: true },
            });
            return;
          }

          const commandId = idSchema.safeParse(command.commandId);
          if (!commandId.success || !connection.replayComplete) {
            socket.close(1003, "Invalid realtime command envelope");
            return;
          }

          if (command.type === "message.send") {
            const roomId = idSchema.safeParse(command.roomId);
            const payload =
              typeof command.payload === "object" && command.payload !== null
                ? (command.payload as { readonly body?: unknown })
                : undefined;
            const parsed = sendMessageRequestSchema.safeParse({
              body: payload?.body,
              idempotencyKey: command.idempotencyKey,
            });
            if (!roomId.success || !parsed.success) {
              sendRealtime(connection, {
                eventId: randomUUID(),
                type: "command.rejected",
                occurredAt: new Date().toISOString(),
                payload: {
                  commandId: commandId.data,
                  code: "INVALID_MESSAGE",
                  message: "Message command is invalid.",
                },
              });
              return;
            }
            let result: ReturnType<typeof enqueueHumanMessage>;
            try {
              result = enqueueHumanMessage(
                roomId.data,
                parsed.data.body,
                parsed.data.idempotencyKey,
              );
            } catch {
              sendRealtime(connection, {
                eventId: randomUUID(),
                type: "command.rejected",
                occurredAt: new Date().toISOString(),
                payload: {
                  commandId: commandId.data,
                  code: "COMMAND_CONFLICT",
                  message: "Command conflicts with an earlier request.",
                },
              });
              return;
            }
            if (result === undefined) {
              sendRealtime(connection, {
                eventId: randomUUID(),
                type: "command.rejected",
                occurredAt: new Date().toISOString(),
                payload: {
                  commandId: commandId.data,
                  code: "ROOM_OWNER_MISSING",
                  message: "Room has no human owner.",
                },
              });
              return;
            }
            sendRealtime(connection, {
              eventId: randomUUID(),
              type: "command.accepted",
              occurredAt: new Date().toISOString(),
              roomId: roomId.data,
              payload: { commandId: commandId.data, ...result },
            });
            if (!result.duplicate) {
              void startRunDrain(roomId.data);
            }
            return;
          }

          if (command.type === "run.cancel") {
            const payload =
              typeof command.payload === "object" && command.payload !== null
                ? (command.payload as { readonly runId?: unknown })
                : undefined;
            const runId = idSchema.safeParse(payload?.runId);
            const cancelled = runId.success
              ? await supervisor.cancel(runId.data)
              : false;
            if (!runId.success || !cancelled) {
              sendRealtime(connection, {
                eventId: randomUUID(),
                type: "command.rejected",
                occurredAt: new Date().toISOString(),
                payload: {
                  commandId: commandId.data,
                  code: "RUN_NOT_ACTIVE",
                  message: "Run is not active.",
                },
              });
              return;
            }
            const context = dependencies.database.rooms.getRunContext(
              runId.data,
            );
            if (context !== undefined) {
              publishRoomEvents(context.roomId);
            }
            sendRealtime(connection, {
              eventId: randomUUID(),
              type: "command.accepted",
              occurredAt: new Date().toISOString(),
              runId: runId.data,
              payload: { commandId: commandId.data, state: "cancelled" },
            });
            return;
          }

          sendRealtime(connection, {
            eventId: randomUUID(),
            type: "command.rejected",
            occurredAt: new Date().toISOString(),
            payload: {
              commandId: commandId.data,
              code: "UNKNOWN_COMMAND",
              message: "Realtime command type is not supported.",
            },
          });
        } catch {
          socket.close(1003, "Malformed realtime command");
        }
      });
    },
  );

  application.post("/api/v1/rooms", async (request, reply) => {
    if (!hasSession(request)) {
      return sendSafeError(
        reply,
        401,
        "SESSION_REQUIRED",
        "A local bootstrap session is required.",
        requestId(request),
      );
    }
    const parsed = createRoomRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendSafeError(
        reply,
        400,
        "INVALID_ROOM",
        "Room title is invalid.",
        requestId(request),
      );
    }
    const room = dependencies.database.rooms.createRoom({
      title: parsed.data.title,
      ownerHandle: "owner",
      ownerDisplayName: "Owner",
    });
    dependencies.database.rooms.addAgent({
      roomId: room.roomId,
      handle: "fakeA",
      displayName: "Fake A",
    });
    dependencies.database.rooms.addAgent({
      roomId: room.roomId,
      handle: "fakeB",
      displayName: "Fake B",
    });
    return reply.code(201).send({
      protocolVersion: PROTOCOL_VERSION,
      ...room,
      participants: dependencies.database.rooms.listParticipants(room.roomId),
    });
  });

  application.get("/api/v1/rooms", async (request, reply) => {
    if (!hasSession(request)) {
      return sendSafeError(
        reply,
        401,
        "SESSION_REQUIRED",
        "A local bootstrap session is required.",
        requestId(request),
      );
    }
    return {
      protocolVersion: PROTOCOL_VERSION,
      rooms: dependencies.database.rooms.listRooms(),
    };
  });

  application.get("/api/v1/rooms/:roomId/messages", async (request, reply) => {
    if (!hasSession(request)) {
      return sendSafeError(
        reply,
        401,
        "SESSION_REQUIRED",
        "A local bootstrap session is required.",
        requestId(request),
      );
    }
    const params = request.params as { readonly roomId?: unknown };
    const roomId = idSchema.safeParse(params.roomId);
    if (!roomId.success) {
      return sendSafeError(
        reply,
        400,
        "INVALID_ROOM",
        "Room ID is invalid.",
        requestId(request),
      );
    }
    return {
      protocolVersion: PROTOCOL_VERSION,
      messages: dependencies.database.rooms.listMessages(roomId.data),
    };
  });

  application.post("/api/v1/rooms/:roomId/messages", async (request, reply) => {
    if (!hasSession(request)) {
      return sendSafeError(
        reply,
        401,
        "SESSION_REQUIRED",
        "A local bootstrap session is required.",
        requestId(request),
      );
    }
    const params = request.params as { readonly roomId?: unknown };
    const roomId = idSchema.safeParse(params.roomId);
    const body = sendMessageRequestSchema.safeParse(request.body);
    if (!roomId.success || !body.success) {
      return sendSafeError(
        reply,
        400,
        "INVALID_MESSAGE",
        "Message command is invalid.",
        requestId(request),
      );
    }
    const result = enqueueHumanMessage(
      roomId.data,
      body.data.body,
      body.data.idempotencyKey,
    );
    if (result === undefined) {
      return sendSafeError(
        reply,
        409,
        "ROOM_OWNER_MISSING",
        "Room has no human owner.",
        requestId(request),
      );
    }
    if (!result.duplicate) {
      const draining = startRunDrain(roomId.data);
      if (body.data.body.includes("[hang]")) {
        void draining;
      } else {
        await draining;
      }
    }
    return reply.code(result.duplicate ? 200 : 201).send({
      protocolVersion: PROTOCOL_VERSION,
      ...result,
    });
  });

  application.post("/api/v1/runs/:runId/cancel", async (request, reply) => {
    if (!hasSession(request)) {
      return sendSafeError(
        reply,
        401,
        "SESSION_REQUIRED",
        "A local bootstrap session is required.",
        requestId(request),
      );
    }
    const params = request.params as { readonly runId?: unknown };
    const runId = idSchema.safeParse(params.runId);
    if (!runId.success) {
      return sendSafeError(
        reply,
        400,
        "INVALID_RUN",
        "Run ID is invalid.",
        requestId(request),
      );
    }
    const cancelled = await supervisor.cancel(runId.data);
    if (!cancelled) {
      return sendSafeError(
        reply,
        409,
        "RUN_NOT_ACTIVE",
        "Run is not active.",
        requestId(request),
      );
    }
    const context = dependencies.database.rooms.getRunContext(runId.data);
    if (context !== undefined) {
      publishRoomEvents(context.roomId);
    }
    return {
      protocolVersion: PROTOCOL_VERSION,
      runId: runId.data,
      state: "cancelled",
    };
  });

  application.get(
    "/api/v1/rooms/:roomId/runs/active",
    async (request, reply) => {
      if (!hasSession(request)) {
        return sendSafeError(
          reply,
          401,
          "SESSION_REQUIRED",
          "A local bootstrap session is required.",
          requestId(request),
        );
      }
      const params = request.params as { readonly roomId?: unknown };
      const roomId = idSchema.safeParse(params.roomId);
      if (!roomId.success) {
        return sendSafeError(
          reply,
          400,
          "INVALID_ROOM",
          "Room ID is invalid.",
          requestId(request),
        );
      }
      return {
        protocolVersion: PROTOCOL_VERSION,
        runs: dependencies.database.rooms.listActiveRuns(roomId.data),
      };
    },
  );

  application.post("/api/v1/runs/:runId/retry", async (request, reply) => {
    if (!hasSession(request)) {
      return sendSafeError(
        reply,
        401,
        "SESSION_REQUIRED",
        "A local bootstrap session is required.",
        requestId(request),
      );
    }
    const params = request.params as { readonly runId?: unknown };
    const body = request.body as { readonly idempotencyKey?: unknown } | null;
    const runId = idSchema.safeParse(params.runId);
    const idempotencyKey = idSchema.safeParse(body?.idempotencyKey);
    if (!runId.success || !idempotencyKey.success) {
      return sendSafeError(
        reply,
        400,
        "INVALID_RETRY",
        "Retry command is invalid.",
        requestId(request),
      );
    }
    const original = dependencies.database.rooms.getRunContext(runId.data);
    if (original === undefined) {
      return sendSafeError(
        reply,
        404,
        "RUN_NOT_FOUND",
        "Run was not found.",
        requestId(request),
      );
    }
    const result = dependencies.database.rooms.retryRun({
      runId: runId.data,
      idempotencyKey: idempotencyKey.data,
    });
    publishRoomEvents(original.roomId);
    if (!result.duplicate) {
      await supervisor.drainQueued();
      publishRoomEvents(original.roomId);
    }
    return reply.code(result.duplicate ? 200 : 201).send({
      protocolVersion: PROTOCOL_VERSION,
      ...result,
    });
  });

  application.get("/api/v1/runs/:runId/context", async (request, reply) => {
    if (!hasSession(request)) {
      return sendSafeError(
        reply,
        401,
        "SESSION_REQUIRED",
        "A local bootstrap session is required.",
        requestId(request),
      );
    }
    const params = request.params as { readonly runId?: unknown };
    const runId = idSchema.safeParse(params.runId);
    if (!runId.success) {
      return sendSafeError(
        reply,
        400,
        "INVALID_RUN",
        "Run ID is invalid.",
        requestId(request),
      );
    }
    const context = dependencies.database.rooms.getRunContext(runId.data);
    if (context === undefined) {
      return sendSafeError(
        reply,
        404,
        "RUN_NOT_FOUND",
        "Run was not found.",
        requestId(request),
      );
    }
    return { protocolVersion: PROTOCOL_VERSION, context };
  });

  application.get("/api/v1/rooms/:roomId/search", async (request, reply) => {
    if (!hasSession(request)) {
      return sendSafeError(
        reply,
        401,
        "SESSION_REQUIRED",
        "A local bootstrap session is required.",
        requestId(request),
      );
    }
    const params = request.params as { readonly roomId?: unknown };
    const query = request.query as { readonly q?: unknown };
    const roomId = idSchema.safeParse(params.roomId);
    const searchText =
      typeof query.q === "string" ? query.q.trim().slice(0, 500) : "";
    if (!roomId.success || searchText.length === 0) {
      return sendSafeError(
        reply,
        400,
        "INVALID_SEARCH",
        "Search query is invalid.",
        requestId(request),
      );
    }
    return {
      protocolVersion: PROTOCOL_VERSION,
      results: dependencies.database.rooms.searchMessages(
        roomId.data,
        searchText,
      ),
    };
  });

  application.post("/api/v1/rooms/:roomId/export", async (request, reply) => {
    if (!hasSession(request)) {
      return sendSafeError(
        reply,
        401,
        "SESSION_REQUIRED",
        "A local bootstrap session is required.",
        requestId(request),
      );
    }
    const params = request.params as { readonly roomId?: unknown };
    const roomId = idSchema.safeParse(params.roomId);
    const body = request.body as { readonly format?: unknown } | null;
    const format = body?.format;
    if (!roomId.success || (format !== "json" && format !== "markdown")) {
      return sendSafeError(
        reply,
        400,
        "INVALID_EXPORT",
        "Export format is invalid.",
        requestId(request),
      );
    }
    const exported = dependencies.database.rooms.exportRoom(roomId.data);
    if (exported === undefined) {
      return sendSafeError(
        reply,
        404,
        "ROOM_NOT_FOUND",
        "Room was not found.",
        requestId(request),
      );
    }
    if (format === "json") {
      return { protocolVersion: PROTOCOL_VERSION, export: exported };
    }
    const handles = new Map(
      exported.participants.map((participant) => [
        participant.id,
        participant.handle,
      ]),
    );
    const markdown = [
      "# " + exported.room.title,
      "",
      ...exported.messages.flatMap((message) => [
        "## @" + (handles.get(message.authorParticipantId) ?? "unknown"),
        "",
        message.body,
        "",
      ]),
    ].join("\n");
    return {
      protocolVersion: PROTOCOL_VERSION,
      export: { version: 1, format: "markdown", content: markdown },
    };
  });

  if (existsSync(dependencies.config.webAssetsDirectory)) {
    await application.register(fastifyStatic, {
      root: dependencies.config.webAssetsDirectory,
      wildcard: false,
    });
  }

  return application;
}
