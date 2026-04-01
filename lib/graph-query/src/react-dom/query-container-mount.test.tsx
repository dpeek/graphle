import { describe, expect, it } from "bun:test";

import { serializedQueryVersion, type QueryResultPage } from "@io/graph-client";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  QueryContainerRuntimeValue,
  QueryContainerSpec,
  QuerySurfaceRendererCompatibility,
} from "../query-container.js";
import {
  QueryRendererRegistryError,
  builtInQueryRendererRegistry,
  createDefaultCardGridRendererBinding,
  createDefaultListRendererBinding,
  createDefaultTableRendererBinding,
  createQueryRendererRegistry,
} from "./query-renderers.js";
import { QueryContainerMountView } from "./query-container-mount.js";

const baseSpec = {
  containerId: "query-demo",
  pagination: {
    mode: "paged",
    pageSize: 2,
  },
  query: {
    kind: "inline",
    request: {
      version: serializedQueryVersion,
      query: {
        kind: "collection",
        indexId: "views:query-demo",
      },
    },
  },
  renderer: {
    ...createDefaultListRendererBinding({
      descriptionField: "summary",
      metaFields: [{ fieldId: "status", label: "Status" }],
      titleField: "title",
    }),
  },
} as const satisfies QueryContainerSpec;

const demoSurface = {
  compatibleRendererIds: ["default:list", "default:table", "default:card-grid"],
  itemEntityIds: "optional",
  queryKind: "collection",
  resultKind: "collection",
  sourceKinds: ["inline"],
  surfaceId: "views:query-demo",
  surfaceVersion: "query-surface:views:query-demo:v1",
} as const satisfies QuerySurfaceRendererCompatibility;

function createResultPage(): QueryResultPage {
  return {
    kind: "collection",
    freshness: {
      completeness: "complete",
      freshness: "current",
    },
    items: [
      {
        key: "row:1",
        entityId: "entity:1",
        payload: {
          title: "Workflow shell",
          summary: "Primary browser route preview",
          status: "active",
        },
      },
      {
        key: "row:2",
        entityId: "entity:2",
        payload: {
          title: "Query cards",
          summary: "Reusable query route mount",
          status: "ready",
        },
      },
    ],
  };
}

function createValue(
  overrides: Partial<QueryContainerRuntimeValue> = {},
): QueryContainerRuntimeValue {
  const result = createResultPage();
  return {
    cacheKey: "cache:query-demo",
    instanceKey: "instance:query-demo",
    pageKey: "page:first",
    request: baseSpec.query.request,
    snapshot: { result },
    state: {
      kind: "ready",
      result,
    },
    ...overrides,
  };
}

describe("query renderer registry", () => {
  it("rejects duplicate stable renderer ids", () => {
    expect(() =>
      createQueryRendererRegistry([
        builtInQueryRendererRegistry["default:list"]!,
        builtInQueryRendererRegistry["default:list"]!,
      ]),
    ).toThrow(QueryRendererRegistryError);
  });
});

describe("query route mount", () => {
  it("renders the first shared query render paths through stable renderer ids", () => {
    const renderers = ["default:list", "default:table", "default:card-grid"] as const;
    const html = renderToStaticMarkup(
      <div>
        {renderers.map((rendererId) => (
          <QueryContainerMountView
            description="Shared query container route preview."
            initialValue={createValue()}
            key={rendererId}
            spec={{
              ...baseSpec,
              containerId: `query-demo:${rendererId}`,
              renderer:
                rendererId === "default:list"
                  ? baseSpec.renderer
                  : rendererId === "default:table"
                    ? createDefaultTableRendererBinding([
                        { fieldId: "title", label: "Title" },
                        { fieldId: "status", label: "Status" },
                      ])
                    : createDefaultCardGridRendererBinding({
                        badgeField: "status",
                        descriptionField: "summary",
                        fields: [{ fieldId: "status", label: "Status" }],
                        titleField: "title",
                      }),
            }}
            surface={demoSurface}
            title={rendererId}
          />
        ))}
      </div>,
    );

    expect(html).toContain('data-query-renderer="default:list"');
    expect(html).toContain('data-query-renderer="default:table"');
    expect(html).toContain('data-query-renderer="default:card-grid"');
    expect(html).toContain("Workflow shell");
    expect(html).toContain("Query cards");
  });

  it("fails clearly when a route binds an incompatible renderer", () => {
    const html = renderToStaticMarkup(
      <QueryContainerMountView
        description="Shared query container route preview."
        initialValue={createValue()}
        spec={{
          ...baseSpec,
          renderer: {
            rendererId: "default:table",
          },
        }}
        surface={{
          ...demoSurface,
          compatibleRendererIds: ["default:list"],
        }}
        title="Invalid renderer"
      />,
    );

    expect(html).toContain('data-query-container-state="invalid"');
    expect(html).toContain("renderer-not-compatible");
    expect(html).toContain("is not compatible with query surface &quot;views:query-demo&quot;.");
  });
});
