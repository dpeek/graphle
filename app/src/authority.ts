import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { app } from "./graph/app.js";
import { bootstrap } from "./graph/bootstrap.js";
import { createTypeClient, type NamespaceClient } from "./graph/client.js";
import { core } from "./graph/core.js";
import { seedExampleGraph } from "./graph/example-data.js";
import {
  createTotalSyncPayload,
  validateAuthoritativeTotalSyncPayload,
  type TotalSyncPayload,
} from "./graph/sync.js";
import { createStore, type StoreSnapshot } from "./graph/store.js";

export type AppAuthority = {
  readonly snapshotPath: string;
  readonly store: ReturnType<typeof createStore>;
  readonly graph: NamespaceClient<typeof app>;
  createSyncPayload(): TotalSyncPayload;
  persist(): Promise<void>;
};

const defaultAuthoritySnapshotPath = fileURLToPath(
  new URL("../tmp/app-graph.snapshot.json", import.meta.url),
);

function resolveAuthoritySnapshotPath(configuredSnapshotPath?: string): string {
  const rawPath = configuredSnapshotPath?.trim() ?? Bun.env.IO_APP_SNAPSHOT_PATH?.trim();
  if (!rawPath) return defaultAuthoritySnapshotPath;
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function createAuthoritySnapshotPayload(snapshot: StoreSnapshot): TotalSyncPayload {
  return {
    mode: "total",
    scope: { kind: "graph" },
    snapshot,
    cursor: "authority:snapshot",
    completeness: "complete",
    freshness: "current",
  };
}

async function readAuthoritySnapshot(snapshotPath: string): Promise<StoreSnapshot | null> {
  try {
    const rawSnapshot = await readFile(snapshotPath, "utf8");
    const snapshot = JSON.parse(rawSnapshot) as StoreSnapshot;
    const validation = validateAuthoritativeTotalSyncPayload(
      createAuthoritySnapshotPayload(snapshot),
      app,
    );
    if (!validation.ok) {
      const messages = validation.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "snapshot";
        return `${path}: ${issue.message}`;
      });
      throw new Error(`Invalid authority snapshot in "${snapshotPath}": ${messages.join(" | ")}`);
    }
    return snapshot;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeAuthoritySnapshot(snapshotPath: string, snapshot: StoreSnapshot): Promise<void> {
  await mkdir(dirname(snapshotPath), { recursive: true });

  const tempPath = `${snapshotPath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await writeFile(tempPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
    await rename(tempPath, snapshotPath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function createAppAuthority(
  options: {
    snapshotPath?: string;
  } = {},
): Promise<AppAuthority> {
  const snapshotPath = resolveAuthoritySnapshotPath(options.snapshotPath);
  const store = createStore();
  bootstrap(store, core);
  bootstrap(store, app);

  const graph = createTypeClient(store, app);
  const persistedSnapshot = await readAuthoritySnapshot(snapshotPath);

  let revision = Date.now();

  async function persist(): Promise<void> {
    revision = Math.max(revision + 1, Date.now());
    await writeAuthoritySnapshot(snapshotPath, store.snapshot());
  }

  if (persistedSnapshot) {
    store.replace(persistedSnapshot);
  } else {
    seedExampleGraph(graph);
    await persist();
  }

  return {
    snapshotPath,
    store,
    graph,
    createSyncPayload() {
      return createTotalSyncPayload(store, {
        cursor: `authority:${revision}`,
        freshness: "current",
      });
    },
    persist,
  };
}
