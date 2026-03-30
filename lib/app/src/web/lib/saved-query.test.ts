import { describe, expect, it } from "bun:test";

import { createBootstrappedSnapshot } from "@io/graph-bootstrap";
import { createGraphClient } from "@io/graph-client";
import { createGraphStore } from "@io/graph-kernel";
import { core, coreGraphBootstrapOptions } from "@io/graph-module-core";

import { createInstalledQueryEditorCatalog } from "../components/query-editor.js";
import {
  builtInQueryRendererRegistry,
  createQueryRendererCapabilityMap,
} from "../components/query-renderers.js";
import { createQueryEditorDraft } from "./query-editor.js";
import { getInstalledModuleQuerySurfaceRendererCompatibility } from "./query-surface-registry.js";
import {
  createGraphBackedSavedQueryRepository,
  createSavedQueryRecordSourceResolver,
  createSavedQueryDefinitionInputFromDraft,
  createSavedViewDefinitionInput,
  deriveSavedQueryRecord,
  resolveSavedQueryDefinition,
  resolveSavedViewDefinition,
} from "./saved-query.js";

function createGraphBackedRepository(ownerId: string) {
  const store = createGraphStore(createBootstrappedSnapshot(core, coreGraphBootstrapOptions));
  const graph = createGraphClient(store, core);
  return {
    graph,
    repository: createGraphBackedSavedQueryRepository(graph, ownerId),
  };
}

describe("saved query repository", () => {
  it("cruds owner-scoped graph-backed saved queries and views", async () => {
    const catalog = createInstalledQueryEditorCatalog();
    const rendererCapabilities = createQueryRendererCapabilityMap(builtInQueryRendererRegistry);
    const ownerId = "principal:owner";
    const otherOwnerId = "principal:other";
    const { graph, repository } = createGraphBackedRepository(ownerId);
    const otherRepository = createGraphBackedSavedQueryRepository(graph, otherOwnerId);
    const draft = createQueryEditorDraft(catalog);

    const query = await repository.saveSavedQuery(
      createSavedQueryDefinitionInputFromDraft({
        catalog,
        draft,
        name: "Owner board",
        ownerId,
      }),
    );
    const view = await repository.saveSavedView(
      createSavedViewDefinitionInput({
        name: "Owner board view",
        ownerId,
        queryId: query.id,
        rendererCapabilities,
        spec: {
          containerId: "saved-view-preview",
          pagination: {
            mode: "paged",
            pageSize: 25,
          },
          refresh: {
            mode: "manual",
          },
          renderer: {
            rendererId: "core:list",
          },
        },
        surface: getInstalledModuleQuerySurfaceRendererCompatibility(
          "workflow:project-branch-board",
        )!,
      }),
    );
    const otherQuery = await otherRepository.saveSavedQuery(
      createSavedQueryDefinitionInputFromDraft({
        catalog,
        draft,
        name: "Other board",
        ownerId: otherOwnerId,
      }),
    );

    expect((await repository.listSavedQueries()).map((entry) => entry.id)).toEqual([query.id]);
    expect((await repository.listSavedViews()).map((entry) => entry.id)).toEqual([view.id]);
    expect((await otherRepository.listSavedQueries()).map((entry) => entry.id)).toEqual([
      otherQuery.id,
    ]);

    await repository.deleteSavedQuery(query.id);

    expect(await repository.getSavedQuery(query.id)).toBeUndefined();
    expect(await repository.getSavedView(view.id)).toBeUndefined();
    expect(await otherRepository.getSavedQuery(otherQuery.id)).toMatchObject({
      id: otherQuery.id,
    });
  });

  it("resolves graph-backed saved queries and views from graph-native definitions", async () => {
    const catalog = createInstalledQueryEditorCatalog();
    const ownerId = "principal:owner";
    const { repository } = createGraphBackedRepository(ownerId);
    const rendererCapabilities = createQueryRendererCapabilityMap(builtInQueryRendererRegistry);
    const draft = {
      ...createQueryEditorDraft(catalog),
      filters: [
        {
          fieldId: "state",
          id: "filter:state",
          operator: "eq" as const,
          value: { kind: "param" as const, name: "state" },
        },
      ],
      parameters: [
        {
          defaultValue: "active",
          id: "param:state",
          label: "State",
          name: "state",
          required: false,
          type: "enum" as const,
        },
      ],
    };

    const query = await repository.saveSavedQuery(
      createSavedQueryDefinitionInputFromDraft({
        catalog,
        draft,
        name: "Owner board",
        ownerId,
      }),
    );
    const view = await repository.saveSavedView(
      createSavedViewDefinitionInput({
        name: "Owner board view",
        ownerId,
        queryId: query.id,
        rendererCapabilities,
        spec: {
          containerId: "saved-view-preview",
          pagination: {
            mode: "paged",
            pageSize: 25,
          },
          refresh: {
            mode: "manual",
          },
          renderer: {
            rendererId: "core:list",
          },
        },
        surface: getInstalledModuleQuerySurfaceRendererCompatibility(
          "workflow:project-branch-board",
        )!,
      }),
    );
    const sourceResolver = createSavedQueryRecordSourceResolver(
      {
        getSavedQuery(id) {
          return repository.getSavedQuery(id).then((saved) => {
            return saved ? deriveSavedQueryRecord(saved) : undefined;
          });
        },
      },
      { catalog },
    );

    const resolvedQuery = await resolveSavedQueryDefinition({
      catalog,
      executionContext: {
        policyFilterVersion: "policy:7",
        principalId: ownerId,
      },
      params: { state: "ready" },
      query,
    });
    const resolvedView = await resolveSavedViewDefinition({
      catalog,
      executionContext: {
        policyFilterVersion: "policy:7",
        principalId: ownerId,
      },
      params: { state: "blocked" },
      query,
      rendererCapabilities,
      resolveSurfaceCompatibility: getInstalledModuleQuerySurfaceRendererCompatibility,
      view,
    });
    const resolvedSource = await sourceResolver(
      {
        kind: "saved",
        params: { state: "blocked" },
        queryId: query.id,
      },
      {},
    );

    expect(deriveSavedQueryRecord(query).catalogId).toBe("workflow:query-surfaces");
    expect(resolvedQuery.request.params?.state).toBe("ready");
    expect(resolvedQuery.normalizedRequest.params[0]).toMatchObject({
      name: "state",
      value: "ready",
    });
    expect(resolvedView.request.params?.state).toBe("blocked");
    expect(resolvedView.view.containerId).toBe("saved-view-preview");
    expect("request" in resolvedSource ? resolvedSource.request.params?.state : undefined).toBe(
      "blocked",
    );
  });

  it("fails closed when graph-backed saved-query definitions drift from the installed catalog", async () => {
    const catalog = createInstalledQueryEditorCatalog();
    const ownerId = "principal:owner";
    const { repository } = createGraphBackedRepository(ownerId);
    const draft = createQueryEditorDraft(catalog);

    const staleQuery = await repository.saveSavedQuery({
      ...createSavedQueryDefinitionInputFromDraft({
        catalog,
        draft,
        name: "Stale board",
        ownerId,
      }),
      surface: {
        ...createSavedQueryDefinitionInputFromDraft({
          catalog,
          draft,
          name: "Stale board",
          ownerId,
        }).surface!,
        catalogVersion: "query-catalog:workflow:v0",
      },
    });

    await expect(
      resolveSavedQueryDefinition({
        catalog,
        query: staleQuery,
      }),
    ).rejects.toMatchObject({
      code: "incompatible-query",
      message: expect.stringContaining("incompatible query catalog"),
    });
  });
});
