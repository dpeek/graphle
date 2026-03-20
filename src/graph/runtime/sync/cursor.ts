import type { IncrementalSyncFallbackReason } from "./contracts";

export function parseAuthoritativeGraphCursor(cursor: string): {
  prefix: string;
  sequence: number;
} | null {
  const match = /^(.*?)(\d+)$/.exec(cursor);
  if (!match) return null;

  return {
    prefix: match[1] ?? "",
    sequence: Number.parseInt(match[2] ?? "", 10),
  };
}

export function isCursorAtOrAfter(
  cursor: { prefix: string; sequence: number },
  previous: { prefix: string; sequence: number },
): boolean {
  return cursor.prefix === previous.prefix && cursor.sequence >= previous.sequence;
}

export function classifyIncrementalSyncFallbackReason(
  cursor: string,
  options: {
    cursorPrefix: string;
    baseSequence: number;
  },
): IncrementalSyncFallbackReason {
  const parsed = parseAuthoritativeGraphCursor(cursor);
  if (!parsed) return "unknown-cursor";
  if (parsed.prefix !== options.cursorPrefix) return "reset";
  if (parsed.sequence < options.baseSequence) return "gap";
  return "unknown-cursor";
}

export function formatAuthoritativeGraphCursor(cursorPrefix: string, sequence: number): string {
  return `${cursorPrefix}${sequence}`;
}
