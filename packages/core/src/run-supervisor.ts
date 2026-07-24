import type {
  ProviderAdapter,
  ProviderEvent,
  ProviderRunHandle,
  ProviderRunRequest,
} from "@models-roundtable/contracts";

export interface QueuedRunWork {
  readonly runId: string;
  readonly roomId: string;
  readonly targetParticipantId: string;
  readonly prompt: string;
  readonly inputRoomSequence: number;
  readonly adapterId: string;
  readonly providerSessionId?: string | undefined;
}

export interface RunQueuePort {
  listQueuedRuns(): readonly QueuedRunWork[];
  transitionRun(input: {
    readonly runId: string;
    readonly from: "queued" | "starting" | "running";
    readonly to: "starting" | "running" | "completed" | "failed" | "cancelled";
  }): boolean;
  recordProviderEvent(runId: string, event: ProviderEvent): void;
}

export interface RunOutcome {
  readonly runId: string;
  readonly state: "completed" | "failed" | "cancelled";
}

export function createRunSupervisor(
  queue: RunQueuePort,
  adapters: ReadonlyMap<string, ProviderAdapter>,
): {
  drainQueued(): Promise<readonly RunOutcome[]>;
  cancel(runId: string): Promise<boolean>;
} {
  const active = new Map<string, ProviderRunHandle>();
  const cancelled = new Set<string>();

  async function run(work: QueuedRunWork): Promise<RunOutcome | undefined> {
    if (
      !queue.transitionRun({
        runId: work.runId,
        from: "queued",
        to: "starting",
      })
    ) {
      return undefined;
    }

    const request: ProviderRunRequest = {
      runId: work.runId,
      agentId: work.targetParticipantId,
      permission: "chat_only",
      prompt: work.prompt,
      roomSequence: work.inputRoomSequence,
    };

    try {
      const adapter = adapters.get(work.adapterId);
      if (adapter === undefined) {
        queue.recordProviderEvent(work.runId, {
          type: "failed",
          code: "provider_missing",
          safeMessage: "The selected local provider is not available.",
          retryable: false,
        });
        queue.transitionRun({
          runId: work.runId,
          from: "starting",
          to: "failed",
        });
        return { runId: work.runId, state: "failed" };
      }
      const handle =
        work.providerSessionId === undefined
          ? await adapter.start(request)
          : await adapter.continue({
              ...request,
              providerSessionId: work.providerSessionId,
            });
      active.set(work.runId, handle);
      if (
        !queue.transitionRun({
          runId: work.runId,
          from: "starting",
          to: "running",
        })
      ) {
        await handle.cancel("shutdown");
        return undefined;
      }

      for await (const event of handle.events) {
        queue.recordProviderEvent(work.runId, event);
        if (event.type === "failed") {
          queue.transitionRun({
            runId: work.runId,
            from: "running",
            to: "failed",
          });
          active.delete(work.runId);
          return { runId: work.runId, state: "failed" };
        }
        if (event.type === "completed") {
          queue.transitionRun({
            runId: work.runId,
            from: "running",
            to: "completed",
          });
          active.delete(work.runId);
          return { runId: work.runId, state: "completed" };
        }
      }
      if (cancelled.has(work.runId)) {
        active.delete(work.runId);
        cancelled.delete(work.runId);
        return { runId: work.runId, state: "cancelled" };
      }
    } catch {
      if (cancelled.has(work.runId)) {
        active.delete(work.runId);
        cancelled.delete(work.runId);
        return { runId: work.runId, state: "cancelled" };
      }
      queue.transitionRun({
        runId: work.runId,
        from: "running",
        to: "failed",
      });
    }
    active.delete(work.runId);
    return { runId: work.runId, state: "failed" };
  }

  return {
    async drainQueued() {
      const outcomes: RunOutcome[] = [];
      for (const work of queue.listQueuedRuns()) {
        const outcome = await run(work);
        if (outcome !== undefined) {
          outcomes.push(outcome);
        }
      }
      return outcomes;
    },
    async cancel(runId) {
      const handle = active.get(runId);
      if (handle === undefined) {
        return false;
      }
      cancelled.add(runId);
      await handle.cancel("user");
      queue.recordProviderEvent(runId, {
        type: "failed",
        code: "provider_cancelled",
        safeMessage: "The owner cancelled this run.",
        retryable: true,
      });
      queue.transitionRun({
        runId,
        from: "running",
        to: "cancelled",
      });
      active.delete(runId);
      return true;
    },
  };
}
