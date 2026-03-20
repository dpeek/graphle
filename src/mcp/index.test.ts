import { describe, expect, it } from "bun:test";

import { parseMcpCliArgs, runMcpCli } from "./index.js";

describe("parseMcpCliArgs", () => {
  it("parses the graph command url and write gate", () => {
    expect(parseMcpCliArgs(["graph", "--allow-writes", "--url", "http://graph.test:1455"])).toEqual(
      {
        kind: "graph",
        options: {
          allowWrites: true,
          url: "http://graph.test:1455/",
        },
      },
    );
  });

  it("treats graph help as top-level help", () => {
    expect(parseMcpCliArgs(["graph", "--help"])).toEqual({ kind: "help" });
  });

  it("rejects unknown commands", () => {
    expect(() => parseMcpCliArgs(["unknown"])).toThrow("Unknown mcp command: unknown");
  });

  it("rejects a missing graph url value", () => {
    expect(() => parseMcpCliArgs(["graph", "--url"])).toThrow(
      "Usage: io mcp graph [--url <url>] [--allow-writes]",
    );
  });
});

describe("runMcpCli", () => {
  it("dispatches the parsed graph options", async () => {
    let receivedAllowWrites = false;
    let receivedUrl: string | undefined;

    await runMcpCli(["graph", "--allow-writes", "--url", "http://graph.test"], {
      async graph(options) {
        receivedAllowWrites = options.allowWrites ?? false;
        receivedUrl = options.url;
      },
    });

    expect(receivedAllowWrites).toBe(true);
    expect(receivedUrl).toBe("http://graph.test/");
  });
});
