export const queryRoutePreviewRendererIds = ["core:list", "core:table", "core:card-grid"] as const;

const queryRoutePreviewRendererIdSet = new Set<string>(queryRoutePreviewRendererIds);

export type QueryRoutePreviewRendererId = (typeof queryRoutePreviewRendererIds)[number];

export type QueryRouteSearch = {
  readonly draft?: string;
  readonly pageSize?: number;
  readonly params?: string;
  readonly queryId?: string;
  readonly rendererId?: QueryRoutePreviewRendererId;
  readonly viewId?: string;
};

export type QueryRoutePreviewState = {
  readonly pageSize: number;
  readonly rendererId: QueryRoutePreviewRendererId;
};

export const defaultQueryRoutePreviewState = Object.freeze({
  pageSize: 25,
  rendererId: "core:list",
} satisfies QueryRoutePreviewState);

export function isQueryRoutePreviewRendererId(value: string): value is QueryRoutePreviewRendererId {
  return queryRoutePreviewRendererIdSet.has(value);
}

export function createQueryRouteSearch(input: QueryRouteSearch): QueryRouteSearch {
  return {
    ...(input.queryId ? { queryId: input.queryId } : {}),
    ...(input.viewId ? { viewId: input.viewId } : {}),
    ...(input.draft ? { draft: input.draft } : {}),
    ...(input.params ? { params: input.params } : {}),
    ...(typeof input.pageSize === "number" ? { pageSize: input.pageSize } : {}),
    ...(input.rendererId ? { rendererId: input.rendererId } : {}),
  };
}

export function validateQueryRouteSearch(search: Record<string, unknown>): QueryRouteSearch {
  return createQueryRouteSearch({
    queryId: readTrimmedString(search.queryId),
    viewId: readTrimmedString(search.viewId),
    draft: readTrimmedString(search.draft),
    params: readTrimmedString(search.params),
    pageSize: readPositiveInteger(search.pageSize),
    rendererId: readRendererId(search.rendererId),
  });
}

export function resolveQueryRoutePreviewState(input: {
  readonly fallback?: Partial<QueryRoutePreviewState>;
  readonly search?: QueryRouteSearch;
}): QueryRoutePreviewState {
  const { fallback, search = {} } = input;
  return {
    pageSize: search.pageSize ?? fallback?.pageSize ?? defaultQueryRoutePreviewState.pageSize,
    rendererId:
      search.rendererId ?? fallback?.rendererId ?? defaultQueryRoutePreviewState.rendererId,
  };
}

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readRendererId(value: unknown): QueryRoutePreviewRendererId | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return isQueryRoutePreviewRendererId(normalized) ? normalized : undefined;
}
