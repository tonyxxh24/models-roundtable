import { describe, expect, it } from "vitest";
import { exerciseProviderAdapterContract } from "@models-roundtable/test-support";
import { createFakeAdapter } from "./index.js";

describe("deterministic fake provider", () => {
  it("passes the shared adapter contract for start and resume", async () => {
    const adapter = createFakeAdapter({
      sessionId: "fake-contract-session",
      events: [{ type: "completed" }],
    });
    const request = {
      runId: "contract-run",
      agentId: "contract-agent",
      permission: "chat_only" as const,
      prompt: "contract prompt",
      roomSequence: 1,
    };
    await expect(
      exerciseProviderAdapterContract(adapter, { mode: "start", request }),
    ).resolves.toMatchObject({
      events: [{ type: "session_started" }, { type: "completed" }],
    });
    await expect(
      exerciseProviderAdapterContract(adapter, {
        mode: "continue",
        request: { ...request, runId: "contract-resume-run" },
        providerSessionId: "opaque-resume-session",
      }),
    ).resolves.toMatchObject({
      events: [
        {
          type: "session_started",
          providerSessionId: "opaque-resume-session",
        },
        { type: "completed" },
      ],
    });
  });

  it("streams its script and supports a cancellation boundary", async () => {
    const adapter = createFakeAdapter({
      sessionId: "fake-session",
      events: [
        { type: "text_delta", text: "first " },
        { type: "text_delta", text: "second" },
        { type: "completed" },
      ],
    });
    const handle = await adapter.start({
      runId: "run-1",
      agentId: "agent-1",
      permission: "chat_only",
      prompt: "Hello",
      roomSequence: 1,
    });
    const received = [];
    for await (const event of handle.events) {
      received.push(event);
      if (event.type === "text_delta") {
        await handle.cancel("user");
      }
    }

    expect(received).toEqual([
      {
        type: "session_started",
        providerSessionId: "fake-session:agent-1",
      },
      { type: "text_delta", text: "first " },
    ]);
    expect(adapter.requests).toHaveLength(1);
  });
});
