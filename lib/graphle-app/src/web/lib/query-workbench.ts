import {
  createQueryEditorDraft,
  createQueryWorkbenchInitialDraft as createGenericQueryWorkbenchInitialDraft,
  type QueryEditorCatalog,
  type QueryEditorDraft,
} from "@dpeek/graphle-query";

export { resolveQueryWorkbenchRouteTarget, type QueryWorkbenchRouteSearch } from "@dpeek/graphle-query";
export * from "@dpeek/graphle-query";

const defaultWorkflowWorkbenchSurfaceId = "workflow:project-branch-board";

export function createQueryWorkbenchInitialDraft(catalog: QueryEditorCatalog): QueryEditorDraft {
  return catalog.surfaces.some((surface) => surface.surfaceId === defaultWorkflowWorkbenchSurfaceId)
    ? createQueryEditorDraft(catalog, defaultWorkflowWorkbenchSurfaceId)
    : createGenericQueryWorkbenchInitialDraft(catalog);
}
