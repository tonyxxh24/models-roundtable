import type { ProviderEvent } from "@models-roundtable/contracts";
import { describe, expect, it } from "vitest";
import { createRunSupervisor, type RunQueuePort } from "./run-supervisor.js";

describe("provider-neutral run supervisor", () => {
  it("claims queued work and records normalized fake events through completion", async () => {
    let state: "queued" | "starting" | "running" | "completed" = "queued";
    const events: ProviderEvent[] = [];
    const queue: RunQueuePort = {
      listQueuedRuns: () => [
        {
          runId: "run-1",
          roomId: "room-1",
          targetParticipantId: "fake-a",
          prompt: "hello",
          inputRoomSequence: 2,
          adapterId: "fake",
        },
      ],
      transitionRun: (input) => {
        if (state !== input.from) {
          return false;
        }
        state = input.to as typeof state;
        return true;
      },
      recordProviderEvent: (_runId, event) => events.push(event),
    };
    const supervisor = createRunSupervisor(
      queue,
      new Map([
        [
          "fake",
          {
            id: "fake",
            start: async () => ({
              runToken: "fake:run-1",
              events: (async function* () {
                yield { type: "text_delta", text: "hello" } as const;
                yield { type: "completed", finalText: "hello" } as const;
              })(),
              cancel: async () => undefined,
            }),
            continue: async () => {
              throw new Error("not used");
            },
          },
        ],
      ]),
    );

    await expect(supervisor.drainQueued()).resolves.toEqual([
      { runId: "run-1", state: "completed" },
    ]);
    expect(state).toBe("completed");
    expect(events.map((event) => event.type)).toEqual([
      "text_delta",
      "completed",
    ]);
  });

  it("cancels only the tracked active run and returns a cancelled outcome", async () => {
    let state:
      "queued" | "starting" | "running" | "completed" | "failed" | "cancelled" =
      "queued";
    let releaseProvider: (() => void) | undefined;
    let announceDelta: (() => void) | undefined;
    const deltaSeen = new Promise<void>((resolve) => {
      announceDelta = resolve;
    });
    const providerReleased = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const queue: RunQueuePort = {
      listQueuedRuns: () => [
        {
          runId: "run-cancel",
          roomId: "room-1",
          targetParticipantId: "fake-a",
          prompt: "stream",
          inputRoomSequence: 3,
          adapterId: "fake",
        },
      ],
      transitionRun: (input) => {
        if (state !== input.from) {
          return false;
        }
        state = input.to;
        return true;
      },
      recordProviderEvent: (_runId, event) => {
        if (event.type === "text_delta") {
          announceDelta?.();
        }
      },
    };
    const supervisor = createRunSupervisor(
      queue,
      new Map([
        [
          "fake",
          {
            id: "fake",
            start: async () => ({
              runToken: "fake:run-cancel",
              events: (async function* () {
                yield { type: "text_delta", text: "partial" } as const;
                await providerReleased;
              })(),
              cancel: async () => {
                releaseProvider?.();
              },
            }),
            continue: async () => {
              throw new Error("not used");
            },
          },
        ],
      ]),
    );

    const draining = supervisor.drainQueued();
    await deltaSeen;
    await expect(supervisor.cancel("run-cancel")).resolves.toBe(true);
    await expect(draining).resolves.toEqual([
      { runId: "run-cancel", state: "cancelled" },
    ]);
    expect(state).toBe("cancelled");
    await expect(supervisor.cancel("not-active")).resolves.toBe(false);
  });
});
