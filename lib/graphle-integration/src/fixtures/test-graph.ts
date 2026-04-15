import { createBootstrappedSnapshot } from "@dpeek/graphle-bootstrap";
import { createGraphClient } from "@dpeek/graphle-client";
import { createGraphStore } from "@dpeek/graphle-kernel";
import { core, coreGraphBootstrapOptions } from "@dpeek/graphle-module-core";

import { kitchenSink } from "./kitchen-sink.js";

export const testNamespace = kitchenSink;
export const testDefs = { ...core, ...testNamespace };

export function createTestStore() {
  return createGraphStore(createBootstrappedSnapshot(testDefs, coreGraphBootstrapOptions));
}

export function createTestGraph() {
  const store = createTestStore();

  return {
    store,
    coreGraph: createGraphClient(store, core),
    graph: createGraphClient(store, testNamespace, testDefs),
  };
}
