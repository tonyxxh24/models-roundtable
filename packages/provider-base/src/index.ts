export interface JsonlFinishResult {
  readonly records: readonly string[];
  readonly remainder: string;
}

export type JsonRecordResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly safeMessage: string };

export class IncrementalJsonlDecoder {
  readonly #decoder = new TextDecoder("utf-8", { fatal: false });
  #buffer = "";

  push(chunk: Uint8Array | string): readonly string[] {
    this.#buffer +=
      typeof chunk === "string"
        ? chunk
        : this.#decoder.decode(chunk, { stream: true });
    return this.#takeCompleteRecords();
  }

  finish(): JsonlFinishResult {
    this.#buffer += this.#decoder.decode();
    const records = this.#takeCompleteRecords();
    return { records, remainder: this.#buffer };
  }

  #takeCompleteRecords(): readonly string[] {
    const records: string[] = [];
    while (true) {
      const newline = this.#buffer.indexOf("\n");
      if (newline < 0) {
        return records;
      }
      const line = this.#buffer.slice(0, newline).replace(/\r$/, "");
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line.length > 0) {
        records.push(line);
      }
    }
  }
}

export function parseJsonRecord(record: string): JsonRecordResult {
  try {
    return { ok: true, value: JSON.parse(record) as unknown };
  } catch {
    return {
      ok: false,
      safeMessage: "Provider emitted a malformed JSONL record.",
    };
  }
}
