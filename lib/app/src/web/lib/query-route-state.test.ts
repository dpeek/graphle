import { describe, expect, it } from "bun:test";

import {
  defaultQueryRoutePreviewState,
  resolveQueryRoutePreviewState,
  validateQueryRouteSearch,
} from "./query-route-state.js";

describe("query route state", () => {
  it("normalizes saved-query identity and preview search state", () => {
    expect(
      validateQueryRouteSearch({
        pageSize: "50",
        params: "params-token",
        queryId: " saved-query:1 ",
        rendererId: "core:table",
      }),
    ).toEqual({
      pageSize: 50,
      params: "params-token",
      queryId: "saved-query:1",
      rendererId: "core:table",
    });
  });

  it("preserves fail-closed route identity while dropping invalid preview controls", () => {
    expect(
      validateQueryRouteSearch({
        draft: "not-a-valid-draft",
        pageSize: "0",
        params: "not-valid-params",
        rendererId: "core:unknown",
      }),
    ).toEqual({
      draft: "not-a-valid-draft",
      params: "not-valid-params",
    });
  });

  it("resolves preview state from route overrides before falling back to saved view bindings", () => {
    expect(
      resolveQueryRoutePreviewState({
        fallback: {
          pageSize: 5,
          rendererId: "core:card-grid",
        },
        search: {
          pageSize: 10,
        },
      }),
    ).toEqual({
      pageSize: 10,
      rendererId: "core:card-grid",
    });

    expect(resolveQueryRoutePreviewState({ search: {} })).toEqual(defaultQueryRoutePreviewState);
  });
});
