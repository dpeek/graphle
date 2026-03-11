import page from "./web/index.html";

import {
  resolveRuntimeConfigSyncUrl,
  serializeBrowserRuntimeConfig,
  type AppRuntimeConfig,
} from "./config.js";
import type { AppAuthority } from "./authority.js";

function createRuntimeConfig(request: Request): AppRuntimeConfig {
  return {
    syncUrl: resolveRuntimeConfigSyncUrl(request.url, Bun.env.IO_APP_SYNC_URL),
  };
}

export function handleRuntimeConfigRequest(request: Request): Response {
  return new Response(serializeBrowserRuntimeConfig(createRuntimeConfig(request)), {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function handleSyncRequest(request: Request, authority: AppAuthority): Response {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET" },
    });
  }

  return Response.json(authority.createSyncPayload(), {
    headers: {
      "cache-control": "no-store",
    },
  });
}

export function createAppServerRoutes(authority: AppAuthority) {
  return {
    "/api/sync": (request: Request) => handleSyncRequest(request, authority),
    "/app-config.js": handleRuntimeConfigRequest,
    "/*": page,
  } as const;
}
