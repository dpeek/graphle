import { coreQuerySurfaceCatalog } from "@io/graph-module-core";
import { workflowQuerySurfaceCatalog } from "@io/graph-module-workflow";
import type { ModuleQuerySurfaceCatalog } from "@io/graph-projection";
import {
  createInstalledQuerySurfaceRegistry,
  createQueryEditorCatalogFromInstalledSurfaces,
  createQuerySurfaceRendererCompatibility,
  getInstalledQuerySurface,
  type InstalledQuerySurface,
  type InstalledQuerySurfaceRegistry,
  type QueryEditorCatalog,
  type QuerySurfaceRendererCompatibility,
} from "@io/graph-query";

export type InstalledModuleQuerySurface = InstalledQuerySurface;
export type InstalledModuleQuerySurfaceRegistry = InstalledQuerySurfaceRegistry;

export function createInstalledModuleQuerySurfaceRegistry(
  catalogs: readonly ModuleQuerySurfaceCatalog[],
): InstalledModuleQuerySurfaceRegistry {
  return createInstalledQuerySurfaceRegistry(catalogs);
}

export function getInstalledModuleQuerySurface(
  registry: InstalledModuleQuerySurfaceRegistry,
  surfaceId: string,
): InstalledModuleQuerySurface | undefined {
  return getInstalledQuerySurface(registry, surfaceId);
}

export function createQueryEditorCatalogFromRegistry(
  registry: InstalledModuleQuerySurfaceRegistry,
): QueryEditorCatalog {
  return createQueryEditorCatalogFromInstalledSurfaces(registry);
}

/**
 * Keep the current built-in installation path explicit until manifest-backed
 * activation decides which module catalogs are active at runtime.
 *
 * This stays lazy because the Cloudflare dev worker scans entry exports during
 * startup, and eager catalog materialization can observe partially initialized
 * workspace modules.
 */
export function getBuiltInInstalledModuleQuerySurfaceCatalogs(): readonly ModuleQuerySurfaceCatalog[] {
  return [workflowQuerySurfaceCatalog, coreQuerySurfaceCatalog];
}

export const builtInInstalledModuleQuerySurfaceCatalogs =
  getBuiltInInstalledModuleQuerySurfaceCatalogs();

export function createBuiltInInstalledModuleQuerySurfaceRegistry(): InstalledModuleQuerySurfaceRegistry {
  return createInstalledModuleQuerySurfaceRegistry(getBuiltInInstalledModuleQuerySurfaceCatalogs());
}

let installedModuleQuerySurfaceRegistryCache: InstalledModuleQuerySurfaceRegistry | undefined;

export function getInstalledModuleQuerySurfaceRegistry(): InstalledModuleQuerySurfaceRegistry {
  installedModuleQuerySurfaceRegistryCache ??= createBuiltInInstalledModuleQuerySurfaceRegistry();
  return installedModuleQuerySurfaceRegistryCache;
}

let installedModuleQueryEditorCatalogCache: QueryEditorCatalog | undefined;

export function getInstalledModuleQueryEditorCatalog(): QueryEditorCatalog {
  installedModuleQueryEditorCatalogCache ??= createQueryEditorCatalogFromRegistry(
    getInstalledModuleQuerySurfaceRegistry(),
  );
  return installedModuleQueryEditorCatalogCache;
}

export const installedModuleQueryEditorCatalog = getInstalledModuleQueryEditorCatalog();

export function getInstalledModuleQuerySurfaceRendererCompatibility(
  surfaceId: string,
): QuerySurfaceRendererCompatibility | undefined {
  const surface = getInstalledModuleQuerySurface(
    getInstalledModuleQuerySurfaceRegistry(),
    surfaceId,
  );
  return surface ? createQuerySurfaceRendererCompatibility(surface) : undefined;
}

export { createQuerySurfaceRendererCompatibility };
