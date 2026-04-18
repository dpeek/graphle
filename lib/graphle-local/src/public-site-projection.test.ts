import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createGraphClient } from "@dpeek/graphle-client";
import { createGraphStore } from "@dpeek/graphle-kernel";
import { colorType, minimalCore, tag } from "@dpeek/graphle-module-core";
import {
  assertPublicSiteGraphBaselineCompatible,
  site,
  siteItemPublicProjectionSpec,
  siteVisibilityIdFor,
} from "@dpeek/graphle-module-site";
import { openGraphleSqlite } from "@dpeek/graphle-sqlite";
import { describe, expect, it } from "bun:test";

import { buildPublicSiteGraphBaseline } from "./public-site-projection.js";
import { openLocalSiteAuthority } from "./site-authority.js";

const publicSiteGraphNamespace = { ...site, tag } as const;
const publicSiteGraphDefinitions = {
  ...minimalCore,
  color: colorType,
  tag,
  ...site,
} as const;

type LocalSiteAuthorityForTest = Awaited<ReturnType<typeof openLocalSiteAuthority>>;

async function withAuthority<T>(
  run: (authority: LocalSiteAuthorityForTest) => Promise<T> | T,
): Promise<T> {
  const cwd = await mkdtemp(join(tmpdir(), "graphle-local-public-projection-"));
  const sqlite = await openGraphleSqlite({ path: join(cwd, "graphle.db") });

  try {
    const authority = await openLocalSiteAuthority({
      sqlite,
      now: () => new Date("2026-04-15T00:00:00.000Z"),
    });
    return await run(authority);
  } finally {
    sqlite.close();
    await rm(cwd, { force: true, recursive: true });
  }
}

describe("public site graph projection", () => {
  it("builds a sanitized graph baseline from public items and referenced tags", async () => {
    await withAuthority((authority) => {
      const publicVisibility = siteVisibilityIdFor("public");
      const privateVisibility = siteVisibilityIdFor("private");
      const publicTagId = authority.graph.tag.create({
        name: "Public",
        key: "public",
        color: "#2563eb",
      });
      const privateTagId = authority.graph.tag.create({
        name: "Private Only",
        key: "private-only",
        color: "#991b1b",
      });

      authority.graph.item.create({
        title: "Public work",
        path: "/work",
        body: "# Work\n\nVisible public body.",
        visibility: publicVisibility,
        tags: [publicTagId],
        sortOrder: 1,
      });
      authority.graph.item.create({
        title: "Public link",
        url: new URL("https://example.com/public-link"),
        visibility: publicVisibility,
        tags: [publicTagId],
        sortOrder: 2,
      });
      authority.graph.item.create({
        title: "Private work",
        path: "/private-work",
        body: "Secret body.",
        visibility: privateVisibility,
        tags: [privateTagId],
      });

      const baseline = buildPublicSiteGraphBaseline({
        authority,
        now: () => new Date("2026-04-18T00:00:00.000Z"),
      });
      const graph = createGraphClient(
        createGraphStore(baseline.snapshot),
        publicSiteGraphNamespace,
        publicSiteGraphDefinitions,
      );

      expect(baseline).toMatchObject({
        projectionId: siteItemPublicProjectionSpec.projectionId,
        definitionHash: siteItemPublicProjectionSpec.definitionHash,
        generatedAt: "2026-04-18T00:00:00.000Z",
      });
      expect(baseline.baselineHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(graph.item.list().map((item) => item.title)).toEqual(
        expect.arrayContaining(["Home", "GitHub", "Public work", "Public link"]),
      );
      expect(graph.item.list().some((item) => item.title === "Private work")).toBe(false);
      expect(graph.item.list().some((item) => item.title === "Private")).toBe(false);
      expect(
        graph.item
          .list()
          .find((item) => item.title === "Public link")
          ?.url?.toString(),
      ).toBe("https://example.com/public-link");
      expect(graph.tag.list().map((item) => item.key)).toEqual(
        expect.arrayContaining(["graphle", "public"]),
      );
      expect(graph.tag.list().some((item) => item.id === privateTagId)).toBe(false);
    });
  });

  it("validates baseline compatibility using projection metadata", async () => {
    await withAuthority((authority) => {
      const baseline = buildPublicSiteGraphBaseline({ authority });

      expect(() => assertPublicSiteGraphBaselineCompatible(baseline)).not.toThrow();
      expect(() =>
        assertPublicSiteGraphBaselineCompatible({
          ...baseline,
          definitionHash: "projection-def:site:item:public-graph:v0",
        }),
      ).toThrow("Public site graph baseline is incompatible");
    });
  });
});
