import { createHash } from "node:crypto";

import { createBootstrappedSnapshot } from "@dpeek/graphle-bootstrap";
import {
  cloneGraphStoreSnapshot,
  type GraphFact,
  type GraphStoreSnapshot,
} from "@dpeek/graphle-kernel";
import { colorType, minimalCore, tag } from "@dpeek/graphle-module-core";
import {
  site,
  siteItemPublicProjectionSpec,
  siteVisibilityForId,
  type PublicSiteGraphBaseline,
} from "@dpeek/graphle-module-site";

import type { LocalSiteAuthority } from "./site-authority.js";

const publicSiteGraphDefinitions = {
  ...minimalCore,
  color: colorType,
  tag,
  ...site,
};

function createPublicSiteSchemaSnapshot(): GraphStoreSnapshot {
  return createBootstrappedSnapshot(publicSiteGraphDefinitions, {
    availableDefinitions: publicSiteGraphDefinitions,
    cacheKey: publicSiteGraphDefinitions,
    coreSchema: minimalCore,
  });
}

function isLiveEdge(edge: GraphFact, retracted: ReadonlySet<string>): boolean {
  return !retracted.has(edge.id);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function hashSnapshot(snapshot: GraphStoreSnapshot): string {
  return `sha256:${createHash("sha256").update(stableJson(snapshot)).digest("hex")}`;
}

export function createPublicSiteGraphSnapshot(
  authority: LocalSiteAuthority | undefined,
): GraphStoreSnapshot {
  const schemaSnapshot = createPublicSiteSchemaSnapshot();
  if (!authority) return schemaSnapshot;

  const publicItems = authority.graph.item
    .list()
    .filter((item) => siteVisibilityForId(item.visibility) === "public");
  const includedSubjects = new Set<string>();

  for (const item of publicItems) {
    includedSubjects.add(item.id);
    for (const tagId of item.tags ?? []) {
      includedSubjects.add(tagId);
    }
  }

  const sourceSnapshot = authority.store.snapshot();
  const retracted = new Set(sourceSnapshot.retracted);
  const publicEdges = sourceSnapshot.edges.filter(
    (edge) => includedSubjects.has(edge.s) && isLiveEdge(edge, retracted),
  );

  return {
    edges: [...schemaSnapshot.edges, ...publicEdges.map((edge) => ({ ...edge }))],
    retracted: [...schemaSnapshot.retracted],
  };
}

export function buildPublicSiteGraphBaseline({
  authority,
  now = () => new Date(),
}: {
  readonly authority: LocalSiteAuthority | undefined;
  readonly now?: () => Date;
}): PublicSiteGraphBaseline {
  const snapshot = createPublicSiteGraphSnapshot(authority);
  const sourceCursor = authority?.createTotalSyncPayload().cursor ?? "unavailable";
  const safeSnapshot = cloneGraphStoreSnapshot(snapshot);

  return {
    projectionId: siteItemPublicProjectionSpec.projectionId,
    definitionHash: siteItemPublicProjectionSpec.definitionHash,
    sourceCursor,
    baselineHash: hashSnapshot(safeSnapshot),
    generatedAt: now().toISOString(),
    snapshot: safeSnapshot,
  };
}
