import { type GraphStore } from "@io/app/graph";
import {
  type WorkflowMutationAction,
  type WorkflowMutationResult,
} from "@io/graph-module-workflow";
import {
  runWorkflowMutationCommand as runWorkflowMutationServerCommand,
  type WorkflowMutationAuthority as WorkflowMutationServerAuthority,
} from "@io/graph-module-workflow/server";

import type { WebAppAuthorityCommandOptions } from "./authority.js";
import { dispatchWorkflowAggregateMutation } from "./workflow-authority-aggregate-handlers.js";
import {
  createWorkflowCommit,
  createWorkflowRepositoryCommit,
  finalizeWorkflowCommit,
  setWorkflowCommitState,
  updateWorkflowCommit,
} from "./workflow-authority-commit-handlers.js";
import {
  WorkflowMutationError,
  planWorkflowMutation,
  type ProductGraphClient,
} from "./workflow-mutation-helpers.js";

type WorkflowMutationAuthority = WorkflowMutationServerAuthority<
  WebAppAuthorityCommandOptions["authorization"]
>;

export async function runWorkflowMutationCommand(
  input: WorkflowMutationAction,
  authority: WorkflowMutationAuthority,
  options: WebAppAuthorityCommandOptions,
): Promise<WorkflowMutationResult> {
  return runWorkflowMutationServerCommand(input, authority, options, {
    mutateWorkflow,
    planWorkflowMutation,
  });
}

function mutateWorkflow(
  graph: ProductGraphClient,
  store: GraphStore,
  input: WorkflowMutationAction,
): WorkflowMutationResult {
  const aggregateResult = dispatchWorkflowAggregateMutation(graph, store, input);
  if (aggregateResult) return aggregateResult;

  switch (input.action) {
    case "createCommit":
      return createWorkflowCommit(graph, store, input);
    case "updateCommit":
      return updateWorkflowCommit(graph, store, input);
    case "setCommitState":
      return setWorkflowCommitState(graph, store, input);
    case "createRepositoryCommit":
      return createWorkflowRepositoryCommit(graph, store, input);
    case "finalizeCommit":
      return finalizeWorkflowCommit(graph, store, input);
    default: {
      throw new WorkflowMutationError(400, "Unsupported workflow mutation action.");
    }
  }
}
