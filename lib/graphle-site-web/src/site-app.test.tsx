import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { GraphleSiteShell } from "./site-app.js";
import { buildGraphleSiteOrderPayload } from "./site-feature.js";
import { resolveGraphleSiteTheme } from "./theme.js";

describe("GraphleSiteShell", () => {
  it("mounts the item site feature inside the generic shell", () => {
    const html = renderToStaticMarkup(
      <GraphleSiteShell
        status={{
          state: "ready",
          snapshot: {
            loadedAt: "2026-04-15T00:00:00.000Z",
            health: {
              service: { name: "graphle-local", status: "ok" },
              project: { id: "project-1" },
              database: { opened: true, schemaVersion: 2 },
              graph: { status: "ok", records: { items: 2, tags: 1 } },
            },
            session: {
              authenticated: true,
              session: { projectId: "project-1", subject: "local-admin" },
            },
            route: {
              kind: "item",
              path: "/",
              item: {
                id: "item-1",
                title: "Home",
                path: "/",
                body: "# Home",
                excerpt: "Welcome home.",
                visibility: "public",
                tags: [{ id: "tag-1", key: "graphle", name: "Graphle", color: "#2563eb" }],
                pinned: true,
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
                excerpt: "Welcome home.",
                visibility: "public",
                tags: [{ id: "tag-1", key: "graphle", name: "Graphle", color: "#2563eb" }],
                pinned: true,
                createdAt: "2026-04-15T00:00:00.000Z",
                updatedAt: "2026-04-15T00:00:00.000Z",
              },
              {
                id: "item-2",
                title: "Private bookmark",
                url: "https://example.com/",
                visibility: "private",
                tags: [],
                pinned: false,
                createdAt: "2026-04-15T00:00:00.000Z",
                updatedAt: "2026-04-15T00:00:00.000Z",
              },
            ],
          },
        }}
      />,
    );

    expect(html).toContain("Home");
    expect(html).toContain("Private bookmark");
    expect(html).toContain("graph-markdown");
    expect(html).not.toContain("Welcome home.");
    expect(html).not.toContain("graphle-site-");
    expect(html).not.toContain("Site preview");
    expect(html).not.toContain("Search items");
    expect(html).not.toContain("Edit item");
    expect(html).not.toContain("New item");
    expect(html).not.toContain("Reorder Home");
    expect(html).not.toContain("Visitor preview");
    expect(html).not.toContain("Admin active");
  });

  it("normalizes reorder payloads to consecutive sort order values", () => {
    expect(
      buildGraphleSiteOrderPayload([
        {
          id: "item-2",
          title: "Second",
          visibility: "public",
          tags: [],
          pinned: false,
          createdAt: "2026-04-15T00:00:00.000Z",
          updatedAt: "2026-04-15T00:00:00.000Z",
        },
        {
          id: "item-1",
          title: "First",
          visibility: "public",
          tags: [],
          pinned: false,
          createdAt: "2026-04-15T00:00:00.000Z",
          updatedAt: "2026-04-15T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      { id: "item-2", sortOrder: 0 },
      { id: "item-1", sortOrder: 1 },
    ]);
  });

  it("resolves persisted theme preferences and system color scheme", () => {
    const darkMedia = () => ({ matches: true }) as MediaQueryList;

    expect(resolveGraphleSiteTheme("light", darkMedia)).toBe("light");
    expect(resolveGraphleSiteTheme("dark", darkMedia)).toBe("dark");
    expect(resolveGraphleSiteTheme("system", darkMedia)).toBe("dark");
  });
});
