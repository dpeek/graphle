import { describe, expect, it } from "bun:test";

import { pkm } from "../modules/pkm.js";
import { bootstrap } from "./bootstrap";
import { GraphValidationError, createTypeClient } from "./client";
import { core } from "./core";
import { createHttpGraphClient, defaultHttpGraphUrl, type FetchImpl } from "./http-client";
import { createIdMap, defineNamespace } from "./identity";
import { defineType, edgeId, typeId } from "./schema";
import { createStore } from "./store";
import {
  createAuthoritativeGraphWriteSession,
  createIncrementalSyncFallback,
  createIncrementalSyncPayload,
  createModuleSyncScope,
  createSyncedTypeClient,
  createTotalSyncPayload,
  type AuthoritativeGraphWriteResult,
  type GraphWriteTransaction,
  type SyncPayload,
} from "./sync";

const item = defineType({
  values: { key: "test:item", name: "Item" },
  fields: {
    ...core.node.fields,
  },
});

const testGraph = defineNamespace(createIdMap({ item }).map, { item });

function createAuthority() {
  const store = createStore();
  bootstrap(store, core);
  bootstrap(store, testGraph);
  const graph = createTypeClient(store, testGraph);
  graph.item.create({ name: "Seeded item" });
  const writes = createAuthoritativeGraphWriteSession(store, testGraph, {
    cursorPrefix: "server:",
  });

  return {
    store,
    graph,
    writes,
  };
}

function createMockFetch(authority: ReturnType<typeof createAuthority>): FetchImpl {
  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);

    if (url.pathname === "/api/sync") {
      const after = url.searchParams.get("after") ?? undefined;
      const payload: SyncPayload = after
        ? authority.writes.getIncrementalSyncResult(after)
        : createTotalSyncPayload(authority.store, {
            cursor: authority.writes.getCursor() ?? authority.writes.getBaseCursor(),
          });
      return Response.json(payload);
    }

    if (url.pathname === "/api/tx" && request.method === "POST") {
      const transaction = (await request.json()) as GraphWriteTransaction;
      const result: AuthoritativeGraphWriteResult = authority.writes.apply(transaction);
      return Response.json(result);
    }

    return Response.json({ error: `Unhandled ${request.method} ${url.pathname}` }, { status: 404 });
  };
}

