import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBootstrappedSnapshot } from "@dpeek/graphle-bootstrap";
import {
  cloudflarePublicSiteDurableObjectBindingName,
  cloudflarePublicSiteDurableObjectClassName,
} from "@dpeek/graphle-deploy-cloudflare";
import { createGraphStore } from "@dpeek/graphle-kernel";
import { colorType, minimalCore, tag } from "@dpeek/graphle-module-core";
import { site } from "@dpeek/graphle-module-site";
import {
  createGraphleSqlitePersistedAuthoritativeGraph,
  openGraphleSqlite,
} from "@dpeek/graphle-sqlite";
import { describe, expect, it } from "bun:test";

import {
  persistLocalCloudflareDeployMetadata,
  readLocalCloudflareDeployMetadata,
} from "./deploy.js";
import { graphleLocalSiteAuthorityId, openLocalSiteAuthority } from "./site-authority.js";

const legacySiteGraphNamespace = { ...site, tag };
const legacySiteGraphDefinitions = {
  ...minimalCore,
  color: colorType,
  tag,
  ...site,
};
const legacySiteGraphBootstrapOptions = Object.freeze({
  availableDefinitions: legacySiteGraphDefinitions,
  cacheKey: legacySiteGraphDefinitions,
  coreSchema: minimalCore,
});

describe("local site authority", () => {
  it("adds current schema facts when opening a legacy persisted site graph", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "graphle-local-site-authority-legacy-"));
    const sqlitePath = join(cwd, "graphle.sqlite");
    const legacySqlite = await openGraphleSqlite({ path: sqlitePath });

    try {
      await createGraphleSqlitePersistedAuthoritativeGraph(
        createGraphStore(
          createBootstrappedSnapshot(legacySiteGraphDefinitions, legacySiteGraphBootstrapOptions),
        ),
        legacySiteGraphNamespace,
        {
          handle: legacySqlite,
          authorityId: graphleLocalSiteAuthorityId,
          definitions: legacySiteGraphDefinitions,
        },
      );
    } finally {
      legacySqlite.close();
    }

    const sqlite = await openGraphleSqlite({ path: sqlitePath });
    const authority = await openLocalSiteAuthority({
      sqlite,
      now: () => new Date("2026-04-18T00:00:00.000Z"),
    });

    try {
      await persistLocalCloudflareDeployMetadata(authority, {
        accountId: "account-1",
        workerName: "graphle-project",
        workerUrl: "https://graphle-project.example.workers.dev",
        durableObjectBinding: cloudflarePublicSiteDurableObjectBindingName,
        durableObjectClass: cloudflarePublicSiteDurableObjectClassName,
        sourceCursor: "cursor:test",
        baselineHash: "sha256:test",
        deployedAt: "2026-04-18T00:00:00.000Z",
        status: "ready",
      });

      expect(readLocalCloudflareDeployMetadata(authority)).toMatchObject({
        accountId: "account-1",
        workerName: "graphle-project",
        status: "ready",
      });
    } finally {
      sqlite.close();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});
