import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { app } from "./graph/app.js";
import { bootstrap } from "./graph/bootstrap.js";
import { createTypeClient } from "./graph/client.js";
import { core } from "./graph/core.js";
import {
  validateAuthoritativeTotalSyncPayload,
  type TotalSyncPayload,
} from "./graph/sync.js";
import { createStore, type StoreSnapshot } from "./graph/store.js";
import { createAppAuthority } from "./authority.js";
import { handleSyncRequest } from "./server-app.js";

const tempDirs: string[] = [];

async function createTempSnapshotPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "io-app-authority-"));
  tempDirs.push(dir);
  return join(dir, "graph.snapshot.json");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("app authority", () => {
  it("seeds and persists the authority snapshot when no snapshot file exists", async () => {
    const snapshotPath = await createTempSnapshotPath();

    const authority = await createAppAuthority({ snapshotPath });
    const persistedSnapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as StoreSnapshot;
    const persistedFiles = await readdir(join(snapshotPath, ".."));

    expect(authority.graph.company.list().map((company) => company.name)).toEqual([
      "Acme Corp",
      "Estii",
      "Atlas Labs",
    ]);
    expect(authority.graph.person.list().map((person) => person.name)).toEqual(["Alice"]);
    expect(authority.graph.block.list().map((block) => block.text)).toEqual(["Untitled"]);
    expect(persistedSnapshot.edges.length).toBeGreaterThan(0);
    expect(persistedSnapshot.retracted.length).toBeGreaterThanOrEqual(0);
    expect(persistedFiles).toEqual(["graph.snapshot.json"]);
  });

  it("loads an existing snapshot from disk instead of reseeding example data", async () => {
    const snapshotPath = await createTempSnapshotPath();
    const store = createStore();
    bootstrap(store, core);
    bootstrap(store, app);
    const graph = createTypeClient(store, app);

    graph.company.create({
      name: "Persisted Only Co",
      status: app.status.values.active.id,
      website: new URL("https://persisted-only.example"),
    });

    await writeFile(snapshotPath, JSON.stringify(store.snapshot(), null, 2) + "\n", "utf8");

    const authority = await createAppAuthority({ snapshotPath });

    expect(authority.graph.company.list().map((company) => company.name)).toEqual([
      "Persisted Only Co",
    ]);
    expect(authority.graph.person.list()).toEqual([]);
    expect(authority.graph.block.list()).toEqual([]);
  });

  it("serves a valid total-sync payload from the sync route", async () => {
    const snapshotPath = await createTempSnapshotPath();
    const authority = await createAppAuthority({ snapshotPath });

    const response = handleSyncRequest(new Request("http://app.local/api/sync"), authority);
    const payload = (await response.json()) as TotalSyncPayload;
    const validation = validateAuthoritativeTotalSyncPayload(payload, app);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.mode).toBe("total");
    expect(payload.scope).toEqual({ kind: "graph" });
    expect(payload.cursor.startsWith("authority:")).toBe(true);
    expect(validation.ok).toBe(true);
  });
});
