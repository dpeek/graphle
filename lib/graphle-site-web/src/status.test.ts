import { describe, expect, it } from "bun:test";

import { loadGraphleSiteStatus, type GraphleSiteStatusFetcher } from "./status.js";

describe("loadGraphleSiteStatus", () => {
  it("loads health and session without the public route DTO projection", async () => {
    const paths: string[] = [];
    const fetcher: GraphleSiteStatusFetcher = async (input) => {
      const path = String(input);
      paths.push(path);

      if (path === "/api/health") {
        return Response.json({
          ok: true,
          service: { name: "graphle-local", status: "ok" },
          project: { id: "project-1" },
          graph: { status: "ok", records: { items: 2, tags: 1 } },
        });
      }

      if (path === "/api/session") {
        return Response.json({
          authenticated: true,
          session: { projectId: "project-1", subject: "local-admin" },
        });
      }

      return new Response("not found", { status: 404 });
    };

    const snapshot = await loadGraphleSiteStatus({
      fetcher,
      now: () => new Date("2026-04-15T00:00:00.000Z"),
    });

    expect(paths.sort()).toEqual(["/api/health", "/api/session"]);
    expect(snapshot.loadedAt).toBe("2026-04-15T00:00:00.000Z");
    expect(snapshot.session.authenticated).toBe(true);
    expect(snapshot.health.graph?.records?.items).toBe(2);
    expect(snapshot.path).toBe("/");
  });
});
