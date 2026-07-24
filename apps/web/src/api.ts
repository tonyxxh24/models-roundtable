import {
  healthResponseSchema,
  type HealthResponse,
} from "@models-roundtable/contracts";

export async function fetchHealth(
  signal?: AbortSignal,
): Promise<HealthResponse> {
  const init: RequestInit = {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  };
  if (signal !== undefined) {
    init.signal = signal;
  }
  const response = await fetch("/api/v1/health", init);
  if (!response.ok) {
    throw new Error("Local server returned HTTP " + response.status + ".");
  }
  return healthResponseSchema.parse(await response.json());
}

async function jsonRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error("Local server returned HTTP " + response.status + ".");
  }
  return (await response.json()) as T;
}

export interface RoomSummary {
  readonly roomId: string;
  readonly title: string;
  readonly version: number;
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

export interface RunContext {
  readonly runId: string;
  readonly targetHandle: string;
  readonly state: string;
  readonly contextSnapshotId: string;
  readonly manifest: {
    readonly roomSequence: number;
    readonly mode: "new" | "resume";
    readonly messageIds: readonly string[];
    readonly replyMessageIds: readonly string[];
    readonly instructionRefs: readonly string[];
    readonly skillRefs: readonly string[];
    readonly attachmentIds: readonly string[];
    readonly truncations: readonly string[];
    readonly estimatedCharacters: number;
  };
}

export interface ActiveRun {
  readonly runId: string;
  readonly targetHandle: string;
  readonly state: "queued" | "starting" | "running";
}

export interface ProviderReadiness {
  readonly health: "ready" | "missing" | "incompatible" | "error";
  readonly providerVersion?: string;
  readonly capabilityHash?: string;
  readonly safeMessage: string;
  readonly workspaceConfigured: boolean;
}

export async function addCodexParticipant(roomId: string): Promise<void> {
  await jsonRequest(
    "/api/v1/rooms/" + encodeURIComponent(roomId) + "/participants/codex",
    { method: "POST", body: "{}" },
  );
}

export function fetchCodexReadiness(): Promise<ProviderReadiness> {
  return jsonRequest<ProviderReadiness>("/api/v1/providers/codex");
}

export interface SendMessageResult {
  readonly messageId: string;
  readonly roomSequence: number;
  readonly runIds: readonly string[];
  readonly duplicate: boolean;
}

export async function bootstrapSession(): Promise<void> {
  await jsonRequest("/api/v1/bootstrap", {
    method: "POST",
    body: "{}",
  });
}

export async function listRooms(): Promise<readonly RoomSummary[]> {
  const response = await jsonRequest<{
    readonly rooms: readonly RoomSummary[];
  }>("/api/v1/rooms");
  return response.rooms;
}

export async function createRoom(title: string): Promise<RoomSummary> {
  return jsonRequest<RoomSummary>("/api/v1/rooms", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function fetchMessages(
  roomId: string,
): Promise<readonly RoomMessage[]> {
  const response = await jsonRequest<{
    readonly messages: readonly RoomMessage[];
  }>("/api/v1/rooms/" + encodeURIComponent(roomId) + "/messages");
  return response.messages;
}

export async function sendMessage(
  roomId: string,
  body: string,
): Promise<SendMessageResult> {
  return jsonRequest(
    "/api/v1/rooms/" + encodeURIComponent(roomId) + "/messages",
    {
      method: "POST",
      body: JSON.stringify({
        body,
        idempotencyKey: crypto.randomUUID(),
      }),
    },
  );
}

export async function fetchActiveRuns(
  roomId: string,
): Promise<readonly ActiveRun[]> {
  const response = await jsonRequest<{ readonly runs: readonly ActiveRun[] }>(
    "/api/v1/rooms/" + encodeURIComponent(roomId) + "/runs/active",
  );
  return response.runs;
}

export async function cancelRun(runId: string): Promise<void> {
  await jsonRequest("/api/v1/runs/" + encodeURIComponent(runId) + "/cancel", {
    method: "POST",
    body: "{}",
  });
}

export async function retryRun(runId: string): Promise<void> {
  await jsonRequest("/api/v1/runs/" + encodeURIComponent(runId) + "/retry", {
    method: "POST",
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
  });
}

export async function fetchRunContext(runId: string): Promise<RunContext> {
  const response = await jsonRequest<{ readonly context: RunContext }>(
    "/api/v1/runs/" + encodeURIComponent(runId) + "/context",
  );
  return response.context;
}

export function connectRoomRealtime(
  roomId: string,
  afterSequence: number,
  onDurableEvent: (event: {
    readonly eventId: string;
    readonly type: string;
    readonly roomSequence?: number;
    readonly runId?: string;
    readonly payload?: Readonly<Record<string, unknown>>;
  }) => void,
  onError: () => void,
): () => void {
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(
    scheme + "//" + window.location.host + "/api/v1/realtime",
  );
  const seenEventIds = new Set<string>();
  socket.addEventListener("open", () => {
    socket.send(
      JSON.stringify({
        v: 1,
        type: "connection.resume",
        afterRoomSequences: { [roomId]: afterSequence },
      }),
    );
  });
  socket.addEventListener("message", (message) => {
    try {
      const event = JSON.parse(String(message.data)) as {
        readonly eventId?: unknown;
        readonly type?: unknown;
        readonly roomSequence?: unknown;
        readonly runId?: unknown;
        readonly payload?: unknown;
      };
      if (
        typeof event.eventId !== "string" ||
        typeof event.type !== "string" ||
        seenEventIds.has(event.eventId)
      ) {
        return;
      }
      seenEventIds.add(event.eventId);
      onDurableEvent({
        eventId: event.eventId,
        type: event.type,
        ...(typeof event.roomSequence === "number"
          ? { roomSequence: event.roomSequence }
          : {}),
        ...(typeof event.runId === "string" ? { runId: event.runId } : {}),
        ...(typeof event.payload === "object" && event.payload !== null
          ? { payload: event.payload as Readonly<Record<string, unknown>> }
          : {}),
      });
    } catch {
      onError();
    }
  });
  socket.addEventListener("error", onError);
  return () => socket.close(1000, "Room changed");
}
