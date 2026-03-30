import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";

import type { AuthorizationContext } from "@io/graph-authority";
import { edgeId } from "@io/graph-kernel";
import { core } from "@io/graph-module-core";

import { createInstalledQueryEditorCatalog } from "../components/query-editor.js";
import {
  builtInQueryRendererRegistry,
  createQueryRendererCapabilityMap,
} from "../components/query-renderers.js";
import { createAnonymousAuthorizationContext } from "./auth-bridge.js";
import { createTestWebAppAuthority } from "./authority-test-helpers.js";
import {
  bootstrapDurableObjectAuthoritySchema,
  createSqliteDurableObjectAuthorityStorage,
} from "./graph-authority-sql-storage.js";
import type { DurableObjectSqlStorageLike } from "./graph-authority-sql-startup.js";
import { webAppPolicyVersion } from "./policy-version.js";
import { createQueryEditorDraft } from "./query-editor.js";
import { getInstalledModuleQuerySurfaceRendererCompatibility } from "./query-surface-registry.js";
import {
  createSavedQueryRecordInputFromDraft,
  createSavedViewRecordInput,
  type SavedQueryRecord,
  type SavedViewRecord,
} from "./saved-query.js";

const workflowProjectBranchBoardSurfaceId = "workflow:project-branch-board";
const savedQueryCatalogVersionPredicateId = edgeId(core.savedQuery.fields.surface.catalogVersion);
const savedQueryDefinitionHashPredicateId = edgeId(core.savedQuery.fields.definitionHash);
const savedQueryModuleIdPredicateId = edgeId(core.savedQuery.fields.surface.moduleId);
const savedQueryParameterQueryPredicateId = edgeId(core.savedQueryParameter.fields.query);

function createSqlStorage(): {
  readonly db: Database;
  readonly storage: ReturnType<typeof createSqliteDurableObjectAuthorityStorage>;
} {
  const db = new Database(":memory:");
  const state = {
    storage: {
      sql: {
        exec<T extends Record<string, unknown>>(query: string, ...bindings: unknown[]) {
          const statement = db.query(query);
          const trimmed = query.trimStart();
          if (/^(SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(trimmed)) {
            return statement.all(
              ...(bindings as never as Parameters<typeof statement.all>),
            ) as Iterable<T>;
          }
          statement.run(...(bindings as never as Parameters<typeof statement.run>));
          return [] as T[];
        },
      } satisfies DurableObjectSqlStorageLike,
      transactionSync<T>(callback: () => T): T {
        return db.transaction(callback)();
      },
    },
  };

  bootstrapDurableObjectAuthoritySchema(state.storage);

  return {
    db,
    storage: createSqliteDurableObjectAuthorityStorage(state),
  };
}

function queryAll<T extends Record<string, unknown>>(
  db: Database,
  query: string,
  ...bindings: unknown[]
): T[] {
  const statement = db.query(query);
  return statement.all(...(bindings as never as Parameters<typeof statement.all>)) as T[];
}

function queryOne<T extends Record<string, unknown>>(
  db: Database,
  query: string,
  ...bindings: unknown[]
): T | undefined {
  return queryAll<T>(db, query, ...bindings)[0];
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeValue(entry));
  }
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalizeValue((value as Record<string, unknown>)[key])]),
  );
}

