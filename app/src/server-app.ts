import page from "./web/index.html";

import type { AppAuthority } from "./authority.js";

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
    "/*": page,
  } as const;
}
