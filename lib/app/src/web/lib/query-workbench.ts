import {
  createQueryEditorDraft,
  createQueryWorkbenchInitialDraft as createGenericQueryWorkbenchInitialDraft,
  type QueryEditorCatalog,
  type QueryEditorDraft,
} from "@io/graph-query";

export { resolveQueryWorkbenchRouteTarget, type QueryWorkbenchRouteSearch } from "@io/graph-query";
export * from "@io/graph-query";

const defaultWorkflowWorkbenchSurfaceId = "workflow:project-branch-board";

export function createQueryWorkbenchInitialDraft(catalog: QueryEditorCatalog): QueryEditorDraft {
  return catalog.surfaces.some((surface) => surface.surfaceId === defaultWorkflowWorkbenchSurfaceId)
    ? createQueryEditorDraft(catalog, defaultWorkflowWorkbenchSurfaceId)
    : createGenericQueryWorkbenchInitialDraft(catalog);
}