async function hashSavedQueryRecord(input: {
  readonly moduleId: string;
  readonly query: SavedQueryRecord;
}): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify(
        canonicalizeValue({
          parameterDefinitions: input.query.parameterDefinitions,
          request: input.query.request,
          surface: {
            catalogId: input.query.catalogId,
            catalogVersion: input.query.catalogVersion,
            moduleId: input.moduleId,
            surfaceId: input.query.surfaceId,
            surfaceVersion: input.query.surfaceVersion,
          },
        }),
      ),
    ),
  );
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function createAuthorityAuthorizationContext(
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext {
  return {
    ...createAnonymousAuthorizationContext({
      graphId: "graph:test",
      policyVersion: webAppPolicyVersion,
    }),
    principalId: "principal:authority",
    principalKind: "service",
    roleKeys: ["graph:authority"],
    sessionId: "session:authority",
    ...overrides,
  };
}

async function saveSavedQueryFixture(input: {
  readonly authorization: AuthorizationContext;
  readonly storage: ReturnType<typeof createSqliteDurableObjectAuthorityStorage>;
}): Promise<{
  readonly query: SavedQueryRecord;
  readonly view: SavedViewRecord;
}> {
  const authority = await createTestWebAppAuthority(input.storage);
  const catalog = createInstalledQueryEditorCatalog();
  const rendererCapabilities = createQueryRendererCapabilityMap(builtInQueryRendererRegistry);
  const draft = {
    ...createQueryEditorDraft(catalog, workflowProjectBranchBoardSurfaceId),
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

  const query = await authority.saveSavedQuery(
    createSavedQueryRecordInputFromDraft({
      catalog,
      draft,
      name: "Owner board",
    }),
    {
      authorization: input.authorization,
    },
  );

  const view = await authority.saveSavedView(
    createSavedViewRecordInput({
      name: "Owner board view",
      query,
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
        workflowProjectBranchBoardSurfaceId,
      )!,
    }),
    {
      authorization: input.authorization,
    },
  );

  return {
    query,
    view,
  };
}

describe("graph-authority-sql-saved-query", () => {
  it("persists saved queries and views through sqlite durable-object storage and re-derives normalized records after restart", async () => {
    const { db, storage } = createSqlStorage();
    const authorization = createAuthorityAuthorizationContext();
    const saved = await saveSavedQueryFixture({ authorization, storage });
    const initialAuthority = await createTestWebAppAuthority(storage);

    const resolvedQuery = await initialAuthority.resolveSavedQuery(
      {
        params: { state: "ready" },
        queryId: saved.query.id,
      },
      { authorization },
    );

    expect(
      queryAll<{ name: string }>(
        db,
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('io_saved_query', 'io_saved_view') ORDER BY name",
      ),
    ).toEqual([]);
    expect(
      queryAll<{ subject: string }>(
        db,
        "SELECT DISTINCT s AS subject FROM io_graph_edge WHERE s IN (?, ?) ORDER BY subject",
        saved.query.id,
        saved.view.id,
      ),
    ).toEqual([
      {
        subject: saved.query.id,
      },
      {
        subject: saved.view.id,
      },
    ]);
    expect(resolvedQuery.request.params?.state).toBe("ready");
    expect(resolvedQuery.normalizedRequest.metadata.identityHash).toEqual(expect.any(String));
    expect(resolvedQuery.normalizedRequest.params[0]).toMatchObject({
      name: "state",
      value: "ready",
    });

    const restartedAuthority = await createTestWebAppAuthority(storage);
    const resolvedView = await restartedAuthority.resolveSavedView(
      {
        params: { state: "blocked" },
        viewId: saved.view.id,
      },
      { authorization },
    );

    expect(
      (await restartedAuthority.listSavedQueries({ authorization })).map((query) => query.id),
    ).toEqual([saved.query.id]);
    expect(
      (await restartedAuthority.listSavedViews({ authorization })).map((view) => view.id),
    ).toEqual([saved.view.id]);
    expect(resolvedView.view.id).toBe(saved.view.id);
    expect(resolvedView.normalizedRequest.metadata.identityHash).toEqual(expect.any(String));
    expect(resolvedView.normalizedRequest.params[0]).toMatchObject({
      name: "state",
      value: "blocked",
    });
  });

  it("fails closed after restart when a persisted query catalog version no longer matches the installed module catalog", async () => {
    const { db, storage } = createSqlStorage();
    const authorization = createAuthorityAuthorizationContext();
    const saved = await saveSavedQueryFixture({ authorization, storage });
    const moduleId = queryOne<{ moduleId: string }>(
      db,
      "SELECT o AS moduleId FROM io_graph_edge WHERE s = ? AND p = ?",
      saved.query.id,
      savedQueryModuleIdPredicateId,
    )?.moduleId;

    if (!moduleId) {
      throw new Error("Expected persisted saved query surface module id.");
    }

    const staleQuery = {
      ...saved.query,
      catalogVersion: "query-catalog:workflow:v0",
    } satisfies SavedQueryRecord;
    const staleDefinitionHash = await hashSavedQueryRecord({
      moduleId,
      query: staleQuery,
    });

    db.query("UPDATE io_graph_edge SET o = ? WHERE s = ? AND p = ?").run(
      staleQuery.catalogVersion,
      saved.query.id,
      savedQueryCatalogVersionPredicateId,
    );
    db.query("UPDATE io_graph_edge SET o = ? WHERE s = ? AND p = ?").run(
      staleDefinitionHash,
      saved.query.id,
      savedQueryDefinitionHashPredicateId,
    );

    const restartedAuthority = await createTestWebAppAuthority(storage);

    await expect(
      restartedAuthority.resolveSavedQuery(
        {
          queryId: saved.query.id,
        },
        { authorization },
      ),
    ).rejects.toMatchObject({
      message:
        `Saved query "${saved.query.id}" references incompatible query catalog ` +
        '"workflow:query-surfaces@query-catalog:workflow:v0".',
      status: 409,
    });
  });

  it("fails closed after restart when a persisted saved view points at a removed saved query and can be explicitly row-cleaned", async () => {
    const { db, storage } = createSqlStorage();
    const authorization = createAuthorityAuthorizationContext();
    const saved = await saveSavedQueryFixture({ authorization, storage });
    const parameterSubjects = queryAll<{ subject: string }>(
      db,
      "SELECT DISTINCT s AS subject FROM io_graph_edge WHERE p = ? AND o = ? ORDER BY subject",
      savedQueryParameterQueryPredicateId,
      saved.query.id,
    );

    db.query("DELETE FROM io_graph_edge WHERE s = ?").run(saved.query.id);
    for (const parameter of parameterSubjects) {
      db.query("DELETE FROM io_graph_edge WHERE s = ?").run(parameter.subject);
    }

    const restartedAuthority = await createTestWebAppAuthority(storage);

    await expect(
      restartedAuthority.resolveSavedView(
        {
          viewId: saved.view.id,
        },
        { authorization },
      ),
    ).rejects.toMatchObject({
      message: `Saved view "${saved.view.id}" references missing saved query "${saved.query.id}".`,
      status: 404,
    });

    db.query("DELETE FROM io_graph_edge WHERE s = ?").run(saved.view.id);

    const recoveredAuthority = await createTestWebAppAuthority(storage);
    expect(await recoveredAuthority.getSavedView(saved.view.id, { authorization })).toBeUndefined();
    expect(
      queryAll<{ subject: string }>(
        db,
        "SELECT DISTINCT s AS subject FROM io_graph_edge WHERE s = ?",
        saved.view.id,
      ),
    ).toEqual([]);
  });
});
