import { describe, expect, it } from "bun:test";

import { bootstrap, createStore, createTypeClient } from "@io/core/graph";

import { createIdMap } from "../../../runtime/identity.js";
import { core } from "../../core.js";
import { ops } from "../../ops.js";
import {
  agentSessionKeyPattern,
  contextBundleKeyPattern,
  workflowBranchKeyPattern,
  workflowCommitKeyPattern,
  workflowMutationCommand,
  workflowMutationFailureCodes,
  workflowProjectKeyPattern,
  workflowRepositoryKeyPattern,
  workflowSchema,
} from "./schema.js";

const productGraph = { ...core, ...ops } as const;

const lifecycleContext = {
  event: "create" as const,
  nodeId: "workflow-1",
  now: new Date("2026-01-01T00:00:00.000Z"),
  incoming: undefined,
  previous: undefined,
  changedPredicateKeys: new Set<string>(),
};

describe("ops workflow schema", () => {
  it("exports the full workflow entity, enum, and mutation contract surface", () => {
    expect(Object.keys(workflowSchema).sort()).toEqual(
      [
        "agentSession",
        "agentSessionEvent",
        "agentSessionEventPhase",
        "agentSessionEventType",
        "agentSessionKind",
        "agentSessionRawLineEncoding",
        "agentSessionRuntimeState",
        "agentSessionStatusCode",
        "agentSessionStatusFormat",
        "agentSessionStream",
        "agentSessionSubjectKind",
        "contextBundle",
        "contextBundleEntry",
        "contextBundleEntrySource",
        "repositoryBranch",
        "repositoryCommit",
        "repositoryCommitLeaseState",
        "repositoryCommitState",
        "workflowArtifact",
        "workflowArtifactKind",
        "workflowBranch",
        "workflowBranchState",
        "workflowCommit",
        "workflowCommitState",
        "workflowDecision",
        "workflowDecisionKind",
        "workflowProject",
        "workflowRepository",
      ].sort(),
    );

    expect(workflowMutationCommand.key).toBe("ops:workflow:mutation");
    expect(workflowMutationFailureCodes).toEqual([
      "repository-missing",
      "branch-lock-conflict",
      "commit-lock-conflict",
      "invalid-transition",
      "subject-not-found",
    ]);
    expect(workflowMutationCommand.policy.touchesPredicates).toEqual(
      expect.arrayContaining([
        ops.workflowProject.fields.projectKey.key,
        ops.workflowRepository.fields.repositoryKey.key,
        ops.workflowBranch.fields.state.key,
        ops.workflowBranch.fields.activeCommit.key,
        ops.workflowCommit.fields.state.key,
      ]),
    );
  });

  it("owns stable keys for workflow lineage, retained execution, and repository execution records", () => {
    const { map } = createIdMap(workflowSchema);

    expect(Object.keys(map.keys)).toEqual(
      expect.arrayContaining([
        "ops:workflowProject",
        "ops:workflowProject:projectKey",
        "ops:workflowRepository",
        "ops:workflowRepository:project",
        "ops:workflowRepository:repositoryKey",
        "ops:workflowBranchState",
        "ops:workflowBranchState.backlog",
        "ops:workflowBranch",
        "ops:workflowBranch:activeCommit",
        "ops:workflowCommitState",
        "ops:workflowCommit",
        "ops:workflowCommit:parentCommit",
        "ops:repositoryBranch",
        "ops:repositoryBranch:workflowBranch",
        "ops:repositoryCommitState",
        "ops:repositoryCommitLeaseState",
        "ops:repositoryCommit",
        "ops:repositoryCommit:worktree",
        "ops:repositoryCommit:worktree:leaseState",
        "ops:agentSessionSubjectKind",
        "ops:agentSessionKind",
        "ops:agentSessionRuntimeState",
        "ops:agentSession",
        "ops:agentSession:sessionKey",
        "ops:agentSession:branch",
        "ops:agentSession:contextBundle",
        "ops:agentSessionEventType",
        "ops:agentSessionEventPhase",
        "ops:agentSessionStatusCode",
        "ops:agentSessionStatusFormat",
        "ops:agentSessionStream",
        "ops:agentSessionRawLineEncoding",
        "ops:agentSessionEvent",
        "ops:agentSessionEvent:session",
        "ops:agentSessionEvent:statusCode",
        "ops:workflowArtifactKind",
        "ops:workflowArtifact",
        "ops:workflowArtifact:session",
        "ops:workflowDecisionKind",
        "ops:workflowDecision",
        "ops:workflowDecision:session",
        "ops:contextBundle",
        "ops:contextBundle:bundleKey",
        "ops:contextBundle:session",
        "ops:contextBundleEntrySource",
        "ops:contextBundleEntrySource.repo-path",
        "ops:contextBundleEntry",
        "ops:contextBundleEntry:bundle",
        "ops:contextBundleEntry:source",
      ]),
    );
  });

  it("resolves workflow lineage, retained execution refs, and event enums through the canonical ops namespace", () => {
    expect(String(ops.workflowRepository.fields.project.range)).toBe(ops.workflowProject.values.id);
    expect(String(ops.workflowBranch.fields.project.range)).toBe(ops.workflowProject.values.id);
    expect(String(ops.workflowBranch.fields.activeCommit.range)).toBe(ops.workflowCommit.values.id);
    expect(String(ops.workflowCommit.fields.branch.range)).toBe(ops.workflowBranch.values.id);
    expect(String(ops.repositoryBranch.fields.repository.range)).toBe(
      ops.workflowRepository.values.id,
    );
    expect(String(ops.repositoryCommit.fields.repositoryBranch.range)).toBe(
      ops.repositoryBranch.values.id,
    );
    expect(String(ops.repositoryCommit.fields.workflowCommit.range)).toBe(
      ops.workflowCommit.values.id,
    );
    expect(String(ops.repositoryCommit.fields.worktree.leaseState.range)).toBe(
      ops.repositoryCommitLeaseState.values.id,
    );
    expect(String(ops.agentSession.fields.project.range)).toBe(ops.workflowProject.values.id);
    expect(String(ops.agentSession.fields.repository.range)).toBe(ops.workflowRepository.values.id);
    expect(String(ops.agentSession.fields.subjectKind.range)).toBe(
      ops.agentSessionSubjectKind.values.id,
    );
    expect(String(ops.agentSession.fields.branch.range)).toBe(ops.workflowBranch.values.id);
    expect(String(ops.agentSession.fields.commit.range)).toBe(ops.workflowCommit.values.id);
    expect(String(ops.agentSession.fields.contextBundle.range)).toBe(ops.contextBundle.values.id);
    expect(String(ops.agentSession.fields.kind.range)).toBe(ops.agentSessionKind.values.id);
    expect(String(ops.agentSession.fields.runtimeState.range)).toBe(
      ops.agentSessionRuntimeState.values.id,
    );
    expect(String(ops.agentSessionEvent.fields.session.range)).toBe(ops.agentSession.values.id);
    expect(String(ops.agentSessionEvent.fields.type.range)).toBe(
      ops.agentSessionEventType.values.id,
    );
    expect(String(ops.agentSessionEvent.fields.phase.range)).toBe(
      ops.agentSessionEventPhase.values.id,
    );
    expect(String(ops.agentSessionEvent.fields.statusCode.range)).toBe(
      ops.agentSessionStatusCode.values.id,
    );
    expect(String(ops.agentSessionEvent.fields.format.range)).toBe(
      ops.agentSessionStatusFormat.values.id,
    );
    expect(String(ops.agentSessionEvent.fields.stream.range)).toBe(
      ops.agentSessionStream.values.id,
    );
    expect(String(ops.agentSessionEvent.fields.encoding.range)).toBe(
      ops.agentSessionRawLineEncoding.values.id,
    );
    expect(String(ops.workflowArtifact.fields.session.range)).toBe(ops.agentSession.values.id);
    expect(String(ops.workflowArtifact.fields.kind.range)).toBe(ops.workflowArtifactKind.values.id);
    expect(String(ops.workflowDecision.fields.session.range)).toBe(ops.agentSession.values.id);
    expect(String(ops.workflowDecision.fields.kind.range)).toBe(ops.workflowDecisionKind.values.id);
    expect(String(ops.contextBundle.fields.session.range)).toBe(ops.agentSession.values.id);
    expect(String(ops.contextBundle.fields.subjectKind.range)).toBe(
      ops.agentSessionSubjectKind.values.id,
    );
    expect(String(ops.contextBundleEntry.fields.bundle.range)).toBe(ops.contextBundle.values.id);
    expect(String(ops.contextBundleEntry.fields.source.range)).toBe(
      ops.contextBundleEntrySource.values.id,
    );
    expect(typeof ops.workflowProject.fields.projectKey.id).toBe("string");
    expect(typeof ops.agentSession.fields.sessionKey.id).toBe("string");
    expect(typeof ops.contextBundle.fields.bundleKey.id).toBe("string");
  });

  it("validates stable retained keys and defaults retained execution lifecycle fields", () => {
    expect(workflowProjectKeyPattern.test("project:io")).toBe(true);
    expect(workflowRepositoryKeyPattern.test("repo:io")).toBe(true);
    expect(workflowBranchKeyPattern.test("branch:workflow-graph-native")).toBe(true);
    expect(workflowCommitKeyPattern.test("commit:branch-runtime-view")).toBe(true);
    expect(agentSessionKeyPattern.test("session:branch-runtime-view-plan-01")).toBe(true);
    expect(contextBundleKeyPattern.test("bundle:branch-runtime-view-plan-01")).toBe(true);

    expect(
      ops.agentSession.fields.sessionKey.validate?.({
        event: "create",
        phase: "local",
        nodeId: "agent-session-1",
        now: new Date("2026-01-01T00:00:00.000Z"),
        path: [],
        field: "sessionKey",
        predicateKey: ops.agentSession.fields.sessionKey.key,
        range: ops.agentSession.fields.sessionKey.range,
        cardinality: ops.agentSession.fields.sessionKey.cardinality,
        value: "branch:runtime-view",
        previous: undefined,
        changedPredicateKeys: new Set<string>([ops.agentSession.fields.sessionKey.key]),
      }),
    ).toEqual({
      code: "workflow.key.invalid",
      message:
        'Session key must start with "session:" and use only lowercase letters, numbers, and hyphen-separated segments.',
    });

    expect(
      ops.contextBundleEntry.fields.order.validate?.({
        event: "create",
        phase: "local",
        nodeId: "context-bundle-entry-1",
        now: new Date("2026-01-01T00:00:00.000Z"),
        path: [],
        field: "order",
        predicateKey: ops.contextBundleEntry.fields.order.key,
        range: ops.contextBundleEntry.fields.order.range,
        cardinality: ops.contextBundleEntry.fields.order.cardinality,
        value: -1,
        previous: undefined,
        changedPredicateKeys: new Set<string>([ops.contextBundleEntry.fields.order.key]),
      }),
    ).toEqual({
      code: "workflow.integer.invalid",
      message: "Context entry order must be a non-negative integer.",
    });

    expect(ops.workflowProject.fields.inferred.onCreate?.(lifecycleContext)).toBe(true);
    expect(ops.repositoryBranch.fields.managed.onCreate?.(lifecycleContext)).toBe(false);
    expect(ops.workflowBranch.fields.state.onCreate?.(lifecycleContext)).toBe(
      ops.workflowBranchState.values.backlog.id,
    );
    expect(ops.workflowCommit.fields.state.onCreate?.(lifecycleContext)).toBe(
      ops.workflowCommitState.values.planned.id,
    );
    expect(ops.repositoryCommit.fields.state.onCreate?.(lifecycleContext)).toBe(
      ops.repositoryCommitState.values.planned.id,
    );
    expect(ops.repositoryCommit.fields.worktree.leaseState.onCreate?.(lifecycleContext)).toBe(
      ops.repositoryCommitLeaseState.values.unassigned.id,
    );
    expect(ops.agentSession.fields.runtimeState.onCreate?.(lifecycleContext)).toBe(
      ops.agentSessionRuntimeState.values.running.id,
    );
    expect(ops.agentSession.fields.startedAt.onCreate?.(lifecycleContext)).toBe(
      lifecycleContext.now,
    );
    expect(ops.agentSessionEvent.fields.timestamp.onCreate?.(lifecycleContext)).toBe(
      lifecycleContext.now,
    );
  });

  it("preserves retained execution provenance across sessions, artifacts, decisions, and bundles", () => {
    const store = createStore();
    bootstrap(store, core);
    bootstrap(store, ops);
    const graph = createTypeClient(store, productGraph);

    const projectId = graph.workflowProject.create({
      name: "IO",
      projectKey: "project:io",
    });
    const repositoryId = graph.workflowRepository.create({
      name: "io",
      project: projectId,
      repositoryKey: "repo:io",
      repoRoot: "/tmp/io",
      defaultBaseBranch: "main",
    });
    const branchId = graph.workflowBranch.create({
      name: "Workflow authority",
      project: projectId,
      branchKey: "branch:workflow-authority",
      state: ops.workflowBranchState.values.ready.id,
      goalSummary: "Protect workflow contracts with direct regression coverage.",
    });
    const commitId = graph.workflowCommit.create({
      name: "Add contract tests",
      branch: branchId,
      commitKey: "commit:add-contract-tests",
      state: ops.workflowCommitState.values.active.id,
      order: 0,
    });
    const repositoryBranchId = graph.repositoryBranch.create({
      name: "workflow-authority",
      project: projectId,
      repository: repositoryId,
      workflowBranch: branchId,
      managed: true,
      branchName: "workflow-authority",
      baseBranchName: "main",
    });
    const repositoryCommitId = graph.repositoryCommit.create({
      name: "Add contract tests",
      repository: repositoryId,
      repositoryBranch: repositoryBranchId,
      workflowCommit: commitId,
      state: ops.repositoryCommitState.values.attached.id,
      worktree: {
        path: "/tmp/io-worktree",
        branchName: "workflow-authority",
        leaseState: ops.repositoryCommitLeaseState.values.attached.id,
      },
    });
    const sessionId = graph.agentSession.create({
      name: "Execute workflow contracts",
      project: projectId,
      repository: repositoryId,
      subjectKind: ops.agentSessionSubjectKind.values.commit.id,
      branch: branchId,
      commit: commitId,
      sessionKey: "session:workflow-authority-execution-01",
      kind: ops.agentSessionKind.values.execution.id,
      workerId: "worker-1",
    });
    const bundleId = graph.contextBundle.create({
      name: "Workflow execution bundle",
      session: sessionId,
      subjectKind: ops.agentSessionSubjectKind.values.commit.id,
      branch: branchId,
      commit: commitId,
      bundleKey: "bundle:workflow-authority-execution-01",
      sourceHash: "sha256:workflow-authority",
    });
    graph.agentSession.update(sessionId, {
      contextBundle: bundleId,
    });
    const eventId = graph.agentSessionEvent.create({
      name: "Commit selected",
      session: sessionId,
      type: ops.agentSessionEventType.values.status.id,
      sequence: 0,
      statusCode: ops.agentSessionStatusCode.values["commit-selected"].id,
      format: ops.agentSessionStatusFormat.values.line.id,
      text: "Commit selected",
    });
    const artifactId = graph.workflowArtifact.create({
      name: "Patch summary",
      project: projectId,
      repository: repositoryId,
      branch: branchId,
      commit: commitId,
      session: sessionId,
      kind: ops.workflowArtifactKind.values.patch.id,
      bodyText: "Summarize the contract coverage.",
    });
    const decisionId = graph.workflowDecision.create({
      name: "Keep singleton repository scope",
      project: projectId,
      repository: repositoryId,
      branch: branchId,
      commit: commitId,
      session: sessionId,
      kind: ops.workflowDecisionKind.values.assumption.id,
      details: "Branch 6 v1 keeps one attached repository per graph.",
    });
    const entryId = graph.contextBundleEntry.create({
      name: "Branch 6 workflow contract",
      bundle: bundleId,
      order: 0,
      source: ops.contextBundleEntrySource.values["repo-path"].id,
      path: "doc/branch/06-workflow-and-agent-runtime.md",
      bodyText: "Workflow contract reference",
    });

    expect(graph.repositoryCommit.get(repositoryCommitId)).toMatchObject({
      repository: repositoryId,
      repositoryBranch: repositoryBranchId,
      workflowCommit: commitId,
      state: ops.repositoryCommitState.values.attached.id,
      worktree: {
        path: "/tmp/io-worktree",
        branchName: "workflow-authority",
        leaseState: ops.repositoryCommitLeaseState.values.attached.id,
      },
    });
    expect(graph.agentSession.get(sessionId)).toMatchObject({
      project: projectId,
      repository: repositoryId,
      branch: branchId,
      commit: commitId,
      contextBundle: bundleId,
      sessionKey: "session:workflow-authority-execution-01",
      subjectKind: ops.agentSessionSubjectKind.values.commit.id,
      kind: ops.agentSessionKind.values.execution.id,
    });
    expect(graph.agentSessionEvent.get(eventId)).toMatchObject({
      session: sessionId,
      type: ops.agentSessionEventType.values.status.id,
      statusCode: ops.agentSessionStatusCode.values["commit-selected"].id,
      format: ops.agentSessionStatusFormat.values.line.id,
    });
    expect(graph.workflowArtifact.get(artifactId)).toMatchObject({
      project: projectId,
      repository: repositoryId,
      branch: branchId,
      commit: commitId,
      session: sessionId,
      kind: ops.workflowArtifactKind.values.patch.id,
    });
    expect(graph.workflowDecision.get(decisionId)).toMatchObject({
      project: projectId,
      repository: repositoryId,
      branch: branchId,
      commit: commitId,
      session: sessionId,
      kind: ops.workflowDecisionKind.values.assumption.id,
    });
    expect(graph.contextBundle.get(bundleId)).toMatchObject({
      session: sessionId,
      branch: branchId,
      commit: commitId,
      bundleKey: "bundle:workflow-authority-execution-01",
      subjectKind: ops.agentSessionSubjectKind.values.commit.id,
    });
    expect(graph.contextBundleEntry.get(entryId)).toMatchObject({
      bundle: bundleId,
      order: 0,
      source: ops.contextBundleEntrySource.values["repo-path"].id,
      path: "doc/branch/06-workflow-and-agent-runtime.md",
    });
  });
});
