import { bootstrap, createStore, createTypeClient } from "@io/core/graph";
import { core } from "@io/core/graph/modules";

import { kitchenSink } from "./testing/kitchen-sink.js";

export const testNamespace = kitchenSink;
export const testDefs = { ...core, ...testNamespace };

export function createTestGraph() {
  const store = createStore();
  bootstrap(store, core);
  bootstrap(store, testNamespace);

  return {
    store,
    coreGraph: createTypeClient(store, core),
    graph: createTypeClient(store, testNamespace),
  };
}
