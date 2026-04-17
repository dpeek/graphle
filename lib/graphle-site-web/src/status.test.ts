import { describe, expect, it } from "bun:test";

import {
  createBlankGraphleSiteItem,
  deleteGraphleSiteItem,
  loadGraphleSiteStatus,
  reorderGraphleSiteItems,
  type GraphleSiteStatusFetcher,
} from "./status.js";

describe("loadGraphleSiteStatus", () => {
  it("loads health, session, route items, and authenticated authoring items", async () => {
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
              pinned: true,
              createdAt: "2026-04-15T00:00:00.000Z",
              updatedAt: "2026-04-15T00:00:00.000Z",
            },
          },
          items: [],
        });
      }

      if (path === "/api/site/items") {
        return Response.json({
          items: [
            {
              id: "item-1",
              title: "Home",
              path: "/",
              body: "# Home",
              visibility: "public",
              tags: [],
              pinned: true,
              createdAt: "2026-04-15T00:00:00.000Z",
              updatedAt: "2026-04-15T00:00:00.000Z",
            },
            {
              id: "item-2",
              title: "Private bookmark",
              url: "https://example.com/",
              visibility: "private",
              tags: [{ id: "tag-1", key: "links", name: "Links", color: "#2563eb" }],
              pinned: false,
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

    expect(paths.sort()).toEqual([
      "/api/health",
      "/api/session",
      "/api/site/items",
      "/api/site/route?path=%2F",
    ]);
    expect(snapshot.loadedAt).toBe("2026-04-15T00:00:00.000Z");
    expect(snapshot.session.authenticated).toBe(true);
    expect(snapshot.health.graph?.records?.items).toBe(2);
    expect(snapshot.route.kind).toBe("item");
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.items[1]?.visibility).toBe("private");
  });

  it("writes blank create, delete, and reorder requests through site APIs", async () => {
    const requests: Array<{
      readonly body?: unknown;
      readonly method: string;
      readonly path: string;
    }> = [];
    const fetcher: GraphleSiteStatusFetcher = async (input, init) => {
      const path = String(input);
      requests.push({
        path,
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      if (path === "/api/site/items" && init?.method === "POST") {
        return Response.json({
          item: {
            id: "item-new",
            title: "Untitled",
            path: "/untitled",
            visibility: "private",
            tags: [],
            pinned: false,
            createdAt: "2026-04-15T00:00:00.000Z",
            updatedAt: "2026-04-15T00:00:00.000Z",
          },
        });
      }

      if (path === "/api/site/items/item-new" && init?.method === "DELETE") {
        return Response.json({ ok: true });
      }

      if (path === "/api/site/items/order" && init?.method === "PATCH") {
        return Response.json({ items: [] });
      }

      return new Response("not found", { status: 404 });
    };

    await expect(createBlankGraphleSiteItem(fetcher)).resolves.toMatchObject({
      id: "item-new",
      path: "/untitled",
      visibility: "private",
    });
    await expect(deleteGraphleSiteItem("item-new", fetcher)).resolves.toBeUndefined();
    await expect(
      reorderGraphleSiteItems(
        [
          { id: "item-2", sortOrder: 0 },
          { id: "item-1", sortOrder: 1 },
        ],
        fetcher,
      ),
    ).resolves.toEqual([]);

    expect(requests).toEqual([
      {
        path: "/api/site/items",
        method: "POST",
        body: { intent: "blank" },
      },
      {
        path: "/api/site/items/item-new",
        method: "DELETE",
        body: undefined,
      },
      {
        path: "/api/site/items/order",
        method: "PATCH",
        body: {
          items: [
            { id: "item-2", sortOrder: 0 },
            { id: "item-1", sortOrder: 1 },
          ],
        },
      },
    ]);
  });
});
