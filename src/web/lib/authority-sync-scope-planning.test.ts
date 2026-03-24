import { describe, expect, it } from "bun:test";

import { createStore, edgeId, type AuthorizationContext } from "@io/core/graph";
import { core } from "@io/core/graph/modules";
import { ops } from "@io/core/graph/modules/ops";
import { workflowReviewModuleReadScope } from "@io/core/graph/modules/ops/workflow";

import {
  collectTouchedTypeIdsForTransaction,
  filterModuleScopedSnapshot,
  filterModuleScopedWriteResult,
  formatScopedModuleCursor,
  formatScopedSyncDiagnostics,
  parseScopedModuleCursor,
  planRequestedSyncScope,
} from "./authority-sync-scope-planning.js";

const typePredicateId = edgeId(core.node.fields.type);
const workflowBranchTypeId = ops.workflowBranch.values.id as string;
const envVarTypeId = ops.envVar.values.id as string;

describe("authority sync scope planning", () => {
  it("plans the shipped workflow review scope and preserves graph fallback", () => {
    const authorization: AuthorizationContext = {
      graphId: "graph:test",
      principalId: "principal:test",
      principalKind: "human",
      sessionId: "session:test",
      policyVersion: 7,
      capabilityVersion: 0,
      capabilityGrantIds: [],
      roleKeys: [],
    };
    const typeIds = new Set<string>([workflowBranchTypeId]);

    expect(
      planRequestedSyncScope(undefined, authorization, typeIds, (scopeId, moduleId) => {
        throw new Error(`${moduleId}:${scopeId}`);
      }),
    ).toBeUndefined();

    expect(
      planRequestedSyncScope(workflowReviewModuleReadScope, authorization, typeIds, (scopeId) => {
        throw new Error(scopeId);
      }),
    ).toEqual({
      scope: {
        kind: "module",
        moduleId: workflowReviewModuleReadScope.moduleId,
        scopeId: workflowReviewModuleReadScope.scopeId,
        definitionHash: workflowReviewModuleReadScope.definitionHash,
        policyFilterVersion: "policy:7",
      },
      typeIds,
    });
  });

  it("formats and parses scoped cursors and diagnostics", () => {
    const scope = {
      kind: "module" as const,
      moduleId: workflowReviewModuleReadScope.moduleId,
      scopeId: workflowReviewModuleReadScope.scopeId,
      definitionHash: workflowReviewModuleReadScope.definitionHash,
      policyFilterVersion: "policy:3",
    };
    const cursor = formatScopedModuleCursor(scope, "web-authority:12");

    expect(parseScopedModuleCursor(cursor)).toEqual({
      ...scope,
      cursor: "web-authority:12",
    });
    expect(
      formatScopedSyncDiagnostics(scope, {
        retainedHistoryPolicy: { kind: "transaction-count", maxTransactions: 25 },
        retainedBaseCursor: "web-authority:5",
      }),
    ).toEqual({
      retainedHistoryPolicy: { kind: "transaction-count", maxTransactions: 25 },
      retainedBaseCursor: formatScopedModuleCursor(scope, "web-authority:5"),
    });
  });

  it("filters snapshots and write results down to scoped subject types", () => {
    const store = createStore();
    const workflowSubjectId = "workflow-branch:1";
    const envVarSubjectId = "env-var:1";
    const workflowTypeEdge = store.assert(workflowSubjectId, typePredicateId, workflowBranchTypeId);
    const workflowNameEdge = store.assert(
      workflowSubjectId,
      edgeId(core.node.fields.name),
      "Workflow branch",
    );
    const envVarTypeEdge = store.assert(envVarSubjectId, typePredicateId, envVarTypeId);
    const envVarNameEdge = store.assert(
      envVarSubjectId,
      edgeId(core.node.fields.name),
      "OPENAI_KEY",
    );
    const plannedScope = {
      scope: {
        kind: "module" as const,
        moduleId: workflowReviewModuleReadScope.moduleId,
        scopeId: workflowReviewModuleReadScope.scopeId,
        definitionHash: workflowReviewModuleReadScope.definitionHash,
        policyFilterVersion: "policy:0",
      },
      typeIds: new Set<string>([workflowBranchTypeId]),
    };
    const snapshot = {
      edges: store.snapshot().edges,
      retracted: [workflowNameEdge.id, envVarNameEdge.id],
    };

    expect(filterModuleScopedSnapshot(snapshot, store, typePredicateId, plannedScope)).toEqual({
      edges: [workflowTypeEdge, workflowNameEdge],
      retracted: [workflowNameEdge.id],
    });

    const edgeById = new Map(snapshot.edges.map((edge) => [edge.id, edge]));
    expect(
      filterModuleScopedWriteResult(
        {
          txId: "tx:1",
          cursor: "web-authority:9",
          replayed: false,
          writeScope: "client-tx",
          transaction: {
            id: "tx:1",
            ops: [
              { op: "assert", edge: workflowNameEdge },
              { op: "assert", edge: envVarNameEdge },
              { op: "retract", edgeId: envVarTypeEdge.id },
            ],
          },
        },
        store,
        edgeById,
        typePredicateId,
        plannedScope,
      ),
    ).toEqual({
      txId: "tx:1",
      cursor: formatScopedModuleCursor(plannedScope.scope, "web-authority:9"),
      replayed: false,
      writeScope: "client-tx",
      transaction: {
        id: "tx:1",
        ops: [{ op: "assert", edge: workflowNameEdge }],
      },
    });
  });

  it("collects touched type ids from asserted type edges and touched subjects", () => {
    const store = createStore();
    const workflowSubjectId = "workflow-branch:1";
    const envVarSubjectId = "env-var:1";
    const workflowTypeEdge = store.assert(workflowSubjectId, typePredicateId, workflowBranchTypeId);
    const envVarTypeEdge = store.assert(envVarSubjectId, typePredicateId, envVarTypeId);

    expect(
      collectTouchedTypeIdsForTransaction(store.snapshot(), store, typePredicateId, {
        id: "tx:touched-types",
        ops: [
          { op: "assert", edge: workflowTypeEdge },
          {
            op: "assert",
            edge: {
              id: "edge:new-env-var-name",
              s: envVarSubjectId,
              p: edgeId(core.node.fields.name),
              o: "OPENAI_KEY",
            },
          },
          { op: "retract", edgeId: envVarTypeEdge.id },
        ],
      }),
    ).toEqual([workflowBranchTypeId, envVarTypeId]);
  });
});
