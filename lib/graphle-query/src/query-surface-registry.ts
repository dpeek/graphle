import type { ModuleQuerySurfaceCatalog, ModuleQuerySurfaceSpec } from "@dpeek/graphle-projection";

import { createQueryEditorCatalogFromInstalledSurfaces } from "./query-editor-catalog.js";
import type { QueryEditorCatalog } from "./query-editor.js";
import type { QuerySurfaceRendererCompatibility } from "./query-container.js";

export type InstalledQuerySurface = ModuleQuerySurfaceSpec & {
  readonly catalogId: string;
  readonly catalogVersion: string;
  readonly moduleId: string;
};

export type InstalledQuerySurfaceRegistry = {
  readonly catalogs: readonly ModuleQuerySurfaceCatalog[];
  readonly surfaces: readonly InstalledQuerySurface[];
  readonly surfaceById: ReadonlyMap<string, InstalledQuerySurface>;
};

function requireUniqueString(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (value.length === 0) {
      throw new TypeError(`${label} must not contain empty values.`);
    }
    if (seen.has(value)) {
      throw new TypeError(`${label} must not contain duplicate values.`);
    }
    seen.add(value);
  }
}

export function createInstalledQuerySurfaceRegistry(
  catalogs: readonly ModuleQuerySurfaceCatalog[],
): InstalledQuerySurfaceRegistry {
  if (catalogs.length === 0) {
    throw new TypeError("Installed query-surface catalogs must not be empty.");
  }

  requireUniqueString(
    catalogs.map((catalog) => catalog.catalogId),
    "catalogId",
  );

  const surfaces = catalogs.flatMap((catalog) =>
    catalog.surfaces.map((surface) =>
      Object.freeze({
        ...surface,
        catalogId: catalog.catalogId,
        catalogVersion: catalog.catalogVersion,
        moduleId: catalog.moduleId,
      }),
    ),
  );

  requireUniqueString(
    surfaces.map((surface) => surface.surfaceId),
    "surfaceId",
  );

  const surfaceById = new Map(surfaces.map((surface) => [surface.surfaceId, surface]));

  return Object.freeze({
    catalogs: Object.freeze([...catalogs]),
    surfaces: Object.freeze(surfaces),
    surfaceById,
  });
}

export function getInstalledQuerySurface(
  registry: InstalledQuerySurfaceRegistry,
  surfaceId: string,
): InstalledQuerySurface | undefined {
  return registry.surfaceById.get(surfaceId);
}

export { getInstalledQuerySurface as getInstalledModuleQuerySurface };

export function createQuerySurfaceRendererCompatibility(
  surface: InstalledQuerySurface,
): QuerySurfaceRendererCompatibility | undefined {
  if (!surface.renderers) {
    return undefined;
  }

  return {
    compatibleRendererIds: surface.renderers.compatibleRendererIds,
    ...(surface.renderers.itemEntityIds ? { itemEntityIds: surface.renderers.itemEntityIds } : {}),
    queryKind: surface.queryKind,
    resultKind: surface.renderers.resultKind,
    ...(surface.renderers.sourceKinds ? { sourceKinds: surface.renderers.sourceKinds } : {}),
    surfaceId: surface.surfaceId,
    surfaceVersion: surface.surfaceVersion,
  };
}

export { createQuerySurfaceRendererCompatibility as getInstalledModuleQuerySurfaceRendererCompatibility };

export function createQueryEditorCatalogFromRegistry(
  registry: InstalledQuerySurfaceRegistry,
): QueryEditorCatalog {
  return createQueryEditorCatalogFromInstalledSurfaces(registry);
}
