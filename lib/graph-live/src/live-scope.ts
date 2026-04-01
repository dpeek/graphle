import { type DependencyKey, type InvalidationEvent } from "@io/graph-projection";

export const liveScopeRequestKindValues = ["register", "pull", "remove"] as const;

export type LiveScopeRequestKind = (typeof liveScopeRequestKindValues)[number];

export type LiveScopeRegistration = {
  readonly registrationId: string;
  readonly sessionId: string;
  readonly principalId: string;
  readonly scopeId: string;
  readonly definitionHash: string;
  readonly policyFilterVersion: string;
  readonly dependencyKeys: readonly DependencyKey[];
  readonly expiresAt: string;
};

export type LiveScopeRegistrationTarget = Omit<
  LiveScopeRegistration,
  "expiresAt" | "registrationId"
>;

export type LiveScopeInvalidation = InvalidationEvent;

export type LiveScopePullResult = {
  readonly active: boolean;
  readonly invalidations: readonly LiveScopeInvalidation[];
  readonly scopeId: string;
  readonly sessionId: string;
};

export type RegisterLiveScopeRequest = {
  readonly kind: "register";
  readonly cursor: string;
};

export type PullLiveScopeRequest = {
  readonly kind: "pull";
  readonly scopeId: string;
};

export type RemoveLiveScopeRequest = {
  readonly kind: "remove";
  readonly scopeId: string;
};

export type LiveScopeRequest =
  | RegisterLiveScopeRequest
  | PullLiveScopeRequest
  | RemoveLiveScopeRequest;

export type RegisterLiveScopeResponse = {
  readonly kind: "register";
  readonly result: LiveScopeRegistration;
};

export type PullLiveScopeResponse = {
  readonly kind: "pull";
  readonly result: LiveScopePullResult;
};

export type RemoveLiveScopeResponse = {
  readonly kind: "remove";
  readonly result: {
    readonly removed: boolean;
    readonly scopeId: string;
    readonly sessionId: string;
  };
};

export type LiveScopeResponse =
  | RegisterLiveScopeResponse
  | PullLiveScopeResponse
  | RemoveLiveScopeResponse;

type LiveScopeResponseFor<TRequest extends LiveScopeRequest> =
  TRequest extends RegisterLiveScopeRequest
    ? RegisterLiveScopeResponse
    : TRequest extends PullLiveScopeRequest
      ? PullLiveScopeResponse
      : TRequest extends RemoveLiveScopeRequest
        ? RemoveLiveScopeResponse
        : never;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type LiveScopeClientOptions = {
  readonly fetch?: FetchLike;
  readonly path?: string;
  readonly signal?: AbortSignal;
  readonly url?: string;
};

export class LiveScopeClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "LiveScopeClientError";
    this.status = status;
    this.code = code;
  }
}

function readErrorMessage(
  status: number,
  statusText: string,
  payload: unknown,
  fallback: string,
): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }

  return `${fallback} with ${status} ${statusText}.`;
}

function readErrorCode(payload: unknown): string | undefined {
  return typeof (payload as { code?: unknown })?.code === "string"
    ? (payload as { code: string }).code
    : undefined;
}

function resolveLiveScopeUrl(options: LiveScopeClientOptions): string {
  const path = options.path ?? "/api/live";
  return options.url ? new URL(path, options.url).toString() : path;
}

export async function requestLiveScope<TRequest extends LiveScopeRequest>(
  request: TRequest,
  options: LiveScopeClientOptions = {},
): Promise<LiveScopeResponseFor<TRequest>> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(resolveLiveScopeUrl(options), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  const payload = (await response.json().catch(() => undefined)) as
    | LiveScopeResponseFor<TRequest>
    | { readonly code?: string; readonly error?: string }
    | undefined;

  if (!response.ok) {
    throw new LiveScopeClientError(
      readErrorMessage(response.status, response.statusText, payload, "Live scope request failed"),
      response.status,
      readErrorCode(payload),
    );
  }

  return payload as LiveScopeResponseFor<TRequest>;
}
