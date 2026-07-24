import { describe, expect, it } from "vitest";
import {
  parseMentions,
  resolvedAgentTargetIds,
  resolveMentions,
  type MentionParticipant,
} from "./mentions.js";

const participants: readonly MentionParticipant[] = [
  { id: "human", handle: "owner", kind: "human", enabled: true },
  { id: "fake-a", handle: "fakeA", kind: "agent", enabled: true },
  { id: "fake-b", handle: "fakeB", kind: "agent", enabled: true },
  { id: "disabled", handle: "sleeping", kind: "agent", enabled: false },
];

describe("Markdown-aware mention parsing", () => {
  it("ignores escaped, inline-code, fenced-code, URL, and email at-signs", () => {
    const body = [
      "@fakeA hello \\@fakeB and \u0060@fakeB\u0060.",
      "email@example.test https://example.test/@fakeB",
      "\u0060\u0060\u0060",
      "@fakeB",
      "\u0060\u0060\u0060",
      "@all",
    ].join(String.fromCharCode(10));

    expect(parseMentions(body).map((mention) => mention.sourceHandle)).toEqual([
      "fakeA",
      "all",
    ]);
  });

  it("expands groups deterministically but creates runs only for enabled agents", () => {
    const resolutions = resolveMentions(
      parseMentions("@all @sleeping @unknown"),
      participants,
    );
    expect(resolvedAgentTargetIds(resolutions, participants)).toEqual([
      "fake-a",
      "fake-b",
    ]);
    expect(resolutions.map((resolution) => resolution.kind)).toEqual([
      "group",
      "disabled",
      "unknown",
    ]);
  });
});
