export type ParticipantKind = "human" | "agent" | "system";

export interface MentionParticipant {
  readonly id: string;
  readonly handle: string;
  readonly kind: ParticipantKind;
  readonly enabled: boolean;
}

export interface ParsedMention {
  readonly sourceHandle: string;
  readonly startOffset: number;
  readonly endOffset: number;
}

export type MentionResolution =
  | {
      readonly kind: "participant";
      readonly mention: ParsedMention;
      readonly participantId: string;
    }
  | {
      readonly kind: "group";
      readonly mention: ParsedMention;
      readonly participantIds: readonly string[];
    }
  | { readonly kind: "unknown"; readonly mention: ParsedMention }
  | { readonly kind: "disabled"; readonly mention: ParsedMention };

export function normalizeHandle(handle: string): string {
  return handle.normalize("NFC").replace(/^@/u, "").toLocaleLowerCase("en-US");
}

function isHandleCharacter(value: string): boolean {
  return /[\p{L}\p{N}_-]/u.test(value);
}

function startsFencedCode(body: string, index: number): boolean {
  return body.startsWith("\u0060\u0060\u0060", index);
}

export function parseMentions(body: string): readonly ParsedMention[] {
  const mentions: ParsedMention[] = [];
  let inInlineCode = false;
  let inFencedCode = false;

  for (let index = 0; index < body.length; index += 1) {
    if (startsFencedCode(body, index)) {
      inFencedCode = !inFencedCode;
      index += 2;
      continue;
    }
    if (inFencedCode) {
      continue;
    }
    if (body[index] === "\u0060") {
      inInlineCode = !inInlineCode;
      continue;
    }
    if (inInlineCode) {
      continue;
    }
    if (body[index] === "\\") {
      index += 1;
      continue;
    }
    if (body[index] !== "@") {
      continue;
    }

    const prior = body[index - 1];
    if (prior !== undefined && /[\p{L}\p{N}._%+-]/u.test(prior)) {
      continue;
    }
    const tokenStart = Math.max(
      body.lastIndexOf(" ", index),
      body.lastIndexOf("\n", index),
    );
    const tokenPrefix = body.slice(tokenStart + 1, index);
    if (/^(https?:\/\/|www\.)/iu.test(tokenPrefix)) {
      continue;
    }
    const start = index + 1;
    let end = start;
    while (end < body.length && isHandleCharacter(body[end] ?? "")) {
      end += 1;
    }
    if (end === start) {
      continue;
    }
    mentions.push({
      sourceHandle: body.slice(start, end),
      startOffset: index,
      endOffset: end,
    });
    index = end - 1;
  }

  return mentions;
}

export function resolveMentions(
  mentions: readonly ParsedMention[],
  participants: readonly MentionParticipant[],
): readonly MentionResolution[] {
  const byHandle = new Map(
    participants.map((participant) => [
      normalizeHandle(participant.handle),
      participant,
    ]),
  );

  return mentions.map((mention) => {
    const normalized = normalizeHandle(mention.sourceHandle);
    const group =
      normalized === "all" ||
      normalized === "models" ||
      normalized === "humans";
    if (group) {
      const participantIds = participants
        .filter((participant) => {
          if (!participant.enabled) {
            return false;
          }
          if (normalized === "all") {
            return participant.kind !== "system";
          }
          return (
            participant.kind === (normalized === "models" ? "agent" : "human")
          );
        })
        .map((participant) => participant.id);
      return { kind: "group", mention, participantIds };
    }

    const participant = byHandle.get(normalized);
    if (participant === undefined) {
      return { kind: "unknown", mention };
    }
    if (!participant.enabled) {
      return { kind: "disabled", mention };
    }
    return { kind: "participant", mention, participantId: participant.id };
  });
}

export function resolvedAgentTargetIds(
  resolutions: readonly MentionResolution[],
  participants: readonly MentionParticipant[],
): readonly string[] {
  const agents = new Set(
    participants
      .filter(
        (participant) => participant.kind === "agent" && participant.enabled,
      )
      .map((participant) => participant.id),
  );
  const targetIds = new Set<string>();
  for (const resolution of resolutions) {
    if (
      resolution.kind === "participant" &&
      agents.has(resolution.participantId)
    ) {
      targetIds.add(resolution.participantId);
    }
    if (resolution.kind === "group") {
      for (const participantId of resolution.participantIds) {
        if (agents.has(participantId)) {
          targetIds.add(participantId);
        }
      }
    }
  }
  return [...targetIds];
}
