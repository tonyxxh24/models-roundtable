import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IncrementalJsonlDecoder, parseJsonRecord } from "./index.js";

interface FixtureCase {
  readonly name: string;
  readonly chunks?: readonly string[];
  readonly chunksBase64?: readonly string[];
  readonly expectedRecords?: readonly string[];
  readonly expectedDecodedRecord?: string;
  readonly expectedRemainder?: string;
  readonly expectedJsonValidity?: boolean;
}

const fixtures = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      "..",
      "..",
      "fixtures",
      "providers",
      "common",
      "synthetic-chunks.json",
    ),
    "utf8",
  ),
) as { readonly cases: readonly FixtureCase[] };

describe("incremental provider JSONL decoding", () => {
  for (const fixture of fixtures.cases) {
    it(fixture.name, () => {
      const decoder = new IncrementalJsonlDecoder();
      const records: string[] = [];
      for (const chunk of fixture.chunks ?? []) {
        records.push(...decoder.push(chunk));
      }
      for (const chunk of fixture.chunksBase64 ?? []) {
        records.push(...decoder.push(Buffer.from(chunk, "base64")));
      }
      const finished = decoder.finish();
      records.push(...finished.records);

      expect(records).toEqual(
        fixture.expectedRecords ??
          (fixture.expectedDecodedRecord === undefined
            ? []
            : [fixture.expectedDecodedRecord]),
      );
      expect(finished.remainder).toBe(fixture.expectedRemainder ?? "");
      if (fixture.expectedJsonValidity !== undefined) {
        expect(parseJsonRecord(records[0] ?? "").ok).toBe(
          fixture.expectedJsonValidity,
        );
      }
    });
  }

  it("keeps unknown valid events as data without throwing", () => {
    const record = readFileSync(
      join(
        process.cwd(),
        "..",
        "..",
        "fixtures",
        "providers",
        "common",
        "unknown-event.jsonl",
      ),
      "utf8",
    ).trim();
    expect(parseJsonRecord(record)).toMatchObject({
      ok: true,
      value: { type: "future_provider_event" },
    });
  });
});
