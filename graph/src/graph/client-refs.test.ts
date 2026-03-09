import { describe, expect, it } from "bun:test";
import { app } from "./app";
import { bootstrap } from "./bootstrap";
import { createTypeClient, type EntityRef, type PredicateRef } from "./client";
import { core } from "./core";
import { edgeId } from "./schema";
import { createStore } from "./store";

function setupGraph() {
  const store = createStore();
  bootstrap(store, core);
  bootstrap(store, app);
  const graph = createTypeClient(store, app);

  const companyId = graph.company.create({
    name: "Acme",
    website: new URL("https://acme.com"),
    status: app.status.values.active.id,
    tags: ["enterprise", "saas"],
  });

  return { store, graph, companyId };
}

describe("typed refs", () => {
  it("returns stable entity and predicate refs for the same node", () => {
    const { graph, companyId } = setupGraph();

    const companyRefA = graph.company.ref(companyId);
    const companyRefB = graph.company.ref(companyId);

    expect(companyRefA).toBe(companyRefB);
    expect(graph.company.node(companyId)).toBe(companyRefA);
    expect(companyRefA.fields.name).toBe(companyRefB.fields.name);
    expect(companyRefA.fields.website).toBe(companyRefB.fields.website);
  });

  it("preserves decoded value and cardinality typing through predicate refs", () => {
    const { graph, companyId } = setupGraph();

    const companyRef: EntityRef<typeof app.company, typeof app & typeof core> =
      graph.company.ref(companyId);
    const nameRef: PredicateRef<typeof app.company.fields.name, typeof app & typeof core> =
      companyRef.fields.name;
    const name: string = nameRef.get();
    const foundedYear: number | undefined = companyRef.fields.foundedYear.get();
    const tags: string[] = companyRef.fields.tags.get();
    const website: URL = companyRef.fields.website.get();
    const status: string = companyRef.fields.status.get();

    expect(name).toBe("Acme");
    expect(foundedYear).toBeUndefined();
    expect(tags).toEqual(["enterprise", "saas"]);
    expect(website.toString()).toBe("https://acme.com/");
    expect(status).toBe(app.status.values.active.id);
  });

  it("addresses entity-reference leaves as typed predicate refs", () => {
    const { graph, companyId } = setupGraph();
    const personId = graph.person.create({
      name: "Alice",
      worksAt: [companyId],
    });

    const personRef = graph.person.ref(personId);
    const worksAtRef: PredicateRef<typeof app.person.fields.worksAt, typeof app & typeof core> =
      personRef.fields.worksAt;
    const employers: string[] = worksAtRef.get();

    expect(worksAtRef.subjectId).toBe(personId);
    expect(worksAtRef.predicateId).toBe(edgeId(app.person.fields.worksAt));
    expect(employers).toEqual([companyId]);
  });

  it("subscribes through predicate refs without whole-entity notifications", () => {
    const { graph, companyId } = setupGraph();
    const companyRef = graph.company.ref(companyId);
    let notifications = 0;

    const unsubscribe = companyRef.fields.name.subscribe(() => {
      notifications += 1;
    });

    companyRef.update({ website: new URL("https://acme-2.com") });
    expect(notifications).toBe(0);

    companyRef.update({ name: "Acme 2" });
    expect(notifications).toBe(1);
    expect(companyRef.fields.name.get()).toBe("Acme 2");

    unsubscribe();
    companyRef.update({ name: "Acme 3" });
    expect(notifications).toBe(1);
  });
});
