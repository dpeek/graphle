import { describe, expect, it } from "bun:test";

import { loadGraphleSiteStatus, type GraphleSiteStatusFetcher } from "./status.js";

describe("loadGraphleSiteStatus", () => {
  it("loads health, session, and the read-only route projection", async () => {
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

      if (path === "/api/site/route?path=%2F") {
        return Response.json({
          route: {
            kind: "item",
            path: "/",
            item: {
              id: "item-1",
              title: "Home",
              path: "/",
              body: "# Home",
              visibility: "public",
              tags: [],
              createdAt: "2026-04-15T00:00:00.000Z",
              updatedAt: "2026-04-15T00:00:00.000Z",
            },
          },
          items: [
            {
              id: "item-1",
              title: "Home",
              path: "/",
              body: "# Home",
              visibility: "public",
              tags: [],
              createdAt: "2026-04-15T00:00:00.000Z",
              updatedAt: "2026-04-15T00:00:00.000Z",
            },
            {
              id: "item-2",
              title: "Private bookmark",
              url: "https://example.com/",
              visibility: "private",
              tags: [{ id: "tag-1", key: "links", name: "Links", color: "#2563eb" }],
              createdAt: "2026-04-15T00:00:00.000Z",
              updatedAt: "2026-04-15T00:00:00.000Z",
            },
          ],
        });
      }

      return new Response("not found", { status: 404 });
    };

    const snapshot = await loadGraphleSiteStatus({
      fetcher,
      now: () => new Date("2026-04-15T00:00:00.000Z"),
    });

    expect(paths.sort()).toEqual(["/api/health", "/api/session", "/api/site/route?path=%2F"]);
    expect(snapshot.loadedAt).toBe("2026-04-15T00:00:00.000Z");
    expect(snapshot.session.authenticated).toBe(true);
    expect(snapshot.health.graph?.records?.items).toBe(2);
    expect(snapshot.route.kind).toBe("item");
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.items[1]?.visibility).toBe("private");
  });
});
