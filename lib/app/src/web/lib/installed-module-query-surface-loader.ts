import type { InstalledModuleRecord, InstalledModuleRuntimeExpectation } from "@io/graph-authority";
import type { ModuleQuerySurfaceCatalog } from "@io/graph-projection";
import type { QueryEditorCatalog } from "@io/graph-query";

import { loadInstalledModuleContributionResolutions } from "./installed-module-manifest-loader.js";
import {
  createInstalledModuleQuerySurfaceRegistry,
  createQueryEditorCatalogFromRegistry,
  resolveInstalledModuleQuerySurfaceCatalogs,
  type InstalledModuleQuerySurfaceRegistry,
} from "./query-surface-registry.js";
import { getBuiltInInstalledModuleContributionResolutions } from "./installed-module-runtime.js";

export type LoadedInstalledModuleQuerySurfaceOptions = {
  readonly records: readonly InstalledModuleRecord[];
  readonly localSourceRoot?: string;
  readonly runtime?: InstalledModuleRuntimeExpectation | null;
};

export async function loadInstalledModuleQuerySurfaceCatalogs(
  input: LoadedInstalledModuleQuerySurfaceOptions,
): Promise<readonly ModuleQuerySurfaceCatalog[]> {
  const resolutions = await loadInstalledModuleContributionResolutions({
    records: input.records,
    localSourceRoot: input.localSourceRoot,
    runtime: input.runtime ?? null,
  });

  return resolveInstalledModuleQuerySurfaceCatalogs([
    ...getBuiltInInstalledModuleContributionResolutions(),
    ...resolutions,
  ]);
}

export async function loadInstalledModuleQuerySurfaceRegistry(
  input: LoadedInstalledModuleQuerySurfaceOptions,
): Promise<InstalledModuleQuerySurfaceRegistry> {
  return createInstalledModuleQuerySurfaceRegistry(
    await loadInstalledModuleQuerySurfaceCatalogs(input),
  );
}

export async function loadInstalledModuleQueryEditorCatalog(
  input: LoadedInstalledModuleQuerySurfaceOptions,
): Promise<QueryEditorCatalog> {
  return createQueryEditorCatalogFromRegistry(await loadInstalledModuleQuerySurfaceRegistry(input));
}
