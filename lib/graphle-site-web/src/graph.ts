import {
  createGraphClient,
  createHttpGraphClient,
  type GraphClient,
  type HttpGraphClientOptions,
  type SyncedGraphClient,
} from "@dpeek/graphle-client";
import { createGraphStore, type GraphStore, type GraphStoreSnapshot } from "@dpeek/graphle-kernel";
import { colorType, minimalCore, tag } from "@dpeek/graphle-module-core";
import {
  assertPublicSiteGraphBaselineCompatible,
  site,
  type PublicSiteGraphBaseline,
} from "@dpeek/graphle-module-site";

export type GraphleSiteGraphNamespace = typeof site & {
  readonly tag: typeof tag;
};
export type GraphleSiteGraphDefinitions = typeof minimalCore & {
  readonly color: typeof colorType;
  readonly tag: typeof tag;
} & typeof site;

export const graphleSiteGraphNamespace: GraphleSiteGraphNamespace = { ...site, tag };
export const graphleSiteGraphDefinitions: GraphleSiteGraphDefinitions = {
  ...minimalCore,
  color: colorType,
  tag,
  ...site,
};

export const graphleSiteGraphBootstrapOptions = Object.freeze({
  availableDefinitions: graphleSiteGraphDefinitions,
  cacheKey: graphleSiteGraphDefinitions,
  coreSchema: minimalCore,
});

export type GraphleSiteGraphClient = SyncedGraphClient<
  GraphleSiteGraphNamespace,
  GraphleSiteGraphDefinitions
>;
export type GraphlePublicSiteGraph = GraphClient<
  GraphleSiteGraphNamespace,
  GraphleSiteGraphDefinitions
>;
export interface GraphlePublicSiteRuntime {
  readonly graph: GraphlePublicSiteGraph;
  readonly store: GraphStore;
}
export type GraphleSiteReadonlyRuntime = GraphleSiteGraphClient | GraphlePublicSiteRuntime;
export type GraphleSiteHttpGraphClientOptions = Omit<
  HttpGraphClientOptions<GraphleSiteGraphDefinitions>,
  "bootstrap" | "definitions"
>;

export function createGraphleSiteHttpGraphClient(
  options: GraphleSiteHttpGraphClientOptions = {},
): Promise<GraphleSiteGraphClient> {
  return createHttpGraphClient(graphleSiteGraphNamespace, {
    ...options,
    bootstrap: graphleSiteGraphBootstrapOptions,
    definitions: graphleSiteGraphDefinitions,
  });
}

function isGraphStore(value: GraphStoreSnapshot | GraphStore): value is GraphStore {
  return typeof (value as GraphStore).facts === "function";
}

export function createGraphlePublicSiteRuntime(
  snapshotOrStore: GraphStoreSnapshot | GraphStore,
): GraphlePublicSiteRuntime {
  const store = isGraphStore(snapshotOrStore) ? snapshotOrStore : createGraphStore(snapshotOrStore);

  return {
    graph: createGraphClient(store, graphleSiteGraphNamespace, graphleSiteGraphDefinitions),
    store,
  };
}

export function createGraphlePublicSiteRuntimeFromBaseline(
  baseline: PublicSiteGraphBaseline,
): GraphlePublicSiteRuntime {
  assertPublicSiteGraphBaselineCompatible(baseline);
  return createGraphlePublicSiteRuntime(baseline.snapshot);
}
