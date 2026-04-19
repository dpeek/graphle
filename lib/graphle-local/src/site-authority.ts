import { bootstrap, createBootstrappedSnapshot } from "@dpeek/graphle-bootstrap";
import type { PersistedAuthoritativeGraph } from "@dpeek/graphle-authority";
import { createGraphStore } from "@dpeek/graphle-kernel";
import { cloudflareDeploy } from "@dpeek/graphle-deploy-cloudflare";
import { colorType, minimalCore, tag } from "@dpeek/graphle-module-core";
import { site, siteIconPresetIdFor, siteVisibilityIdFor } from "@dpeek/graphle-module-site";
import {
  createGraphleSqlitePersistedAuthoritativeGraph,
  type GraphleSqliteHandle,
} from "@dpeek/graphle-sqlite";

export const graphleLocalSiteAuthorityId = "site";

export type LocalSiteGraphNamespace = typeof site & {
  readonly tag: typeof tag;
  readonly cloudflareTarget: typeof cloudflareDeploy.cloudflareTarget;
};
export type LocalSiteGraphDefinitions = typeof minimalCore & {
  readonly color: typeof colorType;
  readonly tag: typeof tag;
} & typeof site &
  typeof cloudflareDeploy;

const localSiteGraphNamespace: LocalSiteGraphNamespace = { ...site, tag, ...cloudflareDeploy };
const localSiteGraphDefinitions: LocalSiteGraphDefinitions = {
  ...minimalCore,
  color: colorType,
  tag,
  ...site,
  ...cloudflareDeploy,
};
const localSiteGraphBootstrapOptions = Object.freeze({
  availableDefinitions: localSiteGraphDefinitions,
  cacheKey: localSiteGraphDefinitions,
  coreSchema: minimalCore,
});
const defaultTagColor = "#2563eb";

export type LocalSiteStartupDiagnostics = {
  readonly recovery: "none" | "repair" | "reset-baseline";
  readonly repairReasons: readonly string[];
  readonly resetReasons: readonly string[];
};

export type LocalSiteAuthority = PersistedAuthoritativeGraph<
  LocalSiteGraphNamespace,
  LocalSiteGraphDefinitions
>;

export interface OpenLocalSiteAuthorityOptions {
  readonly sqlite: GraphleSqliteHandle;
  readonly now?: () => Date;
}

function createLocalSiteStore() {
  return createGraphStore(
    createBootstrappedSnapshot(localSiteGraphDefinitions, localSiteGraphBootstrapOptions),
  );
}

async function ensureLocalSiteSchema(authority: LocalSiteAuthority): Promise<void> {
  const beforeVersion = authority.store.version();
  bootstrap(authority.store, localSiteGraphDefinitions, localSiteGraphBootstrapOptions);
  if (authority.store.version() !== beforeVersion) {
    await authority.persist();
  }
}

export async function openLocalSiteAuthority({
  sqlite,
  now = () => new Date(),
}: OpenLocalSiteAuthorityOptions): Promise<LocalSiteAuthority> {
  const authority = await createGraphleSqlitePersistedAuthoritativeGraph(
    createLocalSiteStore(),
    localSiteGraphNamespace,
    {
      handle: sqlite,
      authorityId: graphleLocalSiteAuthorityId,
      definitions: localSiteGraphDefinitions,
      seed(graph) {
        const timestamp = now();
        const publicVisibility = siteVisibilityIdFor("public");
        const privateVisibility = siteVisibilityIdFor("private");
        const graphleTag = graph.tag.create({
          name: "Graphle",
          key: "graphle",
          color: defaultTagColor,
        });

        graph.item.create({
          title: "Home",
          path: "/",
          body: "# Home\n\nWelcome to your new Graphle site.",
          visibility: publicVisibility,
          icon: siteIconPresetIdFor("website"),
          tags: [graphleTag],
          sortOrder: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        graph.item.create({
          title: "Example note",
          path: "/notes/example",
          body: "# Example note\n\nThis path-backed item is stored in the local site graph.",
          visibility: publicVisibility,
          icon: siteIconPresetIdFor("note"),
          tags: [graphleTag],
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        graph.item.create({
          title: "GitHub",
          url: new URL("https://github.com/dpeek"),
          visibility: publicVisibility,
          icon: siteIconPresetIdFor("github"),
          tags: [graphleTag],
          sortOrder: 10,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        graph.item.create({
          title: "X",
          url: new URL("https://x.com/dpeekdotcom"),
          visibility: publicVisibility,
          icon: siteIconPresetIdFor("x"),
          tags: [graphleTag],
          sortOrder: 10,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        graph.item.create({
          title: "LinkedIn",
          url: new URL("https://www.linkedin.com/in/dpeekdotcom/"),
          visibility: publicVisibility,
          icon: siteIconPresetIdFor("linkedin"),
          tags: [graphleTag],
          sortOrder: 10,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        graph.item.create({
          title: "Private",
          url: new URL("https://www.linkedin.com/in/dpeekdotcom/"),
          visibility: privateVisibility,
          icon: siteIconPresetIdFor("link"),
          tags: [graphleTag],
          sortOrder: 10,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      },
    },
  );
  await ensureLocalSiteSchema(authority);
  return authority;
}

export function readLocalSiteAuthorityHealth(authority: LocalSiteAuthority | undefined) {
  if (!authority) {
    return {
      status: "unavailable" as const,
    };
  }

  return {
    status: "ok" as const,
    startupDiagnostics: authority.startupDiagnostics,
    records: {
      items: authority.graph.item.list().length,
      tags: authority.graph.tag.list().length,
    },
  };
}
