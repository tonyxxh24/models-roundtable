import type {
  ProviderAdapter,
  ProviderEvent,
  ProviderRunHandle,
  ProviderRunRequest,
} from "@models-roundtable/contracts";

export interface FakeProviderScript {
  readonly sessionId: string;
  readonly events: readonly ProviderEvent[];
  readonly hangWhenPromptIncludes?: string | undefined;
}

export interface FakeAdapter extends ProviderAdapter {
  readonly requests: readonly ProviderRunRequest[];
}

export function createFakeAdapter(script: FakeProviderScript): FakeAdapter {
  const requests: ProviderRunRequest[] = [];
  const consumedHangs = new Set<string>();

  async function execute(
    request: ProviderRunRequest,
    providerSessionId: string,
  ): Promise<ProviderRunHandle> {
    requests.push(request);
    const hangKey = request.agentId + "\u0000" + request.prompt;
    const shouldHang =
      script.hangWhenPromptIncludes !== undefined &&
      request.prompt.includes(script.hangWhenPromptIncludes) &&
      !consumedHangs.has(hangKey);
    if (shouldHang) {
      consumedHangs.add(hangKey);
    }
    let cancelled = false;
    let releaseHang: (() => void) | undefined;
    const hangReleased = new Promise<void>((resolve) => {
      releaseHang = resolve;
    });
    return {
      runToken: "fake:" + request.runId,
      events: (async function* (): AsyncGenerator<ProviderEvent> {
        yield { type: "session_started", providerSessionId };
        for (const event of script.events) {
          if (cancelled) {
            return;
          }
          yield event;
          if (event.type === "text_delta" && shouldHang) {
            await hangReleased;
          }
        }
      })(),
      cancel: async () => {
        cancelled = true;
        releaseHang?.();
      },
    };
  }

  return {
    id: "fake",
    requests,
    start: async (request) =>
      execute(request, script.sessionId + ":" + request.agentId),
    continue: async (request) => execute(request, request.providerSessionId),
  };
}
