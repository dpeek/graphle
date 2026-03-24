import type { NamespaceClient } from "@io/core/graph";

import opsIds from "../../ops.json";
import type {
  RepositoryBranchSummary,
  RepositoryCommitSummary,
  WorkflowBranchStateValue,
  WorkflowBranchSummary,
  WorkflowCommitSummary,
  WorkflowProjectSummary,
  WorkflowRepositorySummary,
} from "./command.js";
import {
  repositoryCommitLeaseStateValues,
  repositoryCommitStateValues,
  workflowBranchStateValues,
  workflowCommitStateValues,
} from "./command.js";
import { workflowProjectionMetadata } from "./projection.js";
import {
  agentSession,
  agentSessionKind,
  agentSessionRuntimeState,
  agentSessionSubjectKind,
  repositoryBranch,
  repositoryCommit,
  repositoryCommitLeaseState,
  repositoryCommitState,
  workflowBranch,
  workflowBranchState,
  workflowCommit,
  workflowCommitState,
  workflowProject,
  workflowRepository,
} from "./type.js";

export const projectBranchScopeFailureCodes = [
  "project-not-found",
  "policy-denied",
  "projection-stale",
] as const;

export type ProjectBranchScopeFailureCode = (typeof projectBranchScopeFailureCodes)[number];

export const projectBranchScopeOrderFieldValues = [
  "queue-rank",
  "updated-at",
  "created-at",
  "title",
  "state",
] as const;

export type ProjectBranchScopeOrderField = (typeof projectBranchScopeOrderFieldValues)[number];

export const projectBranchScopeOrderDirectionValues = ["asc", "desc"] as const;

export type ProjectBranchScopeOrderDirection =
  (typeof projectBranchScopeOrderDirectionValues)[number];

export const projectBranchScopeRepositoryFreshnessValues = ["fresh", "stale", "missing"] as const;

export type ProjectBranchScopeRepositoryFreshness =
  (typeof projectBranchScopeRepositoryFreshnessValues)[number];

export type ProjectBranchScopeOrderClause = {
  readonly direction: ProjectBranchScopeOrderDirection;
  readonly field: ProjectBranchScopeOrderField;
};

export const defaultProjectBranchScopeOrder = [
  { field: "queue-rank", direction: "asc" },
  { field: "updated-at", direction: "desc" },
  { field: "title", direction: "asc" },
] as const satisfies readonly ProjectBranchScopeOrderClause[];

export interface ProjectBranchScopeFilters {
  readonly hasActiveCommit?: boolean;
  readonly showUnmanagedRepositoryBranches?: boolean;
  readonly states?: readonly WorkflowBranchStateValue[];
}

export interface ProjectBranchScopeQuery {
  readonly cursor?: string;
  readonly filter?: ProjectBranchScopeFilters;
  readonly limit?: number;
  readonly order?: readonly ProjectBranchScopeOrderClause[];
  readonly projectId: string;
}

export interface ProjectBranchScopeRepositoryObservation {
  readonly freshness: ProjectBranchScopeRepositoryFreshness;
  readonly repositoryBranch: RepositoryBranchSummary;
}

export interface ProjectBranchScopeManagedRow {
  readonly repositoryBranch?: ProjectBranchScopeRepositoryObservation;
  readonly workflowBranch: WorkflowBranchSummary;
}

export interface ProjectBranchScopeFreshness {
  readonly projectedAt: string;
  readonly projectionCursor?: string;
  readonly repositoryFreshness: ProjectBranchScopeRepositoryFreshness;
  readonly repositoryReconciledAt?: string;
}

export interface ProjectBranchScopeResult {
  readonly freshness: ProjectBranchScopeFreshness;
  readonly nextCursor?: string;
  readonly project: WorkflowProjectSummary;
  readonly repository?: WorkflowRepositorySummary;
  readonly rows: readonly ProjectBranchScopeManagedRow[];
  readonly unmanagedRepositoryBranches: readonly ProjectBranchScopeRepositoryObservation[];
}

export const commitQueueScopeFailureCodes = [
  "branch-not-found",
  "policy-denied",
  "projection-stale",
] as const;

export type CommitQueueScopeFailureCode = (typeof commitQueueScopeFailureCodes)[number];

export type CommitQueueScopeSessionKind = keyof typeof agentSessionKind.options;

export type CommitQueueScopeSessionRuntimeState = keyof typeof agentSessionRuntimeState.options;

export type CommitQueueScopeSessionSubject =
  | {
      readonly kind: "branch";
    }
  | {
      readonly commitId: string;
      readonly kind: "commit";
    };

