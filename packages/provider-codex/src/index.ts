import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { promisify } from "node:util";
import {
  type ProviderAdapter,
  type ProviderEvent,
  type ProviderRunHandle,
  type ProviderRunRequest,
} from "@models-roundtable/contracts";
import {
  IncrementalJsonlDecoder,
  parseJsonRecord,
} from "@models-roundtable/provider-base";

const maximumDiagnosticBytes = 8 * 1024;
const gracefulCancellationTimeoutMs = 1_500;
const execFileAsync = promisify(execFile);

export interface CodexProbeResult {
  readonly health: "ready" | "missing" | "incompatible" | "error";
  readonly providerVersion?: string;
  readonly capabilityHash?: string;
  readonly safeMessage: string;
}

export async function probeCodexExecutable(
  executable = "codex",
): Promise<CodexProbeResult> {
  try {
    const version = await execFileAsync(executable, ["--version"], {
      timeout: 3_000,
      windowsHide: true,
      maxBuffer: 16 * 1024,
    });
    const help = await execFileAsync(executable, ["exec", "--help"], {
      timeout: 3_000,
      windowsHide: true,
      maxBuffer: 64 * 1024,
    });
    const providerVersion = /codex-cli\s+([0-9]+(?:\.[0-9]+)+)/u.exec(
      version.stdout,
    )?.[1];
    const required = [
      "--sandbox",
      "read-only",
      "--json",
      "--skip-git-repo-check",
    ];
    if (
      providerVersion === undefined ||
      !required.every((flag) => help.stdout.includes(flag))
    ) {
      return {
        health: "incompatible",
        safeMessage:
          "Codex CLI is installed but lacks required read-only JSONL capabilities.",
      };
    }
    const capabilityHash = createHash("sha256")
      .update(JSON.stringify({ providerVersion, required }))
      .digest("hex");
    return {
      health: "ready",
      providerVersion,
      capabilityHash,
      safeMessage:
        "Codex CLI is ready for owner-authenticated read-only sessions.",
    };
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    return code === "ENOENT"
      ? {
          health: "missing",
          safeMessage: "Codex CLI was not found on the server PATH.",
        }
      : {
          health: "error",
          safeMessage: "Codex CLI could not be probed by this local process.",
        };
  }
}

export interface CodexAdapterOptions {
  readonly executable?: string;
  /** An owner-validated disposable or registered workspace. */
  readonly workingDirectory: string;
}

interface NativeItem {
  readonly id?: unknown;
  readonly type?: unknown;
  readonly text?: unknown;
}

interface NativeCodexEvent {
  readonly type?: unknown;
  readonly thread_id?: unknown;
  readonly item?: NativeItem;
}

class EventQueue implements AsyncIterable<ProviderEvent> {
  readonly #events: ProviderEvent[] = [];
  #closed = false;
  #waiter: ((result: IteratorResult<ProviderEvent>) => void) | undefined;

  push(event: ProviderEvent): void {
    if (this.#closed) return;
    if (this.#waiter !== undefined) {
      const resolve = this.#waiter;
      this.#waiter = undefined;
      resolve({ done: false, value: event });
      return;
    }
    this.#events.push(event);
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#waiter?.({ done: true, value: undefined });
    this.#waiter = undefined;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<ProviderEvent> {
    while (true) {
      const queued = this.#events.shift();
      if (queued !== undefined) {
        yield queued;
        continue;
      }
      if (this.#closed) return;
      const next = await new Promise<IteratorResult<ProviderEvent>>(
        (resolve) => {
          this.#waiter = resolve;
        },
      );
      if (next.done) return;
      yield next.value;
    }
  }
}

function safeFailure(
  code: Extract<ProviderEvent, { readonly type: "failed" }>["code"],
  safeMessage: string,
  retryable: boolean,
): ProviderEvent {
  return { type: "failed", code, safeMessage, retryable };
}

function isNativeEvent(value: unknown): value is NativeCodexEvent {
  return typeof value === "object" && value !== null;
}

/** Maps only fields observed in the owner-terminal fixture corpus. */
export function normalizeCodexEvent(value: unknown): readonly ProviderEvent[] {
  if (!isNativeEvent(value) || typeof value.type !== "string") return [];
  if (value.type === "thread.started" && typeof value.thread_id === "string") {
    return [{ type: "session_started", providerSessionId: value.thread_id }];
  }
  if (
    value.type === "item.completed" &&
    value.item?.type === "agent_message" &&
    typeof value.item.text === "string"
  ) {
    return [{ type: "text_delta", text: value.item.text }];
  }
  return [];
}

function safeDiagnosticCode(
  stderr: string,
): Extract<ProviderEvent, { readonly type: "failed" }>["code"] {
  const normalized = stderr.toLocaleLowerCase("en-US");
  if (
    normalized.includes("no rollout found") ||
    normalized.includes("thread/resume")
  ) {
    return "provider_session_not_found";
  }
  if (
    normalized.includes("sign in") ||
    normalized.includes("login") ||
    normalized.includes("auth")
  ) {
    return "provider_auth_required";
  }
  return "provider_process_error";
}

function safeDiagnosticMessage(
  code: Extract<ProviderEvent, { readonly type: "failed" }>["code"],
): string {
  if (code === "provider_session_not_found")
    return "The saved Codex session is no longer available.";
  if (code === "provider_auth_required")
    return "Codex needs an owner login in the official CLI.";
  return "Codex ended without a successful response.";
}

function isDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function waitForClose(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve) => child.once("close", () => resolve()));
}

