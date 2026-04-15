import {
  LiveScopeClientError,
  requestLiveScope,
  type LiveScopeInvalidation,
  type LiveScopePullResult,
  type LiveScopeRegistration,
  type LiveScopeRegistrationTarget,
  type LiveScopeResponse,
} from "@dpeek/graphle-live";

export const webWorkflowLivePath = "/api/workflow-live";

export const workflowLiveRequestKinds = [
  "workflow-review-register",
  "workflow-review-pull",
  "workflow-review-remove",
] as const;

export type WorkflowLiveRequestKind = (typeof workflowLiveRequestKinds)[number];

export type WorkflowReviewLiveRegistration = LiveScopeRegistration;
export type WorkflowReviewLiveRegistrationTarget = LiveScopeRegistrationTarget;
export type WorkflowReviewLiveInvalidation = LiveScopeInvalidation;
export type WorkflowReviewPullLiveResult = LiveScopePullResult;

export type WorkflowReviewRegisterLiveRequest = {
  readonly kind: "workflow-review-register";
  readonly cursor: string;
};

export type WorkflowReviewPullLiveRequest = {
  readonly kind: "workflow-review-pull";
  readonly scopeId: string;
};

export type WorkflowReviewRemoveLiveRequest = {
  readonly kind: "workflow-review-remove";
  readonly scopeId: string;
};

export type WorkflowLiveRequest =
  | WorkflowReviewRegisterLiveRequest
  | WorkflowReviewPullLiveRequest
  | WorkflowReviewRemoveLiveRequest;

export type WorkflowReviewRegisterLiveResponse = {
  readonly kind: "workflow-review-register";
  readonly result: WorkflowReviewLiveRegistration;
};

export type WorkflowReviewPullLiveResponse = {
  readonly kind: "workflow-review-pull";
  readonly result: WorkflowReviewPullLiveResult;
};

export type WorkflowReviewRemoveLiveResponse = {
  readonly kind: "workflow-review-remove";
  readonly result: {
    readonly removed: boolean;
    readonly scopeId: string;
    readonly sessionId: string;
  };
};

export type WorkflowLiveResponse =
  | WorkflowReviewRegisterLiveResponse
  | WorkflowReviewPullLiveResponse
  | WorkflowReviewRemoveLiveResponse;

type WorkflowLiveResponseFor<TRequest extends WorkflowLiveRequest> =
  TRequest extends WorkflowReviewRegisterLiveRequest
    ? WorkflowReviewRegisterLiveResponse
    : TRequest extends WorkflowReviewPullLiveRequest
      ? WorkflowReviewPullLiveResponse
      : TRequest extends WorkflowReviewRemoveLiveRequest
        ? WorkflowReviewRemoveLiveResponse
        : never;

export type WorkflowLiveClientOptions = {
  readonly fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  readonly path?: string;
  readonly signal?: AbortSignal;
  readonly url?: string;
};

export { LiveScopeClientError as WorkflowLiveClientError };

function wrapWorkflowLiveResponse(
  response: LiveScopeResponse | WorkflowLiveResponse,
): WorkflowLiveResponse {
  if (response.kind === "workflow-review-register") {
    return response;
  }
  if (response.kind === "workflow-review-pull") {
    return response;
  }
  if (response.kind === "workflow-review-remove") {
    return response;
  }
  if (response.kind === "register") {
    return {
      kind: "workflow-review-register",
      result: response.result,
    };
  }
  if (response.kind === "pull") {
    return {
      kind: "workflow-review-pull",
      result: response.result,
    };
  }
  return {
    kind: "workflow-review-remove",
    result: response.result,
  };
}

export async function requestWorkflowLive<TRequest extends WorkflowLiveRequest>(
  request: TRequest,
  options: WorkflowLiveClientOptions = {},
): Promise<WorkflowLiveResponseFor<TRequest>> {
  const response =
    request.kind === "workflow-review-register"
      ? await requestLiveScope(
          {
            kind: "register",
            cursor: request.cursor,
          },
          {
            ...options,
            path: options.path ?? webWorkflowLivePath,
          },
        )
      : request.kind === "workflow-review-pull"
        ? await requestLiveScope(
            {
              kind: "pull",
              scopeId: request.scopeId,
            },
            {
              ...options,
              path: options.path ?? webWorkflowLivePath,
            },
          )
        : await requestLiveScope(
            {
              kind: "remove",
              scopeId: request.scopeId,
            },
            {
              ...options,
              path: options.path ?? webWorkflowLivePath,
            },
          );

  return wrapWorkflowLiveResponse(response) as WorkflowLiveResponseFor<TRequest>;
}
