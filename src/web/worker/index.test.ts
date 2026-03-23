import { describe, expect, it } from "bun:test";

import worker from "./index.js";

describe("web worker route forwarding", () => {
  it("forwards the canonical web-owned /api/commands proof to the graph authority durable object", async () => {
    const authorityPaths: string[] = [];
    const env = {
      ASSETS: {
        async fetch() {
          return new Response("asset");
        },
      },
      GRAPH_AUTHORITY: {
        idFromName(name: string) {
          expect(name).toBe("global");
          return "graph-authority-id";
        },
        get(id: unknown) {
          expect(id).toBe("graph-authority-id");
          return {
            async fetch(request: Request) {
              authorityPaths.push(new URL(request.url).pathname);
              return new Response("ok");
            },
          };
        },
      },
    } satisfies Parameters<typeof worker.fetch>[1];

    const commandResponse = await worker.fetch(
      new Request("https://web.local/api/commands", {
        method: "POST",
      }),
      env,
    );

    expect(commandResponse.status).toBe(200);
    expect(authorityPaths).toEqual(["/api/commands"]);
  });

  it("does not forward removed /api/secret-fields requests to the graph authority durable object", async () => {
    const assetPaths: string[] = [];
    const authorityPaths: string[] = [];
    const env = {
      ASSETS: {
        async fetch(request: Request) {
          assetPaths.push(new URL(request.url).pathname);
          return new Response("missing", { status: 404 });
        },
      },
      GRAPH_AUTHORITY: {
        idFromName() {
          return "graph-authority-id";
        },
        get() {
          return {
            async fetch(request: Request) {
              authorityPaths.push(new URL(request.url).pathname);
              return new Response("ok");
            },
          };
        },
      },
    } satisfies Parameters<typeof worker.fetch>[1];

    const response = await worker.fetch(
      new Request("https://web.local/api/secret-fields", {
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(404);
    expect(assetPaths).toEqual(["/api/secret-fields"]);
    expect(authorityPaths).toEqual([]);
  });
});