export interface CommitQueueScopeQuery {
  readonly branchId: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export type CommitQueueScopeRepositoryObservation = ProjectBranchScopeRepositoryObservation;

export interface CommitQueueScopeCommitRow {
  readonly repositoryCommit?: RepositoryCommitSummary;
  readonly workflowCommit: WorkflowCommitSummary;
}

export interface CommitQueueScopeSessionSummary {
  readonly endedAt?: string;
  readonly id: string;
  readonly kind: CommitQueueScopeSessionKind;
  readonly runtimeState: CommitQueueScopeSessionRuntimeState;
  readonly sessionKey: string;
  readonly startedAt: string;
  readonly subject: CommitQueueScopeSessionSubject;
}

export interface CommitQueueScopeBranchDetail {
  readonly activeCommit?: CommitQueueScopeCommitRow;
  readonly latestSession?: CommitQueueScopeSessionSummary;
  readonly repositoryBranch?: CommitQueueScopeRepositoryObservation;
  readonly workflowBranch: WorkflowBranchSummary;
}

export type CommitQueueScopeFreshness = ProjectBranchScopeFreshness;

export interface CommitQueueScopeResult {
  readonly branch: CommitQueueScopeBranchDetail;
  readonly freshness: CommitQueueScopeFreshness;
  readonly nextCursor?: string;
  readonly rows: readonly CommitQueueScopeCommitRow[];
}

const workflowProjectionGraph = {
  workflowProject,
  workflowRepository,
  workflowBranchState,
  workflowBranch,
  workflowCommitState,
  workflowCommit,
  repositoryBranch,
  repositoryCommitState,
  repositoryCommitLeaseState,
  repositoryCommit,
  agentSessionSubjectKind,
  agentSessionKind,
  agentSessionRuntimeState,
  agentSession,
} as const;

type WorkflowProjectionTypeClient = NamespaceClient<typeof workflowProjectionGraph>;
type WorkflowProjectEntity = ReturnType<WorkflowProjectionTypeClient["workflowProject"]["get"]>;
type WorkflowRepositoryEntity = ReturnType<
  WorkflowProjectionTypeClient["workflowRepository"]["get"]
>;
type WorkflowBranchEntity = ReturnType<WorkflowProjectionTypeClient["workflowBranch"]["get"]>;
type WorkflowCommitEntity = ReturnType<WorkflowProjectionTypeClient["workflowCommit"]["get"]>;
type RepositoryBranchEntity = ReturnType<WorkflowProjectionTypeClient["repositoryBranch"]["get"]>;
type RepositoryCommitEntity = ReturnType<WorkflowProjectionTypeClient["repositoryCommit"]["get"]>;
type AgentSessionEntity = ReturnType<WorkflowProjectionTypeClient["agentSession"]["get"]>;

export interface WorkflowProjectionGraphClient {
  readonly workflowProject: {
    list(): WorkflowProjectEntity[];
  };
  readonly workflowRepository: {
    list(): WorkflowRepositoryEntity[];
  };
  readonly workflowBranch: {
    list(): WorkflowBranchEntity[];
  };
  readonly workflowCommit: {
    list(): WorkflowCommitEntity[];
  };
  readonly repositoryBranch: {
    list(): RepositoryBranchEntity[];
  };
  readonly repositoryCommit: {
    list(): RepositoryCommitEntity[];
  };
  readonly agentSession: {
    list(): AgentSessionEntity[];
  };
}
type WorkflowProjectionErrorCode = ProjectBranchScopeFailureCode | CommitQueueScopeFailureCode;
type WorkflowProjectionCursorKind = "project-branch" | "commit-queue";
type WorkflowProjectionCursor = {
  readonly anchorId: string;
  readonly kind: WorkflowProjectionCursorKind;
  readonly offset: number;
  readonly projectionCursor: string;
  readonly version: 1;
};
type WorkflowProjectionFreshnessEntry = {
  readonly repositoryFreshness: ProjectBranchScopeRepositoryFreshness;
  readonly repositoryReconciledAt?: string;
};
type WorkflowProjectionIndexState = {
  readonly activeCommitByBranchId: ReadonlyMap<string, CommitQueueScopeCommitRow>;
  readonly branchById: ReadonlyMap<string, WorkflowBranchSummary>;
  readonly branchesByProjectId: ReadonlyMap<string, readonly WorkflowBranchSummary[]>;
  readonly commitRowsByBranchId: ReadonlyMap<string, readonly CommitQueueScopeCommitRow[]>;
  readonly latestSessionByBranchId: ReadonlyMap<string, CommitQueueScopeSessionSummary>;
  readonly managedRepositoryBranchByBranchId: ReadonlyMap<
    string,
    ProjectBranchScopeRepositoryObservation
  >;
  readonly projectById: ReadonlyMap<string, WorkflowProjectSummary>;
  readonly projectFreshnessById: ReadonlyMap<string, WorkflowProjectionFreshnessEntry>;
  readonly repositoryByProjectId: ReadonlyMap<string, WorkflowRepositorySummary>;
  readonly unmanagedRepositoryBranchesByProjectId: ReadonlyMap<
    string,
    readonly ProjectBranchScopeRepositoryObservation[]
  >;
};

const agentSessionKindValues = ["planning", "execution", "review"] as const;
const agentSessionRuntimeStateValues = [
  "running",
  "awaiting-user-input",
  "blocked",
  "completed",
  "failed",
  "cancelled",
] as const;
const agentSessionSubjectKindValues = ["branch", "commit"] as const;
const workflowProjectionCursorPrefix = "workflow-projection:";

const workflowBranchStateIds = Object.fromEntries(
  workflowBranchStateValues.map((value) => [
    value,
    resolvedEnumValue(workflowBranchState.values[value]),
  ]),
) as Record<WorkflowBranchStateValue, string>;

const workflowCommitStateIds = Object.fromEntries(
  workflowCommitStateValues.map((value) => [
    value,
    resolvedEnumValue(workflowCommitState.values[value]),
  ]),
) as Record<(typeof workflowCommitStateValues)[number], string>;

const repositoryCommitStateIds = Object.fromEntries(
  repositoryCommitStateValues.map((value) => [
    value,
    resolvedEnumValue(repositoryCommitState.values[value]),
  ]),
) as Record<(typeof repositoryCommitStateValues)[number], string>;

const repositoryCommitLeaseStateIds = Object.fromEntries(
  repositoryCommitLeaseStateValues.map((value) => [
    value,
    resolvedEnumValue(repositoryCommitLeaseState.values[value]),
  ]),
) as Record<(typeof repositoryCommitLeaseStateValues)[number], string>;

const agentSessionKindIds = Object.fromEntries(
  agentSessionKindValues.map((value) => [value, resolvedEnumValue(agentSessionKind.values[value])]),
) as Record<CommitQueueScopeSessionKind, string>;

const agentSessionRuntimeStateIds = Object.fromEntries(
  agentSessionRuntimeStateValues.map((value) => [
    value,
    resolvedEnumValue(agentSessionRuntimeState.values[value]),
  ]),
) as Record<CommitQueueScopeSessionRuntimeState, string>;

const agentSessionSubjectKindIds = Object.fromEntries(
  agentSessionSubjectKindValues.map((value) => [
    value,
    resolvedEnumValue(agentSessionSubjectKind.values[value]),
  ]),
) as Record<(typeof agentSessionSubjectKindValues)[number], string>;

const workflowBranchStateKeysById = invertRecord(workflowBranchStateIds);
const workflowCommitStateKeysById = invertRecord(workflowCommitStateIds);
const repositoryCommitStateKeysById = invertRecord(repositoryCommitStateIds);
const repositoryCommitLeaseStateKeysById = invertRecord(repositoryCommitLeaseStateIds);
const agentSessionKindKeysById = invertRecord(agentSessionKindIds);
const agentSessionRuntimeStateKeysById = invertRecord(agentSessionRuntimeStateIds);
const agentSessionSubjectKindKeysById = invertRecord(agentSessionSubjectKindIds);
const workflowBranchStateOrder = new Map(
  workflowBranchStateValues.map((value, index) => [value, index] as const),
);

export class WorkflowProjectionQueryError extends Error {
  readonly code: WorkflowProjectionErrorCode;

