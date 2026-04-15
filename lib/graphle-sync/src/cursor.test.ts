import { describe, expect, it } from "bun:test";

import {
  classifyIncrementalSyncFallbackReason,
  formatAuthoritativeGraphCursor,
  isCursorAtOrAfter,
  parseAuthoritativeGraphCursor,
} from "./cursor";

describe("cursor helpers", () => {
  it("parses cursors with a numeric suffix", () => {
    expect(parseAuthoritativeGraphCursor("server:42")).toEqual({
      prefix: "server:",
      sequence: 42,
    });
  });

  it("returns null for cursors without a numeric suffix", () => {
    expect(parseAuthoritativeGraphCursor("server:head")).toBeNull();
  });

  it("compares cursors only within the same prefix", () => {
    expect(
      isCursorAtOrAfter({ prefix: "server:", sequence: 4 }, { prefix: "server:", sequence: 3 }),
    ).toBe(true);
    expect(
      isCursorAtOrAfter({ prefix: "server:", sequence: 2 }, { prefix: "other:", sequence: 9 }),
    ).toBe(false);
  });

  it("classifies unknown, gap, and reset fallback reasons", () => {
    expect(
      classifyIncrementalSyncFallbackReason("server:head", {
        cursorPrefix: "server:",
        baseSequence: 3,
      }),
    ).toBe("unknown-cursor");
    expect(
      classifyIncrementalSyncFallbackReason("server:1", {
        cursorPrefix: "server:",
        baseSequence: 3,
      }),
    ).toBe("gap");
    expect(
      classifyIncrementalSyncFallbackReason("reset:7", {
        cursorPrefix: "server:",
        baseSequence: 3,
      }),
    ).toBe("reset");
  });

  it("formats cursors from a prefix and sequence", () => {
    expect(formatAuthoritativeGraphCursor("server:", 9)).toBe("server:9");
  });
});