describe("createHttpGraphClient", () => {
  it("uses the localhost default base url", () => {
    expect(defaultHttpGraphUrl).toBe("http://io.localhost:1355/");
  });

  it("bootstraps from sync and pushes writes over http", async () => {
    const authority = createAuthority();
    const fetch = createMockFetch(authority);

    const client = await createHttpGraphClient(testGraph, {
      fetch,
      createTxId: () => "cli:1",
    });

    expect(client.graph.item.list().map((entity) => entity.name)).toEqual(["Seeded item"]);

    client.graph.item.create({ name: "Created from client" });
    const results = await client.sync.flush();

    expect(results.map((result) => result.txId)).toEqual(["cli:1"]);
    expect(authority.graph.item.list().map((entity) => entity.name)).toEqual([
      "Seeded item",
      "Created from client",
    ]);

    const peer = await createHttpGraphClient(testGraph, {
      fetch,
      createTxId: () => "cli:2",
    });

    expect(peer.graph.item.list().map((entity) => entity.name)).toEqual([
      "Seeded item",
      "Created from client",
    ]);
  });

  it("preserves one requested module scope across scoped bootstrap and refresh requests", async () => {
    const authority = createAuthority();
    const requestedScope = {
      kind: "module" as const,
      moduleId: "ops/workflow",
      scopeId: "scope:ops/workflow:review",
    };
    const deliveredScope = createModuleSyncScope({
      moduleId: requestedScope.moduleId,
      scopeId: requestedScope.scopeId,
      definitionHash: "scope-def:v1",
      policyFilterVersion: "policy:v1",
    });
    const requestedUrls: string[] = [];
    let syncCount = 0;
    const fetch: FetchImpl = async (input, init) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      const url = new URL(request.url);

      if (url.pathname === "/api/sync") {
        requestedUrls.push(url.toString());
        syncCount += 1;
        const payload: SyncPayload =
          syncCount === 1
            ? createTotalSyncPayload(authority.store, {
                scope: deliveredScope,
                cursor: "module:1",
                freshness: "stale",
              })
            : createIncrementalSyncPayload([], {
                after: "module:1",
                cursor: "module:2",
                scope: deliveredScope,
                freshness: "current",
              });
        return Response.json(payload);
      }

      if (url.pathname === "/api/tx" && request.method === "POST") {
        const transaction = (await request.json()) as GraphWriteTransaction;
        const result: AuthoritativeGraphWriteResult = authority.writes.apply(transaction);
        return Response.json(result);
      }

      return Response.json(
        { error: `Unhandled ${request.method} ${url.pathname}` },
        { status: 404 },
      );
    };

    const client = await createHttpGraphClient(testGraph, {
      fetch,
      requestedScope,
    });

    await client.sync.sync();

    expect(client.sync.getState()).toMatchObject({
      requestedScope,
      scope: deliveredScope,
      cursor: "module:2",
      status: "ready",
    });
    expect(requestedUrls).toEqual([
      "http://io.localhost:1355/api/sync?scopeKind=module&moduleId=ops%2Fworkflow&scopeId=scope%3Aops%2Fworkflow%3Areview",
      "http://io.localhost:1355/api/sync?after=module%3A1&scopeKind=module&moduleId=ops%2Fworkflow&scopeId=scope%3Aops%2Fworkflow%3Areview",
    ]);
  });

  it("surfaces scoped fallback without widening and recovers through a new whole-graph bootstrap", async () => {
    const authority = createAuthority();
    const requestedScope = {
      kind: "module" as const,
      moduleId: "ops/workflow",
      scopeId: "scope:ops/workflow:review",
    };
    const deliveredScope = createModuleSyncScope({
      moduleId: requestedScope.moduleId,
      scopeId: requestedScope.scopeId,
      definitionHash: "scope-def:v1",
      policyFilterVersion: "policy:v1",
    });
    const requestedUrls: string[] = [];

    const fetch: FetchImpl = async (input, init) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      const url = new URL(request.url);

      if (url.pathname === "/api/sync") {
        requestedUrls.push(url.toString());
        const after = url.searchParams.get("after");
        const scopeKind = url.searchParams.get("scopeKind");
        const payload: SyncPayload =
          scopeKind === "module" && !after
            ? createTotalSyncPayload(authority.store, {
                scope: deliveredScope,
                cursor: "module:1",
                completeness: "incomplete",
                freshness: "stale",
              })
            : scopeKind === "module" && after === "module:1"
              ? createIncrementalSyncFallback("policy-changed", {
                  after,
                  cursor: "module:2",
                  scope: deliveredScope,
                  completeness: "incomplete",
                  freshness: "current",
                })
              : createTotalSyncPayload(authority.store, {
                  cursor: "graph:1",
                  freshness: "current",
                });
        return Response.json(payload);
      }

      if (url.pathname === "/api/tx" && request.method === "POST") {
        const transaction = (await request.json()) as GraphWriteTransaction;
        const result: AuthoritativeGraphWriteResult = authority.writes.apply(transaction);
        return Response.json(result);
      }

      return Response.json(
        { error: `Unhandled ${request.method} ${url.pathname}` },
        { status: 404 },
      );
    };

    const scopedClient = await createHttpGraphClient(testGraph, {
      fetch,
      requestedScope,
    });

    await expect(scopedClient.sync.sync()).rejects.toBeInstanceOf(GraphValidationError);
    expect(scopedClient.sync.getState()).toMatchObject({
      requestedScope,
      scope: deliveredScope,
      cursor: "module:1",
      completeness: "incomplete",
      freshness: "stale",
      fallback: "policy-changed",
      status: "error",
    });

    const recovered = await createHttpGraphClient(testGraph, {
      fetch,
    });

    expect(recovered.sync.getState()).toMatchObject({
      requestedScope: { kind: "graph" },
      scope: { kind: "graph" },
      cursor: "graph:1",
      freshness: "current",
      status: "ready",
    });
    expect(requestedUrls).toEqual([
      "http://io.localhost:1355/api/sync?scopeKind=module&moduleId=ops%2Fworkflow&scopeId=scope%3Aops%2Fworkflow%3Areview",
      "http://io.localhost:1355/api/sync?after=module%3A1&scopeKind=module&moduleId=ops%2Fworkflow&scopeId=scope%3Aops%2Fworkflow%3Areview",
      "http://io.localhost:1355/api/sync?scopeKind=graph",
    ]);
  });

  it("does not resurrect bootstrapped retracted facts during total sync", async () => {
    const authorityStore = createStore();
    bootstrap(authorityStore, core);
    bootstrap(authorityStore, pkm);

    const topicTypeId = typeId(pkm.topic);
    const topicNamePredicateId = edgeId(core.node.fields.name);
    const currentNameEdge = authorityStore.facts(topicTypeId, topicNamePredicateId)[0];
    if (!currentNameEdge) throw new Error("Expected bootstrapped topic name edge.");

    authorityStore.batch(() => {
      authorityStore.retract(currentNameEdge.id);
      authorityStore.assert(topicTypeId, topicNamePredicateId, "Topics");
    });

    const payload = createTotalSyncPayload(authorityStore, {
      cursor: "server:1",
      namespace: pkm,
    });

    const client = createSyncedTypeClient(pkm, {
      createTxId: () => "cli:1",
      pull: async () => payload,
    });

    await expect(client.sync.sync()).resolves.toMatchObject({
      mode: "total",
      cursor: "server:1",
    });
    expect(client.graph.topic.get(topicTypeId)?.name).toBe("Topics");
  });
});
