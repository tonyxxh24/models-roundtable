import { describe, expect, it } from "vitest";
import { healthResponseSchema, serverEventSchema } from "./index.js";

describe("runtime contracts", () => {
  it("accepts the version one health response", () => {
    expect(
      healthResponseSchema.parse({
        protocolVersion: 1,
        status: "ready",
        database: "ready",
        checkedAt: "2026-07-23T00:00:00.000Z",
      }),
    ).toMatchObject({
      protocolVersion: 1,
      status: "ready",
    });
  });

  it("rejects a server event from another protocol version", () => {
    expect(() =>
      serverEventSchema.parse({
        v: 2,
        eventId: "event",
        type: "run.completed",
        occurredAt: "2026-07-23T00:00:00.000Z",
        payload: {},
      }),
    ).toThrow();
  });
});
