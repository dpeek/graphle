import { createStore } from "@dpeek/graphle-app/graph";
import { createBootstrappedSnapshot } from "@dpeek/graphle-bootstrap";
import { createGraphClient } from "@dpeek/graphle-client";
import { core, coreGraphBootstrapOptions } from "@dpeek/graphle-module-core";

import { kitchenSink } from "./testing/kitchen-sink.js";

export const testNamespace = kitchenSink;
export const testDefs = { ...core, ...testNamespace };

export function createTestStore() {
  return createStore(createBootstrappedSnapshot(testDefs, coreGraphBootstrapOptions));
}

export function createTestGraph() {
  const store = createTestStore();

  return {
    store,
    coreGraph: createGraphClient(store, core),
    graph: createGraphClient(store, testNamespace, testDefs),
  };
}
