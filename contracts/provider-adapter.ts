/** Planning-time normative provider contract. Copied into packages/contracts in Phase 1. */

export type AdapterId = string;
export type AgentId = string;
export type RunId = string;
export type WorkspaceId = string;
export type ProviderSessionId = string;

export type PermissionProfile =
  | "chat_only"
  | "workspace_read"
  | "workspace_write";

export type ProviderHealthState =
  | "unknown"
  | "probing"
  | "missing"
  | "auth_required"
  | "ready"
  | "rate_limited"
  | "incompatible"
  | "error";

export interface AdapterCapabilities {
  streamingJson: boolean;
  sessionIdEvent: boolean;
  resumeSession: boolean;
  cwdArgument: boolean;
  readOnlyMode: boolean;
  approvalEvents: boolean;
  structuredToolEvents: boolean;
  imageInput: boolean;
  gracefulCancel: boolean;
}

export interface AdapterProbeResult {
  adapterId: AdapterId;
  health: ProviderHealthState;
  executablePathAlias?: string;
  providerVersion?: string;
  capabilities: AdapterCapabilities;
  capabilityHash: string;
  checkedAt: string;
  safeMessage?: string;
}

export interface ContextManifestRef {
  contextSnapshotId: string;
  roomSequence: number;
  prompt: string;
  attachmentPaths: readonly string[];
}

export interface ProviderRunRequest {
  runId: RunId;
  agentId: AgentId;
  workspaceId?: WorkspaceId;
  /** Canonical, already validated absolute path. */
  workingDirectory?: string;
  permission: PermissionProfile;
  context: ContextManifestRef;
  timeoutMs: number;
  providerConfig: Readonly<Record<string, string | number | boolean>>;
}

export interface ProviderContinueRequest extends ProviderRunRequest {
  providerSessionId: ProviderSessionId;
}

export type ProviderErrorCode =
  | "provider_missing"
  | "provider_auth_required"
  | "provider_incompatible"
  | "provider_rate_limited"
  | "provider_usage_limit"
  | "provider_permission_denied"
  | "provider_session_not_found"
  | "provider_protocol_error"
  | "provider_timeout"
  | "provider_cancelled"
  | "provider_process_error"
  | "workspace_unavailable"
  | "unknown_provider_error";

export interface NormalizedProviderError {
  code: ProviderErrorCode;
  safeMessage: string;
  retryable: boolean;
  diagnosticRef?: string;
}

export type ProviderEvent =
  | {
      type: "session_started";
      providerSessionId: ProviderSessionId;
    }
  | {
      type: "text_delta";
      text: string;
    }
  | {
      type: "reasoning_summary";
      text: string;
    }
  | {
      type: "tool_started";
      toolCallId: string;
      toolName: string;
      safeInput?: unknown;
    }
  | {
      type: "tool_updated";
      toolCallId: string;
      safeUpdate: unknown;
    }
  | {
      type: "tool_finished";
      toolCallId: string;
      outcome: "succeeded" | "failed" | "denied";
      safeOutput?: unknown;
    }
  | {
      type: "approval_required";
      approvalId: string;
      requestHash: string;
      action: string;
      safeDetails: Readonly<Record<string, unknown>>;
    }
  | {
      type: "usage";
      inputTokens?: number;
      outputTokens?: number;
      providerReported: true;
    }
  | {
      type: "warning";
      code: string;
      safeMessage: string;
    }
  | {
      type: "completed";
      finalText?: string;
    }
  | {
      type: "failed";
      error: NormalizedProviderError;
    };

export interface ProviderRunHandle {
  /** Application-owned opaque token identifying the exact child/run instance. */
  readonly runToken: string;
  readonly events: AsyncIterable<ProviderEvent>;
  cancel(reason: "user" | "timeout" | "shutdown"): Promise<void>;
}

export interface ProviderAdapter {
  readonly id: AdapterId;
  probe(signal?: AbortSignal): Promise<AdapterProbeResult>;
  start(request: ProviderRunRequest): Promise<ProviderRunHandle>;
  continue(request: ProviderContinueRequest): Promise<ProviderRunHandle>;
}
