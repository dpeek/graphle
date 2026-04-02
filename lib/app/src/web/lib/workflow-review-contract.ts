import { workflowReviewSyncScopeRequest } from "@io/graph-module-workflow";
import {
  validateWorkflowSessionFeedRouteSearch,
  type WorkflowSessionFeedRouteSearch,
} from "@io/graph-module-workflow/client";
import { graphSyncScope } from "@io/graph-sync";

export type WorkflowRouteSearch = WorkflowSessionFeedRouteSearch & {
  readonly project?: string;
};

export type WorkflowReviewProjectResolution =
  | {
      readonly kind: "configured";
      readonly projectId: string;
    }
  | {
      readonly kind: "infer-singleton";
    };

export interface WorkflowReviewStartupContract {
  readonly graph: {
    readonly fallbackScope: typeof graphSyncScope;
    readonly requestedScope: typeof workflowReviewSyncScopeRequest;
  };
  readonly initialSelection: {
    readonly project: WorkflowReviewProjectResolution;
  };
  readonly loading: {
    readonly bootstrapDescription: string;
    readonly bootstrapTitle: string;
    readonly reviewDescription: string;
    readonly reviewTitle: string;
  };
  readonly missingData: {
    readonly missingProject: string;
    readonly noProjects: string;
    readonly unresolvedProject: string;
  };
  readonly reads: {
    readonly mainWorkflow: {
      readonly kind: "main-commit-workflow-scope";
      readonly query: {
        readonly commitId: ":selected-workflow-commit";
        readonly projectId: ":resolved-project-id";
      };
    };
  };
}

export type WorkflowReviewVisibleProject = {
  readonly id: string;
  readonly title: string;
};

export type WorkflowReviewStartupState =
  | {
      readonly contract: WorkflowReviewStartupContract;
      readonly kind: "missing-data";
      readonly message: string;
      readonly reason:
        | "configured-project-missing"
        | "no-visible-projects"
        | "project-selection-required";
      readonly visibleProjects: readonly WorkflowReviewVisibleProject[];
    }
  | {
      readonly contract: WorkflowReviewStartupContract;
      readonly kind: "ready";
      readonly project: WorkflowReviewVisibleProject;
    };

function normalizeSearchValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function validateWorkflowRouteSearch(search: Record<string, unknown>): WorkflowRouteSearch {
  const sessionFeedSearch = validateWorkflowSessionFeedRouteSearch(search);
  return {
    ...sessionFeedSearch,
    ...(normalizeSearchValue(search.project)
      ? { project: normalizeSearchValue(search.project) }
      : {}),
  };
}

export function createWorkflowReviewStartupContract(
  search: WorkflowRouteSearch = {},
): WorkflowReviewStartupContract {
  return Object.freeze({
    graph: Object.freeze({
      fallbackScope: graphSyncScope,
      requestedScope: workflowReviewSyncScopeRequest,
    }),
    initialSelection: Object.freeze({
      project: search.project
        ? Object.freeze({
            kind: "configured" as const,
            projectId: search.project,
          })
        : Object.freeze({
            kind: "infer-singleton" as const,
          }),
    }),
    loading: Object.freeze({
      bootstrapDescription:
        "Boot the browser workflow review surface against the shipped workflow review sync scope before reading the implicit-main commit workflow state.",
      bootstrapTitle: "Loading workflow review",
      reviewDescription:
        "Resolve the initial project and then read the implicit-main commit queue plus selected-commit detail over the workflow review contract.",
      reviewTitle: "Resolving workflow review",
    }),
    missingData: Object.freeze({
      missingProject:
        "The configured workflow project is not visible in the current workflow review scope.",
      noProjects:
        "The current workflow review scope does not expose any visible WorkflowProject records.",
      unresolvedProject:
        "The workflow review scope exposes multiple visible WorkflowProject records. Select one explicitly before the commit queue loads.",
    }),
    reads: Object.freeze({
      mainWorkflow: Object.freeze({
        kind: "main-commit-workflow-scope" as const,
        query: Object.freeze({
          commitId: ":selected-workflow-commit" as const,
          projectId: ":resolved-project-id" as const,
        }),
      }),
    }),
  });
}

export function resolveWorkflowReviewStartupState(
  projects: readonly WorkflowReviewVisibleProject[],
  contract: WorkflowReviewStartupContract,
): WorkflowReviewStartupState {
  const configuredProject =
    contract.initialSelection.project.kind === "configured"
      ? contract.initialSelection.project
      : undefined;
  const resolvedProject = configuredProject
    ? projects.find((project) => project.id === configuredProject.projectId)
    : projects.length === 1
      ? projects[0]
      : undefined;

  if (!resolvedProject) {
    if (configuredProject) {
      return {
        contract,
        kind: "missing-data",
        message: contract.missingData.missingProject,
        reason: "configured-project-missing",
        visibleProjects: projects,
      };
    }

    return {
      contract,
      kind: "missing-data",
      message:
        projects.length === 0
          ? contract.missingData.noProjects
          : contract.missingData.unresolvedProject,
      reason: projects.length === 0 ? "no-visible-projects" : "project-selection-required",
      visibleProjects: projects,
    };
  }

  return {
    contract,
    kind: "ready",
    project: resolvedProject,
  };
}

function routeSearchMatches(current: WorkflowRouteSearch, next: WorkflowRouteSearch): boolean {
  return (
    current.project === next.project &&
    current.commit === next.commit &&
    current.session === next.session
  );
}

export function resolveCanonicalWorkflowRouteSearch(
  current: WorkflowRouteSearch,
  startupState: WorkflowReviewStartupState,
  inferredCommitId?: string,
): WorkflowRouteSearch | undefined {
  const next =
    startupState.kind === "ready"
      ? {
          ...(current.commit
            ? { commit: current.commit }
            : !current.session && inferredCommitId
              ? { commit: inferredCommitId }
              : {}),
          project: startupState.project.id,
          ...(current.session ? { session: current.session } : {}),
        }
      : undefined;

  if (!next || routeSearchMatches(current, next)) {
    return undefined;
  }

  return next;
}
