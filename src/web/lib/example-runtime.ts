import {
  type AuthoritativeGraphWriteResult,
  type AuthoritativeWriteScope,
  bootstrap,
  createAuthoritativeGraphWriteSession,
  createSyncedTypeClient,
  createStore,
  createTotalSyncPayload,
  createTypeClient,
  type GraphWriteTransaction,
  type IncrementalSyncResult,
  type SyncedTypeClient,
  type SyncFreshness,
  type TotalSyncPayload,
} from "@io/core/graph";
import { core } from "@io/core/graph/modules";
import { ops } from "@io/core/graph/modules/ops";
import { pkm } from "@io/core/graph/modules/pkm";

import { seedExampleGraph } from "./example-data.js";

const productGraph = { ...core, ...pkm, ...ops } as const;

function createExampleAuthorityGraph() {
  const store = createStore();
  bootstrap(store, core);
  bootstrap(store, pkm);
  bootstrap(store, ops);

  const graph = createTypeClient(store, productGraph);
  const ids = seedExampleGraph(createTypeClient(store, productGraph));

  return {
    store,
    graph,
    ids,
  };
}

export type ExampleSyncedClient = SyncedTypeClient<typeof productGraph>;

export function createExampleRuntime() {
  const authority = createExampleAuthorityGraph();
  let writes = createAuthoritativeGraphWriteSession(authority.store, productGraph, {
    cursorPrefix: "example:",
  });
  const clients = new Set<ExampleSyncedClient>();
  const pendingTxIds = new WeakMap<ExampleSyncedClient, string[]>();
  let localTxSequence = 0;
  let syncPayloadCount = 0;

  function createSyncPayload(): TotalSyncPayload {
    syncPayloadCount += 1;
    return createTotalSyncPayload(authority.store, {
      cursor: writes.getCursor() ?? writes.getBaseCursor(),
    });
  }

  function getIncrementalSyncResult(
    after?: string,
    options?: {
      freshness?: SyncFreshness;
    },
  ): IncrementalSyncResult {
    return writes.getIncrementalSyncResult(after, options);
  }

  function applyTransaction(
    transaction: GraphWriteTransaction,
    options?: { writeScope?: AuthoritativeWriteScope },
  ): AuthoritativeGraphWriteResult {
    return writes.apply(transaction, options);
  }

  function resetAuthorityStream(cursorPrefix = "reset:"): string {
    writes = createAuthoritativeGraphWriteSession(authority.store, productGraph, {
      cursorPrefix,
    });
    return writes.getBaseCursor();
  }

  function createClient(): ExampleSyncedClient {
    let client: ExampleSyncedClient;
    const queuedTxIds: string[] = [];
    client = createSyncedTypeClient(productGraph, {
      pull: (state) =>
        state.cursor ? getIncrementalSyncResult(state.cursor) : createSyncPayload(),
      createTxId() {
        return queuedTxIds.shift() ?? `example:local:${++localTxSequence}`;
      },
      push: applyTransaction,
    });
    client.sync.apply(createSyncPayload());
    pendingTxIds.set(client, queuedTxIds);
    clients.add(client);
    return client;
  }

  function applyAuthoritativeWrite(
    result: AuthoritativeGraphWriteResult,
  ): AuthoritativeGraphWriteResult {
    for (const client of clients) {
      client.sync.applyWriteResult(result);
    }
    return result;
  }

  function commitLocalMutation(
    client: ExampleSyncedClient,
    txId: string,
    mutate: (graph: ExampleSyncedClient["graph"]) => void,
  ): Promise<AuthoritativeGraphWriteResult> {
    pendingTxIds.get(client)?.push(txId);
    mutate(client.graph);
    if (client.sync.getPendingTransactions().length === 0) {
      throw new Error(`Local mutation for "${txId}" did not change the graph.`);
    }

    return client.sync.flush().then((results) => {
      const result = results[results.length - 1];
      if (!result) {
        throw new Error("Expected synced flush to return an authoritative write result.");
      }
      return result;
    });
  }

  function createPeer(): ExampleSyncedClient {
    return createClient();
  }

  const runtime = createClient();
  return Object.assign(runtime, {
    pkm,
    ops,
    ids: authority.ids,
    createPeer,
    commitLocalMutation,
    applyAuthoritativeWrite,
    authority: {
      ...authority,
      applyTransaction,
      createSyncPayload,
      getIncrementalSyncResult,
      resetAuthorityStream,
      getBaseCursor() {
        return writes.getBaseCursor();
      },
      getSyncPayloadCount() {
        return syncPayloadCount;
      },
    },
  });
}
