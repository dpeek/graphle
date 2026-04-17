import { describe, expect, it } from "bun:test";

import { createBootstrappedSnapshot } from "@dpeek/graphle-bootstrap";
import { createGraphClient } from "@dpeek/graphle-client";
import { createGraphIdMap, createGraphStore } from "@dpeek/graphle-kernel";
import { colorType, minimalCore, tag } from "@dpeek/graphle-module-core";

import {
  compareSiteItems,
  parseSiteAbsoluteUrl,
  parseSiteIconPreset,
  parseSitePath,
  parseSitePublicRoute,
  parseSiteVisibility,
  site,
  siteItemSurface,
  siteIconPresetForId,
  siteIconPresetIdFor,
  siteItemMatchesSearch,
  siteManifest,
  siteVisibilityForId,
  siteVisibilityIdFor,
} from "./index.js";
import siteIds from "./site.json";

const siteGraphNamespace = { ...site, tag } as const;
const siteGraphDefinitions = { ...minimalCore, color: colorType, tag, ...site } as const;

describe("site module", () => {
  it("keeps the site id map in sync with authored schema keys", () => {
    const reconciled = createGraphIdMap(site, siteIds, { pruneOrphans: true });

    expect(reconciled.added).toEqual([]);
    expect(reconciled.removed).toEqual([]);
    expect(reconciled.map).toEqual(siteIds);
  });

  it("defines item contracts over the minimal site graph with core tags", () => {
    const store = createGraphStore(
      createBootstrappedSnapshot(siteGraphDefinitions, {
        availableDefinitions: siteGraphDefinitions,
        coreSchema: minimalCore,
      }),
    );
    const graph = createGraphClient(store, siteGraphNamespace, siteGraphDefinitions);
    const now = new Date("2026-04-15T00:00:00.000Z");
    const tagId = graph.tag.create({
      name: "Graphle",
      key: "graphle",
      color: "#2563eb",
    });

    const itemId = graph.item.create({
      title: "Home",
      path: "/",
      url: new URL("https://example.com/"),
      body: "# Home",
      excerpt: "A home page.",
      visibility: siteVisibilityIdFor("public"),
      icon: siteIconPresetIdFor("website"),
      tags: [tagId],
      pinned: true,
      sortOrder: 1,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    expect(graph.item.get(itemId)).toMatchObject({
      title: "Home",
      path: "/",
      url: new URL("https://example.com/"),
      body: "# Home",
      excerpt: "A home page.",
      visibility: siteVisibilityIdFor("public"),
      icon: siteIconPresetIdFor("website"),
      tags: [tagId],
      pinned: true,
      sortOrder: 1,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    expect(siteManifest.runtime.schemas?.[0]?.namespace).toBe(site);
  });

  it("publishes authored site item record surface metadata", () => {
    expect(siteItemSurface).toMatchObject({
      key: "site:item:surface",
      subject: "site:item",
      titleField: "title",
      subtitleField: "excerpt",
    });
    expect(siteItemSurface.sections.map((section) => section.key)).toEqual([
      "content",
      "route",
      "sidebar",
      "metadata",
    ]);
    expect(
      siteItemSurface.sections.flatMap((section) => section.fields.map((field) => field.path)),
    ).toEqual([
      "title",
      "excerpt",
      "body",
      "url",
      "tags",
      "path",
      "visibility",
      "publishedAt",
      "icon",
      "pinned",
      "sortOrder",
      "createdAt",
      "updatedAt",
    ]);
    expect(siteManifest.runtime.recordSurfaces).toEqual([siteItemSurface]);
  });

  it("validates site paths, URLs, visibility, and icon presets", () => {
    expect(parseSitePath("/")).toBe("/");
    expect(parseSitePath("/work/example")).toBe("/work/example");
    expect(parseSiteAbsoluteUrl("https://example.com/work")).toBe("https://example.com/work");
    expect(parseSiteVisibility("private")).toBe("private");
    expect(siteVisibilityForId(siteVisibilityIdFor("public"))).toBe("public");
    expect(parseSiteIconPreset("github")).toBe("github");
    expect(siteIconPresetForId(siteIconPresetIdFor("note"))).toBe("note");
    expect(parseSitePublicRoute("/posts/example-post")).toEqual({
      kind: "item",
      path: "/posts/example-post",
    });

    expect(() => parseSitePath("posts/example")).toThrow("Invalid site path");
    expect(() => parseSitePath("/work/")).toThrow("Invalid site path");
    expect(() => parseSiteAbsoluteUrl("/relative")).toThrow("Invalid site URL");
    expect(() => parseSiteVisibility("draft")).toThrow("Invalid site visibility");
    expect(() => parseSiteIconPreset("custom")).toThrow("Invalid site icon preset");
  });

  it("searches and sorts item summaries using PRD rules", () => {
    const items = [
      {
        title: "Later",
        visibility: "public" as const,
        pinned: false,
        publishedAt: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      },
      {
        title: "Pinned link",
        url: "https://github.com/dpeek/graphle",
        visibility: "public" as const,
        pinned: true,
        tags: [{ key: "graphle", name: "Graphle" }],
        updatedAt: "2026-04-09T00:00:00.000Z",
      },
      {
        title: "Ordered",
        visibility: "private" as const,
        pinned: false,
        sortOrder: 1,
        updatedAt: "2026-04-08T00:00:00.000Z",
      },
    ];

    expect([...items].sort(compareSiteItems).map((item) => item.title)).toEqual([
      "Ordered",
      "Pinned link",
      "Later",
    ]);
    expect(siteItemMatchesSearch(items[1]!, "github.com/dpeek")).toBe(true);
    expect(siteItemMatchesSearch(items[1]!, "graphle")).toBe(true);
    expect(siteItemMatchesSearch(items[0]!, "missing")).toBe(false);
  });
});