function terminateOwnedTree(pid: number | undefined): Promise<void> {
  if (pid === undefined) return Promise.resolve();
  return new Promise((resolve) => {
    execFile(
      "taskkill",
      ["/pid", String(pid), "/T", "/F"],
      { windowsHide: true },
      () => resolve(),
    );
  });
}

function failedHandle(runId: string, event: ProviderEvent): ProviderRunHandle {
  return {
    runToken: "codex:rejected:" + runId,
    events: (async function* () {
      yield event;
    })(),
    cancel: async () => undefined,
  };
}

export function createCodexAdapter(
  options: CodexAdapterOptions,
): ProviderAdapter {
  const executable = options.executable ?? "codex";

  async function start(
    request: ProviderRunRequest,
  ): Promise<ProviderRunHandle> {
    if (request.permission === "workspace_write") {
      return failedHandle(
        request.runId,
        safeFailure(
          "provider_permission_denied",
          "Codex workspace write is not available in Personal Mode.",
          false,
        ),
      );
    }
    if (!isDirectory(options.workingDirectory)) {
      return failedHandle(
        request.runId,
        safeFailure(
          "workspace_unavailable",
          "The selected Codex workspace is unavailable.",
          false,
        ),
      );
    }

    const queue = new EventQueue();
    const decoder = new IncrementalJsonlDecoder();
    let stderr = "";
    let cancelled = false;
    let terminalEventSent = false;
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(
        executable,
        [
          "exec",
          "--sandbox",
          "read-only",
          "--json",
          "--skip-git-repo-check",
          "-",
        ],
        {
          cwd: options.workingDirectory,
          shell: false,
          stdio: "pipe",
          windowsHide: true,
        },
      );
    } catch {
      return failedHandle(
        request.runId,
        safeFailure(
          "provider_missing",
          "Codex CLI is not available on PATH.",
          false,
        ),
      );
    }

    const closed = waitForClose(child);
    child.once("error", () => {
      if (!terminalEventSent) {
        terminalEventSent = true;
        queue.push(
          safeFailure(
            "provider_missing",
            "Codex CLI could not be started.",
            false,
          ),
        );
      }
      queue.close();
    });
    child.stdout.on("data", (chunk: Uint8Array) => {
      for (const record of decoder.push(chunk)) {
        const parsed = parseJsonRecord(record);
        if (!parsed.ok) {
          queue.push({
            type: "warning",
            code: "provider_protocol_error",
            safeMessage: parsed.safeMessage,
          });
          continue;
        }
        for (const event of normalizeCodexEvent(parsed.value))
          queue.push(event);
      }
    });
    child.stderr.on("data", (chunk: Uint8Array) => {
      if (stderr.length >= maximumDiagnosticBytes) return;
      stderr += Buffer.from(chunk)
        .toString("utf8")
        .slice(0, maximumDiagnosticBytes - stderr.length);
    });
    child.once("close", (code) => {
      for (const record of decoder.finish().records) {
        const parsed = parseJsonRecord(record);
        if (parsed.ok)
          for (const event of normalizeCodexEvent(parsed.value))
            queue.push(event);
      }
      if (!cancelled && !terminalEventSent) {
        terminalEventSent = true;
        if (code === 0) queue.push({ type: "completed" });
        else {
          const failureCode = safeDiagnosticCode(stderr);
          queue.push(
            safeFailure(
              failureCode,
              safeDiagnosticMessage(failureCode),
              failureCode !== "provider_auth_required",
            ),
          );
        }
      }
      queue.close();
    });
    child.stdin.end(request.prompt);

    return {
      runToken: "codex:" + request.runId,
      events: queue,
      cancel: async () => {
        if (cancelled) return;
        cancelled = true;
        child.kill("SIGINT");
        const exited = await Promise.race([
          closed.then(() => true),
          new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(false), gracefulCancellationTimeoutMs),
          ),
        ]);
        if (!exited) await terminateOwnedTree(child.pid);
      },
    };
  }

  return {
    id: "codex",
    start,
    async continue(request) {
      void request;
      return failedHandle(
        request.runId,
        safeFailure(
          "provider_incompatible",
          "This Codex CLI version has no verified read-only resume invocation.",
          false,
        ),
      );
    },
  };
}
