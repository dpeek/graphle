import type { AuthorizationContext } from "@io/core/graph";

import { WebGraphAuthorityDurableObject } from "../lib/graph-authority-do.js";
import {
  encodeRequestAuthorizationContext,
  webAppAuthorizationContextHeader,
} from "../lib/server-routes.js";

type Fetcher = {
  fetch(request: Request): Promise<Response>;
};

type DurableObjectNamespaceLike = {
  idFromName(name: string): unknown;
  get(id: unknown): Fetcher;
};

interface Env {
  ASSETS: Fetcher;
  GRAPH_AUTHORITY: DurableObjectNamespaceLike;
}

export { WebGraphAuthorityDurableObject };

const webAppGraphId = "graph:global";
const webAppPolicyVersion = 0;
const provisionalOperatorAuthorization = Object.freeze({
  graphId: webAppGraphId,
  principalId: "principal:web-operator",
  principalKind: "service",
  sessionId: "session:web-operator",
  roleKeys: ["graph:authority"],
  capabilityGrantIds: [],
  capabilityVersion: 0,
  policyVersion: webAppPolicyVersion,
} satisfies AuthorizationContext);

function isHtmlNavigationRequest(request: Request): boolean {
  return request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
}

async function serveSpaAsset(request: Request, env: Env): Promise<Response> {
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404 || !isHtmlNavigationRequest(request)) {
    return assetResponse;
  }

  const indexRequest = new Request(new URL("/", request.url), request);
  return env.ASSETS.fetch(indexRequest);
}

function getGraphAuthorityFetcher(env: Env): Fetcher {
  const durableObjectId = env.GRAPH_AUTHORITY.idFromName("global");
  return env.GRAPH_AUTHORITY.get(durableObjectId);
}

async function createRequestAuthorizationContext(request: Request) {
  void request;

  // The built-in web shell is currently an operator proof surface. Until the
  // Worker owns Better Auth session parsing, keep that surface usable by
  // forwarding requests as a static operator principal.
  return provisionalOperatorAuthorization;
}

async function createAuthorizedGraphAuthorityRequest(request: Request): Promise<Request> {
  const authorization = await createRequestAuthorizationContext(request);
  const headers = new Headers(request.headers);

  headers.set(webAppAuthorizationContextHeader, encodeRequestAuthorizationContext(authorization));
  return new Request(request, { headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/sync") {
      return getGraphAuthorityFetcher(env).fetch(
        await createAuthorizedGraphAuthorityRequest(request),
      );
    }

    if (url.pathname === "/api/tx") {
      return getGraphAuthorityFetcher(env).fetch(
        await createAuthorizedGraphAuthorityRequest(request),
      );
    }

    if (url.pathname === "/api/commands") {
      return getGraphAuthorityFetcher(env).fetch(
        await createAuthorizedGraphAuthorityRequest(request),
      );
    }

    return serveSpaAsset(request, env);
  },
};
