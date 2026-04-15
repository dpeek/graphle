import type {
  AuthoritativeGraphWriteResult,
  GraphStore,
  GraphWriteTransaction,
} from "../../../graphle-kernel/src/index.js";

import type { WorkflowMutationAction, WorkflowMutationResult } from "../command.js";

type PlannedWorkflowMutation = {
  readonly changed: boolean;
  readonly result: WorkflowMutationResult;
  readonly transaction: GraphWriteTransaction;
};

export type WorkflowMutationAuthority<TAuthorization = unknown> = {
  readonly store: GraphStore;
  applyTransaction(
    transaction: GraphWriteTransaction,
    options: {
      readonly authorization?: TAuthorization;
      readonly writeScope: "server-command";
    },
  ): Promise<Pick<AuthoritativeGraphWriteResult, "cursor" | "replayed">>;
};

export type WorkflowMutationCommandOptions<TAuthorization = unknown> = {
  readonly authorization?: TAuthorization;
};

export async function runWorkflowMutationCommand<TGraphClient, TAuthorization = unknown>(
  input: WorkflowMutationAction,
  authority: WorkflowMutationAuthority<TAuthorization>,
  options: WorkflowMutationCommandOptions<TAuthorization>,
  helpers: {
    readonly mutateWorkflow: (
      graph: TGraphClient,
      store: GraphStore,
      input: WorkflowMutationAction,
    ) => WorkflowMutationResult;
    readonly planWorkflowMutation: (
      snapshot: ReturnType<GraphStore["snapshot"]>,
      mutationId: string,
      mutate: (graph: TGraphClient, store: GraphStore) => WorkflowMutationResult,
    ) => PlannedWorkflowMutation;
  },
): Promise<WorkflowMutationResult> {
  const planned = helpers.planWorkflowMutation(
    authority.store.snapshot(),
    `workflow-mutation:${input.action}:${Date.now()}`,
    (graph, store) => helpers.mutateWorkflow(graph, store, input),
  );

  if (!planned.changed) {
    return planned.result;
  }

  const write = await authority.applyTransaction(planned.transaction, {
    authorization: options.authorization,
    writeScope: "server-command",
  });
  planned.result.cursor = write.cursor;
  planned.result.replayed = write.replayed;
  return planned.result;
}
