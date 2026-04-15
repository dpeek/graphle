import { type GraphClientSyncController } from "@dpeek/graphle-client";
import {
  createModuleLiveScopeRefreshController,
  type LiveScopeClientOptions,
  type ModuleLiveScopeRefreshAction,
  type ModuleLiveScopeRefreshController,
  type ModuleLiveScopeRefreshResult,
} from "@dpeek/graphle-live";

import { workflowReviewModuleReadScope } from "../projection.js";

const defaultWorkflowLivePath = "/api/workflow-live";

export type WorkflowReviewLiveSyncPollAction = ModuleLiveScopeRefreshAction;
export type WorkflowReviewLiveSyncPollResult = ModuleLiveScopeRefreshResult;
export type WorkflowReviewLiveSync = ModuleLiveScopeRefreshController;

export function createWorkflowReviewLiveSync(
  sync: Pick<GraphClientSyncController, "getState" | "sync">,
  options: LiveScopeClientOptions = {},
): WorkflowReviewLiveSync {
  return createModuleLiveScopeRefreshController(sync, workflowReviewModuleReadScope, {
    ...options,
    path: options.path ?? defaultWorkflowLivePath,
  });
}
