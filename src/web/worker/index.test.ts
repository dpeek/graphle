import { describe, expect, it } from "bun:test";

import type { AuthorizationContext } from "@io/core/graph";

import { readRequestAuthorizationContext } from "../lib/server-routes.js";
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

  it("forwards graph writes with the provisional operator authorization context", async () => {
    let forwardedAuthorization: AuthorizationContext | null = null;
    let forwardedPath = "";
    const env = {
      ASSETS: {
        async fetch() {
          return new Response("asset");
        },
      },
      GRAPH_AUTHORITY: {
        idFromName() {
          return "graph-authority-id";
        },
        get() {
          return {
            async fetch(request: Request) {
              forwardedPath = new URL(request.url).pathname;
              forwardedAuthorization = readRequestAuthorizationContext(request);
              return new Response("ok");
            },
          };
        },
      },
    } satisfies Parameters<typeof worker.fetch>[1];

    const response = await worker.fetch(
      new Request("https://web.local/api/tx", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: "tx:web:1",
          ops: [],
        }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(forwardedPath).toBe("/api/tx");
    const authorization = forwardedAuthorization as AuthorizationContext | null;
    if (!authorization) {
      throw new Error("Expected the worker to forward an authorization context.");
    }
    expect(authorization.graphId).toBe("graph:global");
    expect(authorization.principalId).toBe("principal:web-operator");
    expect(authorization.principalKind).toBe("service");
    expect(authorization.sessionId).toBe("session:web-operator");
    expect(authorization.roleKeys).toEqual(["graph:authority"]);
    expect(authorization.capabilityGrantIds).toEqual([]);
    expect(authorization.capabilityVersion).toBe(0);
    expect(authorization.policyVersion).toBe(0);
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
