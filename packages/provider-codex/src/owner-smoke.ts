import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { isAbsolute, parse, resolve } from "node:path";
import type {
  ProviderEvent,
  ProviderRunHandle,
} from "@models-roundtable/contracts";
import { createCodexAdapter } from "./index.js";

const requiredAttestation = "I_HAVE_VERIFIED_READ_ONLY_RESUME";
const smokeTimeoutMs = 90_000;

interface CompletedRun {
  readonly providerSessionId: string;
  readonly text: string;
}

function fail(message: string): never {
  throw new Error(message);
}

function safeWorkspace(): string {
  if (
    process.env.MODELS_ROUNDTABLE_CODEX_RESUME_SMOKE !== requiredAttestation
  ) {
    return fail(
      "Owner attestation is missing. Complete the documented resume write-denial probe first.",
    );
  }
  const configured = process.env.MODELS_ROUNDTABLE_CODEX_WORKSPACE;
  if (configured === undefined || !isAbsolute(configured)) {
    return fail("MODELS_ROUNDTABLE_CODEX_WORKSPACE must be an absolute path.");
  }
  const workspace = resolve(configured);
  if (workspace === parse(workspace).root) {
    return fail("The smoke workspace cannot be a filesystem root.");
  }
  if (readdirSync(workspace).length !== 0) {
    return fail("The owner smoke workspace must be empty.");
  }
  return workspace;
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(label + " timed out.")),
          smokeTimeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function collectCompleted(
  handle: ProviderRunHandle,
): Promise<CompletedRun> {
  let providerSessionId: string | undefined;
  let text = "";
  let completed = false;
  for await (const event of handle.events) {
    if (event.type === "session_started") {
      providerSessionId = event.providerSessionId;
    } else if (event.type === "text_delta") {
      text += event.text;
    } else if (event.type === "failed") {
      return fail(event.safeMessage);
    } else if (event.type === "completed") {
      completed = true;
    }
  }
  if (!completed || providerSessionId === undefined) {
    return fail("Codex ended without a complete normalized session.");
  }
  return { providerSessionId, text };
}

function assertToken(run: CompletedRun, token: string): void {
  if (run.text.trim() !== token) {
    fail("Codex did not return the expected fixed smoke token.");
  }
}

async function drain(
  handle: ProviderRunHandle,
): Promise<readonly ProviderEvent[]> {
  const events: ProviderEvent[] = [];
  for await (const event of handle.events) events.push(event);
  return events;
}

async function main(): Promise<void> {
  const workspace = safeWorkspace();
  const adapter = createCodexAdapter({
    workingDirectory: workspace,
    verifiedReadOnlyResume: true,
  });
  const permission = "workspace_read" as const;

  const started = await adapter.start({
    runId: randomUUID(),
    agentId: "owner-smoke-codex",
    permission,
    prompt:
      "Reply with exactly APP_START_OK. Do not use tools, read files, or modify anything.",
    roomSequence: 1,
  });
  const first = await withTimeout(collectCompleted(started), "Codex start");
  assertToken(first, "APP_START_OK");
  console.log("APP_START_OK");

  const resumed = await adapter.continue({
    runId: randomUUID(),
    agentId: "owner-smoke-codex",
    permission,
    prompt:
      "Reply with exactly APP_RESUME_OK. Do not use tools, read files, or modify anything.",
    roomSequence: 2,
    providerSessionId: first.providerSessionId,
  });
  const second = await withTimeout(collectCompleted(resumed), "Codex resume");
  assertToken(second, "APP_RESUME_OK");
  console.log("APP_RESUME_OK");

  const cancellable = await adapter.start({
    runId: randomUUID(),
    agentId: "owner-smoke-codex",
    permission,
    prompt:
      "Wait for 60 seconds before replying. Do not use tools or modify files.",
    roomSequence: 3,
  });
  const draining = drain(cancellable);
  await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 500));
  await withTimeout(cancellable.cancel("user"), "Codex cancellation");
  const cancelledEvents = await withTimeout(
    draining,
    "Codex cancellation drain",
  );
  if (cancelledEvents.some((event) => event.type === "completed")) {
    fail("Codex completed before the cancellation probe interrupted it.");
  }
  console.log("APP_CANCEL_OK");

  if (readdirSync(workspace).length !== 0) {
    fail("The Codex smoke changed the read-only workspace.");
  }
  console.log("APP_WORKSPACE_EMPTY_OK");
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown smoke error.";
  console.error("OWNER_SMOKE_FAILED: " + message);
  process.exitCode = 1;
});
