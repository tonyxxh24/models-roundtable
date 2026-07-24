import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProviderRunHandle } from "@models-roundtable/contracts";
import { describe, expect, it } from "vitest";
import {
  createCodexAdapter,
  normalizeCodexEvent,
  probeCodexExecutable,
} from "./index.js";

function fixture(name: string): readonly unknown[] {
  return readFileSync(
    join(
      process.cwd(),
      "..",
      "..",
      "fixtures",
      "providers",
      "codex",
      "0.145.0",
      name,
    ),
    "utf8",
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as unknown);
}

describe("Codex CLI 0.145.0 normalization", () => {
  it("reports a missing executable without leaking process diagnostics", async () => {
    await expect(
      probeCodexExecutable("models-roundtable-missing-codex-executable"),
    ).resolves.toEqual({
      health: "missing",
      safeMessage: "Codex CLI was not found on the server PATH.",
    });
  });
  it("maps the observed new-session fixture without exposing native identifiers", () => {
    const events = fixture("normal.sanitized.jsonl").flatMap(
      normalizeCodexEvent,
    );
    expect(events).toEqual([
      { type: "session_started", providerSessionId: "<SESSION_ID>" },
      { type: "text_delta", text: "PHASE0_NEW_OK" },
    ]);
  });

  it("maps the observed resume fixture", () => {
    const events = fixture("resume.sanitized.jsonl").flatMap(
      normalizeCodexEvent,
    );
    expect(events).toEqual([
      { type: "session_started", providerSessionId: "<SESSION_ID>" },
      { type: "text_delta", text: "PHASE0_RESUME_OK" },
    ]);
  });

  it("tolerates synthetic unknown provider events", () => {
    const [unknownEvent] = fixture("synthetic-unknown-event.jsonl");
    expect(normalizeCodexEvent(unknownEvent)).toEqual([]);
  });

  it("rejects workspace write and unverified read-only resume before spawning", async () => {
    const adapter = createCodexAdapter({
      workingDirectory: process.cwd(),
      executable: "definitely-not-codex",
    });
    const write = await adapter.start({
      runId: "write-run",
      agentId: "agent",
      permission: "workspace_write",
      prompt: "write",
      roomSequence: 1,
    });
    await expect(toEvents(write)).resolves.toEqual([
      expect.objectContaining({
        type: "failed",
        code: "provider_permission_denied",
      }),
    ]);
    const resumed = await adapter.continue({
      runId: "resume-run",
      agentId: "agent",
      permission: "chat_only",
      prompt: "resume",
      roomSequence: 1,
      providerSessionId: "<SESSION_ID>",
    });
    await expect(toEvents(resumed)).resolves.toEqual([
      expect.objectContaining({
        type: "failed",
        code: "provider_incompatible",
      }),
    ]);
  });
});

async function toEvents(
  handle: ProviderRunHandle,
): Promise<readonly unknown[]> {
  const events: unknown[] = [];
  for await (const event of handle.events) events.push(event);
  return events;
}
