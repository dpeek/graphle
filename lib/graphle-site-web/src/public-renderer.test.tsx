import { createBootstrappedSnapshot } from "@dpeek/graphle-bootstrap";
import { siteVisibilityIdFor } from "@dpeek/graphle-module-site";
import { describe, expect, it } from "bun:test";

import {
  createGraphlePublicSiteRuntime,
  graphleSiteGraphBootstrapOptions,
  graphleSiteGraphDefinitions,
} from "./graph.js";
import { renderPublicSiteRoute } from "./public-renderer.js";

function createRuntime() {
  return createGraphlePublicSiteRuntime(
    createBootstrappedSnapshot(graphleSiteGraphDefinitions, graphleSiteGraphBootstrapOptions),
  );
}

describe("renderPublicSiteRoute", () => {
  it("renders public routes from graph refs with sidebar links and static public fields", () => {
    const runtime = createRuntime();
    const graphleTag = runtime.graph.tag.create({
      color: "#2563eb",
      key: "graphle",
      name: "Graphle",
    });
    runtime.graph.item.create({
      title: "Home",
      path: "/",
      body: "# Home\n\nWelcome **home**.",
      visibility: siteVisibilityIdFor("public"),
      tags: [graphleTag],
      sortOrder: 0,
      createdAt: new Date("2023-11-01T00:00:00.000Z"),
      updatedAt: new Date("2023-11-02T00:00:00.000Z"),
    });
    runtime.graph.item.create({
      title: "Work",
      path: "/work",
      body: "# Work",
      visibility: siteVisibilityIdFor("public"),
      tags: [graphleTag],
      sortOrder: 1,
      createdAt: new Date("2023-11-03T00:00:00.000Z"),
      updatedAt: new Date("2023-11-04T00:00:00.000Z"),
    });
    runtime.graph.item.create({
      title: "Public link",
      url: new URL("https://example.com/public-link"),
      visibility: siteVisibilityIdFor("public"),
      tags: [],
      sortOrder: 2,
      createdAt: new Date("2023-11-05T00:00:00.000Z"),
      updatedAt: new Date("2023-11-06T00:00:00.000Z"),
    });
    runtime.graph.item.create({
      title: "Private draft",
      path: "/private",
      body: "Do not render.",
      visibility: siteVisibilityIdFor("private"),
      tags: [],
      createdAt: new Date("2023-11-07T00:00:00.000Z"),
      updatedAt: new Date("2023-11-08T00:00:00.000Z"),
    });

    const home = renderPublicSiteRoute({ runtime, path: "/" });
    const work = renderPublicSiteRoute({ runtime, path: "/work" });
    const missing = renderPublicSiteRoute({ runtime, path: "/missing" });

    expect(home.status).toBe(200);
    expect(home.title).toBe("Home");
    expect(home.route).toMatchObject({ kind: "item", path: "/" });
    expect(home.html).toContain('data-graphle-public-preview=""');
    expect(home.html).toContain("data-graphle-public-item=");
    expect(home.html).toContain("November 01, 2023");
    expect(home.html).toContain("Graphle");
    expect(home.html).toContain("<strong>home</strong>");
    expect(home.html).toContain("Public link");
    expect(home.html).not.toContain("Private draft");
    expect(work.title).toBe("Work");
    expect(missing.status).toBe(404);
    expect(missing.html).toContain("Page not found");
    expect(missing.html).toContain("Public link");
  });
});
