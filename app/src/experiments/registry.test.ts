import { bootstrap, createStore, createTypeClient, core } from "@io/graph";
import { describe, expect, it } from "bun:test";

import { app } from "../graph/app.js";
import { appExperimentGraphs, appGraphDefinitions, seedRegisteredAppExperiments } from "./graph.js";
import { appExperimentWebs, appRoutes } from "./web.js";

describe("app experiment registries", () => {
  it("registers unique experiment keys across graph and web contributions", () => {
    expect(new Set(appExperimentGraphs.map((definition) => definition.key)).size).toBe(
      appExperimentGraphs.length,
    );
    expect(new Set(appExperimentWebs.map((definition) => definition.key)).size).toBe(
      appExperimentWebs.length,
    );
  });

  it("merges experiment-owned schema into the shared app namespace", () => {
    expect(Object.keys(appGraphDefinitions).sort()).toEqual([
      "block",
      "company",
      "envVar",
      "person",
      "secretRef",
      "status",
    ]);
    expect(app.company.values.key).toBe(appGraphDefinitions.company.values.key);
    expect(app.block.values.key).toBe(appGraphDefinitions.block.values.key);
    expect(app.envVar.values.key).toBe(appGraphDefinitions.envVar.values.key);
  });

  it("runs registered experiment seed hooks through the shared example runtime", () => {
    const store = createStore();
    bootstrap(store, core);
    bootstrap(store, app);
    const graph = createTypeClient(store, app);

    const seeded = seedRegisteredAppExperiments(graph);

    expect(graph.company.get(seeded.acme).name).toBe("Acme Corp");
    expect(graph.person.get(seeded.alice).name).toBe("Alice");
    expect(graph.block.get(seeded.rootBlock).text).toBe("Untitled");
  });

  it("collects unique route keys and paths from experiment web registrations", () => {
    expect(new Set(appRoutes.map((route) => route.key)).size).toBe(appRoutes.length);
    expect(new Set(appRoutes.map((route) => route.path)).size).toBe(appRoutes.length);
  });
});