  constructor(code: WorkflowProjectionErrorCode, message: string) {
    super(message);
    this.name = "WorkflowProjectionQueryError";
    this.code = code;
  }
}

export interface WorkflowProjectionIndexOptions {
  readonly projectedAt?: Date | string;
  readonly projectionCursor?: string;
}

export interface WorkflowProjectionIndex {
  readonly projections: typeof workflowProjectionMetadata;
  readonly projectedAt: string;
  readonly projectionCursor: string;
  readCommitQueueScope(query: CommitQueueScopeQuery): CommitQueueScopeResult;
  readProjectBranchScope(query: ProjectBranchScopeQuery): ProjectBranchScopeResult;
}

export function createWorkflowProjectionIndex(
  graph: WorkflowProjectionGraphClient,
  options: WorkflowProjectionIndexOptions = {},
): WorkflowProjectionIndex {
  const projectedAt = normalizeProjectedAt(options.projectedAt);
  const state = buildWorkflowProjectionIndexState(graph);
  const projectionCursor = options.projectionCursor ?? buildProjectionCursor(state);

  function readProjectBranchScope(query: ProjectBranchScopeQuery): ProjectBranchScopeResult {
    const project = state.projectById.get(query.projectId);
    if (!project) {
      throw new WorkflowProjectionQueryError(
        "project-not-found",
        `Workflow project "${query.projectId}" was not found in the current projection.`,
      );
    }

    const ordered = sortWorkflowBranches(
      state.branchesByProjectId.get(query.projectId) ?? [],
      query.order,
    );
    const filtered = filterProjectBranchRows(ordered, query.filter);
    const page = paginateWorkflowProjectionRows({
      anchorId: query.projectId,
      items: filtered,
      cursor: query.cursor,
      kind: "project-branch",
      limit: query.limit,
      projectionCursor,
    });

    const freshness = createScopeFreshness(
      projectedAt,
      projectionCursor,
      state.projectFreshnessById.get(query.projectId),
    );
    const repository = state.repositoryByProjectId.get(query.projectId);

    return {
      project,
      ...(repository ? { repository } : {}),
      rows: page.items.map((workflowBranch) => ({
        workflowBranch,
        ...(state.managedRepositoryBranchByBranchId.get(workflowBranch.id)
          ? {
              repositoryBranch: state.managedRepositoryBranchByBranchId.get(workflowBranch.id),
            }
          : {}),
      })),
      unmanagedRepositoryBranches: query.filter?.showUnmanagedRepositoryBranches
        ? (state.unmanagedRepositoryBranchesByProjectId.get(query.projectId) ?? [])
        : [],
      freshness,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    };
  }

  function readCommitQueueScope(query: CommitQueueScopeQuery): CommitQueueScopeResult {
    const workflowBranch = state.branchById.get(query.branchId);
    if (!workflowBranch) {
      throw new WorkflowProjectionQueryError(
        "branch-not-found",
        `Workflow branch "${query.branchId}" was not found in the current projection.`,
      );
    }

    const rows = state.commitRowsByBranchId.get(query.branchId) ?? [];
    const page = paginateWorkflowProjectionRows({
      anchorId: query.branchId,
      items: rows,
      cursor: query.cursor,
      kind: "commit-queue",
      limit: query.limit,
      projectionCursor,
    });

    return {
      branch: {
        workflowBranch,
        ...(state.managedRepositoryBranchByBranchId.get(query.branchId)
          ? {
              repositoryBranch: state.managedRepositoryBranchByBranchId.get(query.branchId),
            }
          : {}),
        ...(state.activeCommitByBranchId.get(query.branchId)
          ? { activeCommit: state.activeCommitByBranchId.get(query.branchId) }
          : {}),
        ...(state.latestSessionByBranchId.get(query.branchId)
          ? { latestSession: state.latestSessionByBranchId.get(query.branchId) }
          : {}),
      },
      rows: page.items,
      freshness: createScopeFreshness(
        projectedAt,
        projectionCursor,
        state.projectFreshnessById.get(workflowBranch.projectId),
      ),
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    };
  }

  return {
    projections: workflowProjectionMetadata,
    projectedAt,
    projectionCursor,
    readProjectBranchScope,
    readCommitQueueScope,
  };
}

function buildWorkflowProjectionIndexState(
  graph: WorkflowProjectionGraphClient,
): WorkflowProjectionIndexState {
  const projectById = new Map(
    graph.workflowProject.list().map((project) => [project.id, buildProjectSummary(project)]),
  );
  const repositoriesByProjectId = groupBy(
    graph.workflowRepository.list().map(buildRepositorySummary),
    (repository) => repository.projectId,
  );
  const repositoryByProjectId = new Map<string, WorkflowRepositorySummary>();
  for (const [projectId, repositories] of repositoriesByProjectId.entries()) {
    const sorted = [...repositories].sort(compareWorkflowRepositories);
    if (sorted[0]) repositoryByProjectId.set(projectId, sorted[0]);
  }

  const branchById = new Map<string, WorkflowBranchSummary>();
  const branchesByProjectId = groupBy(
    graph.workflowBranch.list().map((branch) => {
      const summary = buildBranchSummary(branch);
      branchById.set(summary.id, summary);
      return summary;
    }),
    (branch) => branch.projectId,
  );

  const repositoryCommitByWorkflowCommitId = new Map<string, RepositoryCommitSummary>();
  const repositoryCommitsByWorkflowCommitId = groupBy(
    graph.repositoryCommit.list().map(buildRepositoryCommitSummary),
    (repositoryCommit) => repositoryCommit.workflowCommitId,
  );
  for (const [
    workflowCommitId,
    repositoryCommits,
  ] of repositoryCommitsByWorkflowCommitId.entries()) {
    if (!workflowCommitId) continue;
    const sorted = [...repositoryCommits].sort(compareRepositoryCommitSummaries);
    if (sorted[0]) repositoryCommitByWorkflowCommitId.set(workflowCommitId, sorted[0]);
  }

  const commitRowsByBranchId = groupBy(
    graph.workflowCommit.list().map((commit) => {
      const workflowCommitSummary = buildCommitSummary(commit);
      return {
        workflowCommit: workflowCommitSummary,
        ...(repositoryCommitByWorkflowCommitId.get(workflowCommitSummary.id)
          ? {
              repositoryCommit: repositoryCommitByWorkflowCommitId.get(workflowCommitSummary.id),
            }
          : {}),
      } satisfies CommitQueueScopeCommitRow;
    }),
    (row) => row.workflowCommit.branchId,
  );
  for (const [branchId, rows] of commitRowsByBranchId.entries()) {
    commitRowsByBranchId.set(branchId, [...rows].sort(compareCommitQueueRows));
  }

  const managedRepositoryBranchByBranchId = new Map<
    string,
    ProjectBranchScopeRepositoryObservation
  >();
  const unmanagedRepositoryBranchesByProjectId = new Map<
    string,
    readonly ProjectBranchScopeRepositoryObservation[]
  >();
  const repositoryBranchesByProjectId = groupBy(
    graph.repositoryBranch.list().map(buildRepositoryBranchSummary),
    (repositoryBranchSummary) => repositoryBranchSummary.projectId,
  );
  for (const [projectId, repositoryBranches] of repositoryBranchesByProjectId.entries()) {
    const unmanaged = repositoryBranches
      .filter(
        (repositoryBranchSummary) =>
          !repositoryBranchSummary.managed || !repositoryBranchSummary.workflowBranchId,
      )
      .map((repositoryBranchSummary) => ({
        freshness: resolveRepositoryObservationFreshness(repositoryBranchSummary),
        repositoryBranch: repositoryBranchSummary,
      }))
      .sort(compareRepositoryObservations);
    unmanagedRepositoryBranchesByProjectId.set(projectId, unmanaged);

    const managedByBranchId = groupBy(
      repositoryBranches.filter(
        (repositoryBranchSummary) =>
          repositoryBranchSummary.managed && Boolean(repositoryBranchSummary.workflowBranchId),
      ),
      (repositoryBranchSummary) => repositoryBranchSummary.workflowBranchId,
    );
    for (const [branchId, managedRepositoryBranches] of managedByBranchId.entries()) {
      if (!branchId) continue;
      const selected = [...managedRepositoryBranches].sort(compareRepositoryBranchSummaries)[0];
      if (!selected) continue;
      managedRepositoryBranchByBranchId.set(branchId, {
        freshness: resolveRepositoryObservationFreshness(selected),
        repositoryBranch: selected,
      });
    }
  }

  const activeCommitByBranchId = new Map<string, CommitQueueScopeCommitRow>();
  for (const branch of branchById.values()) {
    if (!branch.activeCommitId) continue;
    const row = (commitRowsByBranchId.get(branch.id) ?? []).find(
      (commitRow) => commitRow.workflowCommit.id === branch.activeCommitId,
    );
    if (row) activeCommitByBranchId.set(branch.id, row);
  }

  const latestSessionByBranchId = new Map<string, CommitQueueScopeSessionSummary>();
  const sessionsByBranchId = groupBy(
    graph.agentSession
      .list()
      .map(buildCommitQueueScopeSessionSummary)
      .filter(
        (summary): summary is CommitQueueScopeSessionSummary & { readonly branchId: string } =>
          Boolean(summary),
      ),
    (summary) => summary.branchId,
  );
  for (const [branchId, sessionSummaries] of sessionsByBranchId.entries()) {
    const [latest] = [...sessionSummaries].sort(compareSessionSummaries);
    if (!latest) continue;
    latestSessionByBranchId.set(branchId, stripBranchId(latest));
  }

  const projectFreshnessById = new Map<string, WorkflowProjectionFreshnessEntry>();
  for (const projectId of projectById.keys()) {
    projectFreshnessById.set(
      projectId,
      resolveProjectFreshness(
        repositoryByProjectId.get(projectId),
        repositoryBranchesByProjectId.get(projectId) ?? [],
      ),
    );
  }

  return {
    activeCommitByBranchId,
    branchById,
    branchesByProjectId,
    commitRowsByBranchId,
    latestSessionByBranchId,
    managedRepositoryBranchByBranchId,
    projectById,
    projectFreshnessById,
    repositoryByProjectId,
    unmanagedRepositoryBranchesByProjectId,
  };
}

function filterProjectBranchRows(
  rows: readonly WorkflowBranchSummary[],
  filter: ProjectBranchScopeFilters | undefined,
): readonly WorkflowBranchSummary[] {
  if (!filter) return rows;

  return rows.filter((row) => {
    if (filter.states && filter.states.length > 0 && !filter.states.includes(row.state)) {
      return false;
    }
    if (filter.hasActiveCommit !== undefined) {
      const hasActiveCommit = Boolean(row.activeCommitId);
      if (hasActiveCommit !== filter.hasActiveCommit) return false;
    }
    return true;
  });
}

function createScopeFreshness(
  projectedAt: string,
  projectionCursor: string,
  freshness: WorkflowProjectionFreshnessEntry | undefined,
): ProjectBranchScopeFreshness {
  return {
    projectedAt,
    projectionCursor,
    repositoryFreshness: freshness?.repositoryFreshness ?? "missing",
    ...(freshness?.repositoryReconciledAt
      ? { repositoryReconciledAt: freshness.repositoryReconciledAt }
      : {}),
  };
}

function normalizeProjectedAt(projectedAt: Date | string | undefined): string {
  if (projectedAt === undefined) return new Date().toISOString();
  const value = typeof projectedAt === "string" ? new Date(projectedAt) : projectedAt;
  if (Number.isNaN(value.getTime())) {
    throw new Error("Workflow projection projectedAt must be a valid ISO timestamp.");
  }
  return value.toISOString();
}

function buildProjectionCursor(state: WorkflowProjectionIndexState): string {
  const latestUpdatedAt = collectProjectionTimestamps(state).sort(compareAscending).at(-1);

  return [
    workflowProjectionCursorPrefix,
    latestUpdatedAt ?? "empty",
    state.projectById.size,
    state.repositoryByProjectId.size,
    state.branchById.size,
    Array.from(state.commitRowsByBranchId.values()).reduce((total, rows) => total + rows.length, 0),
    state.managedRepositoryBranchByBranchId.size,
    Array.from(state.unmanagedRepositoryBranchesByProjectId.values()).reduce(
      (total, rows) => total + rows.length,
      0,
    ),
    state.latestSessionByBranchId.size,
  ].join(":");
}

function paginateWorkflowProjectionRows<TItem>(input: {
  readonly anchorId: string;
  readonly cursor?: string;
  readonly items: readonly TItem[];
  readonly kind: WorkflowProjectionCursorKind;
  readonly limit?: number;
  readonly projectionCursor: string;
}): {
  readonly items: readonly TItem[];
  readonly nextCursor?: string;
} {
  const offset =
    input.cursor === undefined
      ? 0
      : decodeWorkflowProjectionCursor(
          input.cursor,
          input.kind,
          input.projectionCursor,
          input.anchorId,
        ).offset;
  const safeLimit =
    input.limit === undefined ? input.items.length : Math.max(0, Math.trunc(input.limit));
  if (safeLimit === 0) {
    return { items: [] };
  }

  const items = input.items.slice(offset, offset + safeLimit);
  const nextOffset = offset + items.length;
  return {
    items,
    ...(nextOffset < input.items.length
      ? {
          nextCursor: encodeWorkflowProjectionCursor({
            version: 1,
            kind: input.kind,
            projectionCursor: input.projectionCursor,
            anchorId: input.anchorId,
            offset: nextOffset,
          }),
        }
      : {}),
  };
}

function encodeWorkflowProjectionCursor(cursor: WorkflowProjectionCursor): string {
  return `${workflowProjectionCursorPrefix}${Buffer.from(JSON.stringify(cursor), "utf8").toString(
    "base64url",
  )}`;
}

function decodeWorkflowProjectionCursor(
  cursor: string,
  kind: WorkflowProjectionCursorKind,
  projectionCursor: string,
  anchorId: string,
): WorkflowProjectionCursor {
  const encoded = cursor.startsWith(workflowProjectionCursorPrefix)
    ? cursor.slice(workflowProjectionCursorPrefix.length)
    : "";
  if (!encoded) {
    throw new WorkflowProjectionQueryError(
      "projection-stale",
      `Cursor "${cursor}" does not belong to the workflow projection reader.`,
    );
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<WorkflowProjectionCursor>;
    if (
      parsed.version !== 1 ||
      parsed.kind !== kind ||
      parsed.projectionCursor !== projectionCursor ||
      parsed.anchorId !== anchorId ||
      !Number.isInteger(parsed.offset) ||
      (parsed.offset ?? 0) < 0
    ) {
      throw new Error("stale");
    }

    return parsed as WorkflowProjectionCursor;
  } catch {
    throw new WorkflowProjectionQueryError(
      "projection-stale",
      `Cursor "${cursor}" is stale for the current workflow projection.`,
    );
  }
}

function stripBranchId(
  value: CommitQueueScopeSessionSummary & { readonly branchId: string },
): CommitQueueScopeSessionSummary {
  const { branchId: _branchId, ...summary } = value;
  return summary;
}

function sortWorkflowBranches(
  rows: readonly WorkflowBranchSummary[],
  order: readonly ProjectBranchScopeOrderClause[] | undefined,
): WorkflowBranchSummary[] {
  const clauses = order && order.length > 0 ? order : defaultProjectBranchScopeOrder;
  return [...rows].sort((left, right) => {
    for (const clause of clauses) {
      const natural = compareWorkflowBranchesByField(left, right, clause.field);
      if (natural === 0) continue;
      return clause.direction === "asc" ? natural : natural * -1;
    }
    return compareAscending(left.id, right.id);
  });
}

function compareWorkflowBranchesByField(
  left: WorkflowBranchSummary,
  right: WorkflowBranchSummary,
  field: ProjectBranchScopeOrderField,
): number {
  switch (field) {
    case "queue-rank":
      return compareOptionalNumber(left.queueRank, right.queueRank);
    case "updated-at":
      return compareAscending(left.updatedAt, right.updatedAt);
    case "created-at":
      return compareAscending(left.createdAt, right.createdAt);
    case "title":
      return compareAscending(left.title, right.title);
    case "state":
      return compareOptionalNumber(
        workflowBranchStateOrder.get(left.state),
        workflowBranchStateOrder.get(right.state),
      );
  }
}

function compareWorkflowRepositories(
  left: WorkflowRepositorySummary,
  right: WorkflowRepositorySummary,
): number {
  return (
    compareAscending(left.createdAt, right.createdAt) ||
    compareAscending(left.updatedAt, right.updatedAt) ||
    compareAscending(left.id, right.id)
  );
}

function compareCommitQueueRows(
  left: CommitQueueScopeCommitRow,
  right: CommitQueueScopeCommitRow,
): number {
  return (
    compareOptionalNumber(left.workflowCommit.order, right.workflowCommit.order) ||
    compareAscending(left.workflowCommit.createdAt, right.workflowCommit.createdAt) ||
    compareAscending(left.workflowCommit.updatedAt, right.workflowCommit.updatedAt) ||
    compareAscending(left.workflowCommit.id, right.workflowCommit.id)
  );
}

function compareRepositoryCommitSummaries(
  left: RepositoryCommitSummary,
  right: RepositoryCommitSummary,
): number {
  return (
    compareOptionalString(right.committedAt, left.committedAt) ||
    compareAscending(right.updatedAt, left.updatedAt) ||
    compareAscending(right.createdAt, left.createdAt) ||
    compareAscending(left.id, right.id)
  );
}

function compareRepositoryBranchSummaries(
  left: RepositoryBranchSummary,
  right: RepositoryBranchSummary,
): number {
  return (
    compareOptionalString(right.latestReconciledAt, left.latestReconciledAt) ||
    compareAscending(right.updatedAt, left.updatedAt) ||
    compareAscending(right.createdAt, left.createdAt) ||
    compareAscending(left.id, right.id)
  );
}

function compareRepositoryObservations(
  left: ProjectBranchScopeRepositoryObservation,
  right: ProjectBranchScopeRepositoryObservation,
): number {
  return (
    compareAscending(left.repositoryBranch.branchName, right.repositoryBranch.branchName) ||
    compareAscending(right.repositoryBranch.updatedAt, left.repositoryBranch.updatedAt) ||
    compareAscending(left.repositoryBranch.id, right.repositoryBranch.id)
  );
}

function compareSessionSummaries(
  left: CommitQueueScopeSessionSummary & { readonly branchId: string },
  right: CommitQueueScopeSessionSummary & { readonly branchId: string },
): number {
  return (
    compareAscending(right.startedAt, left.startedAt) ||
    compareOptionalString(right.endedAt, left.endedAt) ||
    compareAscending(left.id, right.id)
  );
}

function resolveProjectFreshness(
  repository: WorkflowRepositorySummary | undefined,
  repositoryBranches: readonly RepositoryBranchSummary[],
): WorkflowProjectionFreshnessEntry {
  if (!repository) {
    return {
      repositoryFreshness: "missing",
    };
  }

  const latestReconciledAt = repositoryBranches
    .map((repositoryBranchSummary) => repositoryBranchSummary.latestReconciledAt)
    .filter((value): value is string => Boolean(value))
    .sort(compareAscending)
    .at(-1);

  if (repositoryBranches.length === 0) {
    return {
      repositoryFreshness: "missing",
    };
  }

  return {
    repositoryFreshness: repositoryBranches.every(
      (repositoryBranchSummary) => repositoryBranchSummary.latestReconciledAt,
    )
      ? "fresh"
      : "stale",
    ...(latestReconciledAt ? { repositoryReconciledAt: latestReconciledAt } : {}),
  };
}

function resolveRepositoryObservationFreshness(
  repositoryBranchSummary: RepositoryBranchSummary,
): ProjectBranchScopeRepositoryFreshness {
  return repositoryBranchSummary.latestReconciledAt ? "fresh" : "stale";
}

function collectProjectionTimestamps(state: WorkflowProjectionIndexState): string[] {
  return [
    ...Array.from(state.projectById.values(), (entry) => entry.updatedAt),
    ...Array.from(state.repositoryByProjectId.values(), (entry) => entry.updatedAt),
    ...Array.from(state.branchById.values(), (entry) => entry.updatedAt),
    ...Array.from(state.commitRowsByBranchId.values()).flatMap((rows) =>
      rows.flatMap((row) =>
        [
          row.workflowCommit.updatedAt,
          row.repositoryCommit?.updatedAt,
          row.repositoryCommit?.committedAt,
        ].filter((value): value is string => Boolean(value)),
      ),
    ),
    ...Array.from(state.managedRepositoryBranchByBranchId.values(), (entry) =>
      entry.repositoryBranch.latestReconciledAt
        ? [entry.repositoryBranch.updatedAt, entry.repositoryBranch.latestReconciledAt]
        : [entry.repositoryBranch.updatedAt],
    ).flat(),
    ...Array.from(state.unmanagedRepositoryBranchesByProjectId.values()).flatMap((entries) =>
      entries.flatMap((entry) =>
        [entry.repositoryBranch.updatedAt, entry.repositoryBranch.latestReconciledAt].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ),
    ...Array.from(state.latestSessionByBranchId.values()).flatMap((entry) =>
      [entry.startedAt, entry.endedAt].filter((value): value is string => Boolean(value)),
    ),
  ];
}

function buildProjectSummary(entity: WorkflowProjectEntity): WorkflowProjectSummary {
  return {
    entity: "project",
    id: entity.id,
    title: entity.name,
    projectKey: entity.projectKey,
    inferred: entity.inferred,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

function buildRepositorySummary(entity: WorkflowRepositoryEntity): WorkflowRepositorySummary {
  return {
    entity: "repository",
    id: entity.id,
    title: entity.name,
    projectId: entity.project,
    repositoryKey: entity.repositoryKey,
    repoRoot: entity.repoRoot,
    defaultBaseBranch: entity.defaultBaseBranch,
    ...(entity.mainRemoteName ? { mainRemoteName: entity.mainRemoteName } : {}),
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

function buildBranchSummary(entity: WorkflowBranchEntity): WorkflowBranchSummary {
  return {
    entity: "branch",
    id: entity.id,
    title: entity.name,
    projectId: entity.project,
    branchKey: entity.branchKey,
    state: decodeWorkflowBranchState(entity.state),
    goalSummary: entity.goalSummary,
    ...(entity.goalDocumentPath ? { goalDocumentPath: entity.goalDocumentPath } : {}),
    ...(entity.queueRank !== undefined ? { queueRank: entity.queueRank } : {}),
    ...(entity.activeCommit ? { activeCommitId: entity.activeCommit } : {}),
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

function buildCommitSummary(entity: WorkflowCommitEntity): WorkflowCommitSummary {
  return {
    entity: "commit",
    id: entity.id,
    title: entity.name,
    branchId: entity.branch,
    commitKey: entity.commitKey,
    state: decodeWorkflowCommitState(entity.state),
    order: entity.order,
    ...(entity.parentCommit ? { parentCommitId: entity.parentCommit } : {}),
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

function buildRepositoryBranchSummary(entity: RepositoryBranchEntity): RepositoryBranchSummary {
  return {
    entity: "repository-branch",
    id: entity.id,
    title: entity.name,
    projectId: entity.project,
    repositoryId: entity.repository,
    ...(entity.workflowBranch ? { workflowBranchId: entity.workflowBranch } : {}),
    managed: entity.managed,
    branchName: entity.branchName,
    baseBranchName: entity.baseBranchName,
    ...(entity.upstreamName ? { upstreamName: entity.upstreamName } : {}),
    ...(entity.headSha ? { headSha: entity.headSha } : {}),
    ...(entity.worktreePath ? { worktreePath: entity.worktreePath } : {}),
    ...(entity.latestReconciledAt
      ? { latestReconciledAt: entity.latestReconciledAt.toISOString() }
      : {}),
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

function buildRepositoryCommitSummary(entity: RepositoryCommitEntity): RepositoryCommitSummary {
  return {
    entity: "repository-commit",
    id: entity.id,
    title: entity.name,
    repositoryId: entity.repository,
    ...(entity.repositoryBranch ? { repositoryBranchId: entity.repositoryBranch } : {}),
    ...(entity.workflowCommit ? { workflowCommitId: entity.workflowCommit } : {}),
    state: decodeRepositoryCommitState(entity.state),
    worktree: {
      ...(entity.worktree.path ? { path: entity.worktree.path } : {}),
      ...(entity.worktree.branchName ? { branchName: entity.worktree.branchName } : {}),
      leaseState: decodeRepositoryCommitLeaseState(entity.worktree.leaseState),
    },
    ...(entity.sha ? { sha: entity.sha } : {}),
    ...(entity.committedAt ? { committedAt: entity.committedAt.toISOString() } : {}),
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

function buildCommitQueueScopeSessionSummary(entity: AgentSessionEntity):
  | (CommitQueueScopeSessionSummary & {
      readonly branchId: string;
    })
  | undefined {
  const subjectKind = decodeAgentSessionSubjectKind(entity.subjectKind);

  if (subjectKind === "commit" && !entity.commit) {
    return undefined;
  }

  return {
    branchId: entity.branch,
    id: entity.id,
    sessionKey: entity.sessionKey,
    kind: decodeAgentSessionKind(entity.kind),
    runtimeState: decodeAgentSessionRuntimeState(entity.runtimeState),
    subject:
      subjectKind === "commit"
        ? {
            kind: "commit",
            commitId: entity.commit!,
          }
        : {
            kind: "branch",
          },
    startedAt: entity.startedAt.toISOString(),
    ...(entity.endedAt ? { endedAt: entity.endedAt.toISOString() } : {}),
  };
}

function resolvedEnumValue(value: { key: string; id?: string }): string {
  return value.id ?? opsIds.keys[value.key as keyof typeof opsIds.keys] ?? value.key;
}

function invertRecord<TValue extends string>(
  value: Record<TValue, string>,
): Record<string, TValue> {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [entry, key])) as Record<
    string,
    TValue
  >;
}

function decodeWorkflowBranchState(value: string): WorkflowBranchStateValue {
  const state = workflowBranchStateKeysById[value];
  if (!state) {
    throw new Error(`Unknown workflow branch state id "${value}".`);
  }
  return state;
}

function decodeWorkflowCommitState(value: string): WorkflowCommitSummary["state"] {
  const state = workflowCommitStateKeysById[value];
  if (!state) {
    throw new Error(`Unknown workflow commit state id "${value}".`);
  }
  return state;
}

function decodeRepositoryCommitState(value: string): RepositoryCommitSummary["state"] {
  const state = repositoryCommitStateKeysById[value];
  if (!state) {
    throw new Error(`Unknown repository commit state id "${value}".`);
  }
  return state;
}

function decodeRepositoryCommitLeaseState(
  value: string,
): RepositoryCommitSummary["worktree"]["leaseState"] {
  const state = repositoryCommitLeaseStateKeysById[value];
  if (!state) {
    throw new Error(`Unknown repository commit lease state id "${value}".`);
  }
  return state;
}

function decodeAgentSessionKind(value: string): CommitQueueScopeSessionKind {
  const kind = agentSessionKindKeysById[value];
  if (!kind) {
    throw new Error(`Unknown agent session kind id "${value}".`);
  }
  return kind;
}

function decodeAgentSessionRuntimeState(value: string): CommitQueueScopeSessionRuntimeState {
  const runtimeState = agentSessionRuntimeStateKeysById[value];
  if (!runtimeState) {
    throw new Error(`Unknown agent session runtime state id "${value}".`);
  }
  return runtimeState;
}

function decodeAgentSessionSubjectKind(
  value: string,
): (typeof agentSessionSubjectKindValues)[number] {
  const subjectKind = agentSessionSubjectKindKeysById[value];
  if (!subjectKind) {
    throw new Error(`Unknown agent session subject kind id "${value}".`);
  }
  return subjectKind;
}

function groupBy<TItem, TKey extends string | undefined>(
  items: readonly TItem[],
  selectKey: (item: TItem) => TKey,
): Map<TKey, TItem[]> {
  const grouped = new Map<TKey, TItem[]>();
  for (const item of items) {
    const key = selectKey(item);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(item);
      continue;
    }
    grouped.set(key, [item]);
  }
  return grouped;
}

function compareAscending(left: string, right: string): number {
  return left.localeCompare(right);
}

function compareOptionalNumber(left: number | undefined, right: number | undefined): number {
  if (left === right) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right;
}

function compareOptionalString(left: string | undefined, right: string | undefined): number {
  if (left === right) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left.localeCompare(right);
}
