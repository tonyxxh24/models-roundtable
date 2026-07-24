import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;

export const idSchema = z.string().min(1).max(128);

export const healthResponseSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  status: z.literal("ready"),
  database: z.literal("ready"),
  checkedAt: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const eventTypeSchema = z.enum([
  "connection.ready",
  "snapshot_required",
  "command.accepted",
  "command.rejected",
  "room.created",
  "room.updated",
  "room.archived",
  "participant.updated",
  "message.created",
  "message.revised",
  "message.tombstoned",
  "run.queued",
  "run.started",
  "run.snapshot",
  "run.session_bound",
  "run.text_delta",
  "run.tool_started",
  "run.tool_updated",
  "run.tool_finished",
  "run.approval_required",
  "run.approval_resolved",
  "run.warning",
  "run.completed",
  "run.failed",
  "run.cancelled",
  "provider.health_changed",
  "workspace.lease_changed",
  "skill.projection_changed",
]);

export const serverEventSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  eventId: idSchema,
  type: eventTypeSchema,
  occurredAt: z.string().datetime(),
  roomId: idSchema.optional(),
  roomSequence: z.number().int().positive().optional(),
  runId: idSchema.optional(),
  runSequence: z.number().int().positive().optional(),
  requestId: idSchema.optional(),
  payload: z.record(z.string(), z.unknown()),
});

export type ServerEvent = z.infer<typeof serverEventSchema>;

export const errorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
  requestId: idSchema,
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const createRoomRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export const sendMessageRequestSchema = z.object({
  body: z
    .string()
    .min(1)
    .max(64 * 1024),
  idempotencyKey: idSchema,
});

export type PermissionProfile =
  "chat_only" | "workspace_read" | "workspace_write";

export type ProviderEvent =
  | { readonly type: "session_started"; readonly providerSessionId: string }
  | { readonly type: "text_delta"; readonly text: string }
  | {
      readonly type: "tool_started";
      readonly toolCallId: string;
      readonly toolName: string;
    }
  | {
      readonly type: "warning";
      readonly code: string;
      readonly safeMessage: string;
    }
  | { readonly type: "completed"; readonly finalText?: string | undefined }
  | {
      readonly type: "failed";
      readonly code: string;
      readonly safeMessage: string;
      readonly retryable: boolean;
    };

export interface ProviderRunRequest {
  readonly runId: string;
  readonly agentId: string;
  readonly permission: PermissionProfile;
  readonly prompt: string;
  readonly roomSequence: number;
}

export interface ProviderRunHandle {
  readonly runToken: string;
  readonly events: AsyncIterable<ProviderEvent>;
  cancel(reason: "user" | "timeout" | "shutdown"): Promise<void>;
}

export interface ProviderAdapter {
  readonly id: string;
  start(request: ProviderRunRequest): Promise<ProviderRunHandle>;
  continue(
    request: ProviderRunRequest & { readonly providerSessionId: string },
  ): Promise<ProviderRunHandle>;
}
