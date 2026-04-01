import { describe, expect, it } from "bun:test";

import { createBootstrappedSnapshot } from "@io/graph-bootstrap";
import { createGraphClient } from "@io/graph-client";
import { createGraphStore } from "@io/graph-kernel";

import { core } from "../core.js";
import { coreGraphBootstrapOptions } from "./bootstrap.js";
import {
  createSavedQueryDefinition,
  createSavedViewDefinition,
  listSavedQueryParameterDefinitions,
  listSavedViewsForQuery,
  readSavedQueryDefinition,
  SavedQueryDefinitionError,
  updateSavedQueryDefinition,
} from "./saved-query.js";

function createCoreGraph() {
  const store = createGraphStore(createBootstrappedSnapshot(core, coreGraphBootstrapOptions));
  return createGraphClient(store, core);
}

const workflowBoardSurface = Object.freeze({
  moduleId: "workflow",
  catalogId: "query-catalog:workflow",
  catalogVersion: "query-catalog:workflow:v1",
  surfaceId: "workflow:project-branch-board",
  surfaceVersion: "query-surface:workflow:project-branch-board:v1",
});

describe("core saved query graph schema", () => {
  it("creates durable saved-query and saved-view records through graph-native helpers", async () => {
    const graph = createCoreGraph();
    const query = await createSavedQueryDefinition(graph, {
      description: "Branch board filtered to the selected state.",
      name: "Branch board",
      ownerId: "principal:test",
      parameterDefinitions: [
        {
          label: "State",
          name: "state",
          required: true,
          type: "enum",
        },
      ],
      request: {
        version: 1,
        query: {
          kind: "collection",
          indexId: workflowBoardSurface.surfaceId,
          filter: {
            op: "eq",
            fieldId: "state",
            value: {
              kind: "param",
              name: "state",
            },
          },
          window: {
            after: "preview-cursor",
            limit: 25,
          },
        },
      },
      surface: workflowBoardSurface,
    });

    const view = createSavedViewDefinition(graph, {
      containerId: "saved-view-preview",
      containerDefaults: {
        pagination: {
          mode: "paged",
          pageSize: 50,
        },
        refresh: {
          mode: "poll",
          pollIntervalMs: 30_000,
        },
      },
      description: "Default board table.",
      name: "Branch board table",
      ownerId: "principal:test",
      queryId: query.id,
      queryParams: {
        state: "active",
      },
      rendererDefinition: {
        kind: "table",
        columns: [
          {
            fieldId: "name",
            label: "Branch",
          },
          {
            align: "center",
            fieldId: "state",
            label: "State",
          },
        ],
      },
      rendererId: "default:table",
    });

    expect(query.kind).toBe("collection");
    expect(query.surface).toEqual(workflowBoardSurface);
    expect(query.request.query).toEqual({
      kind: "collection",
      indexId: workflowBoardSurface.surfaceId,
      filter: {
        op: "eq",
        fieldId: "state",
        value: {
          kind: "param",
          name: "state",
        },
      },
      window: {
        limit: 25,
      },
    });
    expect(listSavedQueryParameterDefinitions(graph, query.id)).toEqual([
      {
        label: "State",
        name: "state",
        required: true,
        type: "enum",
      },
    ]);
    expect(view.queryId).toBe(query.id);
    expect(view.containerDefaults).toEqual({
      pagination: {
        mode: "paged",
        pageSize: 50,
      },
      refresh: {
        mode: "poll",
        pollIntervalMs: 30_000,
      },
    });
    expect(listSavedViewsForQuery(graph, query.id).map((entry) => entry.id)).toEqual([view.id]);

    const queriedSavedQuery = await graph.savedQuery.query({
      where: { id: query.id },
      select: {
        id: true,
        name: true,
        queryKind: true,
        surface: {
          moduleId: true,
          surfaceId: true,
        },
      },
    });
    const queriedSavedView = await graph.savedView.query({
      where: { id: view.id },
      select: {
        id: true,
        rendererId: true,
        query: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    expect(queriedSavedQuery).toEqual({
      id: query.id,
      name: "Branch board",
      queryKind: "collection",
      surface: {
        moduleId: "workflow",
        surfaceId: workflowBoardSurface.surfaceId,
      },
    });
    expect(queriedSavedView).toEqual({
      id: view.id,
      rendererId: "default:table",
      query: {
        id: query.id,
        name: "Branch board",
      },
    });
  });

  it("replaces parameter entities and durable identity when a saved query changes", async () => {
    const graph = createCoreGraph();
    const saved = await createSavedQueryDefinition(graph, {
      name: "Branch board",
      ownerId: "principal:test",
      parameterDefinitions: [
        {
          label: "State",
          name: "state",
          required: true,
          type: "enum",
        },
      ],
      request: {
        version: 1,
        query: {
          kind: "collection",
          indexId: workflowBoardSurface.surfaceId,
          filter: {
            op: "eq",
            fieldId: "state",
            value: {
              kind: "param",
              name: "state",
            },
          },
        },
      },
      surface: workflowBoardSurface,
    });

    const updated = await updateSavedQueryDefinition(graph, saved.id, {
      description: "Only active branches with an owner.",
      name: "Active branch board",
      ownerId: "principal:test",
      parameterDefinitions: [
        {
          defaultValue: "active",
          label: "State",
          name: "state",
          type: "enum",
        },
        {
          label: "Owner",
          name: "owner",
          type: "entity-ref",
        },
      ],
      request: {
        version: 1,
        query: {
          kind: "collection",
          indexId: workflowBoardSurface.surfaceId,
          filter: {
            op: "and",
            clauses: [
              {
                op: "eq",
                fieldId: "state",
                value: {
                  kind: "param",
                  name: "state",
                },
              },
              {
                op: "eq",
                fieldId: "owner",
                value: {
                  kind: "param",
                  name: "owner",
                },
              },
            ],
          },
          window: {
            limit: 10,
          },
        },
      },
      surface: workflowBoardSurface,
    });

    expect(updated.name).toBe("Active branch board");
    expect(updated.description).toBe("Only active branches with an owner.");
    expect(updated.definitionHash).not.toBe(saved.definitionHash);
    expect(listSavedQueryParameterDefinitions(graph, saved.id)).toEqual([
      {
        defaultValue: "active",
        label: "State",
        name: "state",
        type: "enum",
      },
      {
        label: "Owner",
        name: "owner",
        type: "entity-ref",
      },
    ]);

    const reloaded = await readSavedQueryDefinition(graph, saved.id);
    expect(reloaded.definitionHash).toBe(updated.definitionHash);
    expect(reloaded.request.query).toEqual({
      kind: "collection",
      indexId: workflowBoardSurface.surfaceId,
      filter: {
        op: "and",
        clauses: [
          {
            op: "eq",
            fieldId: "state",
            value: {
              kind: "param",
              name: "state",
            },
          },
          {
            op: "eq",
            fieldId: "owner",
            value: {
              kind: "param",
              name: "owner",
            },
          },
        ],
      },
      window: {
        limit: 10,
      },
    });
  });

  it("fails closed when collection queries are saved without a module-owned surface binding", async () => {
    const graph = createCoreGraph();

    await expect(
      createSavedQueryDefinition(graph, {
        name: "Detached collection",
        ownerId: "principal:test",
        request: {
          version: 1,
          query: {
            kind: "collection",
            indexId: workflowBoardSurface.surfaceId,
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "missing-surface",
      name: SavedQueryDefinitionError.name,
    });
  });
});
