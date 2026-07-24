import type {
  ProviderAdapter,
  ProviderEvent,
  ProviderRunRequest,
} from "@models-roundtable/contracts";

const normalizedEventTypes = new Set<ProviderEvent["type"]>([
  "session_started",
  "text_delta",
  "tool_started",
  "warning",
  "completed",
  "failed",
]);
const maximumContractEvents = 1_000;

export interface AdapterContractScenario {
  readonly mode: "start" | "continue";
  readonly request: ProviderRunRequest;
  readonly providerSessionId?: string;
}

export interface AdapterContractResult {
  readonly runToken: string;
  readonly events: readonly ProviderEvent[];
}

function assertContract(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) throw new Error("Provider adapter contract: " + message);
}

/**
 * Exercises provider-neutral invariants without inspecting native transports.
 * Provider packages supply deterministic success or safe pre-spawn failures.
 */
export async function exerciseProviderAdapterContract(
  adapter: ProviderAdapter,
  scenario: AdapterContractScenario,
): Promise<AdapterContractResult> {
  assertContract(adapter.id.trim().length > 0, "adapter id must be non-empty");
  const handle =
    scenario.mode === "start"
      ? await adapter.start(scenario.request)
      : await adapter.continue({
          ...scenario.request,
          providerSessionId:
            scenario.providerSessionId ?? "contract-provider-session",
        });
  assertContract(
    handle.runToken.trim().length > 0,
    "run token must be non-empty",
  );

  const events: ProviderEvent[] = [];
  for await (const event of handle.events) {
    assertContract(
      normalizedEventTypes.has(event.type),
      "adapter emitted an unknown normalized event type",
    );
    events.push(event);
    assertContract(
      events.length <= maximumContractEvents,
      "adapter exceeded the bounded contract event count",
    );
  }
  const terminalIndexes = events.flatMap((event, index) =>
    event.type === "completed" || event.type === "failed" ? [index] : [],
  );
  assertContract(
    terminalIndexes.length === 1,
    "run must emit one terminal event",
  );
  assertContract(
    terminalIndexes[0] === events.length - 1,
    "terminal event must be last",
  );
  if (events.at(-1)?.type === "completed") {
    assertContract(
      events.some((event) => event.type === "session_started"),
      "a successful run must identify its provider session",
    );
  }
  await handle.cancel("shutdown");
  await handle.cancel("shutdown");
  return { runToken: handle.runToken, events };
}
