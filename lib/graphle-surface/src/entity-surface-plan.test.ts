import { describe, expect, it } from "bun:test";

import { edgeId } from "@dpeek/graphle-kernel";
import type { RecordSurfaceSpec } from "@dpeek/graphle-module";
import { core, stringTypeModule } from "@dpeek/graphle-module-core";

import {
  buildLiveEntitySurfacePlan,
  defaultEntitySurfaceCorePredicateIds,
  type AnyEntitySurfaceEntityRef,
  type AnyEntitySurfacePredicateRef,
} from "./entity-surface-plan.js";

const detailsField = {
  ...stringTypeModule.field({ cardinality: "one?" }),
  key: "test:plannerItem:details",
};
const priorityField = {
  ...stringTypeModule.field({ cardinality: "one?" }),
  key: "test:plannerItem:priority",
};
const notesField = {
  ...stringTypeModule.field({ cardinality: "one?" }),
  key: "test:plannerItem:notes",
};

function createPredicate(
  field: AnyEntitySurfacePredicateRef["field"],
  value: unknown,
): AnyEntitySurfacePredicateRef {
  return {
    batch<TResult>(fn: () => TResult) {
      return fn();
    },
    field,
    get() {
      return value;
    },
    listEntities() {
      return [];
    },
    predicateId: edgeId(field),
    rangeType: undefined,
    resolveEntity() {
      return undefined;
    },
    subjectId: "test:entity",
    subscribe() {
      return () => undefined;
    },
  } as AnyEntitySurfacePredicateRef;
}

function createPlannerEntity(): AnyEntitySurfaceEntityRef {
  return {
    batch<TResult>(fn: () => TResult) {
      return fn();
    },
    delete() {
      return undefined;
    },
    fields: {
      name: createPredicate(core.node.fields.name, "Alpha"),
      description: createPredicate(core.node.fields.description, "Surface planning fixture"),
      details: createPredicate(detailsField, "Alpha details"),
      priority: createPredicate(priorityField, "High"),
      notes: createPredicate(notesField, "Planner notes"),
      updatedAt: createPredicate(core.node.fields.updatedAt, new Date("2026-04-17T00:00:00Z")),
      type: createPredicate(core.node.fields.type, ["test:plannerItem"]),
      createdAt: createPredicate(core.node.fields.createdAt, new Date("2026-04-16T00:00:00Z")),
    },
    get() {
      return {};
    },
    id: "test:entity",
    type: {} as AnyEntitySurfaceEntityRef["type"],
    update() {
      return {};
    },
    validateDelete() {
      return { ok: true, phase: "mutation", value: undefined } as ReturnType<
        AnyEntitySurfaceEntityRef["validateDelete"]
      >;
    },
    validateUpdate() {
      return {
        changedPredicateKeys: [],
        event: "update",
        ok: true,
        phase: "mutation",
        value: {},
      } as ReturnType<AnyEntitySurfaceEntityRef["validateUpdate"]>;
    },
  };
}

describe("entity surface plan", () => {
  it("applies the default live-entity core field policy and preserves field-tree body order", () => {
    const plan = buildLiveEntitySurfacePlan(createPlannerEntity());

    expect(
      plan.rows.map((row) => ({
        pathLabel: row.pathLabel,
        role: row.role,
      })),
    ).toEqual([
      { pathLabel: "name", role: "title" },
      { pathLabel: "description", role: "body" },
      { pathLabel: "details", role: "body" },
      { pathLabel: "priority", role: "body" },
      { pathLabel: "notes", role: "body" },
      { pathLabel: "updatedAt", role: "meta" },
      { pathLabel: "id", role: "hidden" },
      { pathLabel: "type", role: "hidden" },
      { pathLabel: "createdAt", role: "hidden" },
    ]);
    expect(defaultEntitySurfaceCorePredicateIds.name).toBe(edgeId(core.node.fields.name));
  });

  it("uses authored record-surface sections as structure without readonly binding", () => {
    const surface = {
      key: "test:plannerItem",
      sections: [
        {
          fields: [{ label: "Priority", path: "priority" }, { path: "details" }],
          key: "summary",
          title: "Summary",
        },
        {
          description: "Secondary authored fields.",
          fields: [{ path: "notes" }],
          key: "more",
          title: "More",
        },
      ],
      subject: "test:plannerItem",
      subtitleField: "notes",
      titleField: "priority",
    } satisfies RecordSurfaceSpec;

    const plan = buildLiveEntitySurfacePlan(createPlannerEntity(), { surface });

    expect(
      plan.rows.map((row) => ({
        pathLabel: row.pathLabel,
        role: row.role,
        section: row.section?.key,
        title: row.title,
      })),
    ).toEqual([
      { pathLabel: "priority", role: "title", section: "summary", title: "Priority" },
      { pathLabel: "details", role: "body", section: "summary", title: undefined },
      { pathLabel: "notes", role: "meta", section: "more", title: undefined },
      { pathLabel: "updatedAt", role: "meta", section: undefined, title: undefined },
      { pathLabel: "id", role: "hidden", section: undefined, title: undefined },
      { pathLabel: "type", role: "hidden", section: undefined, title: undefined },
      { pathLabel: "createdAt", role: "hidden", section: undefined, title: undefined },
    ]);
    expect(plan.sections.map((section) => section.key)).toEqual(["summary", "more", "fields"]);
    expect(plan.sections[0]?.rows.map((row) => row.pathLabel)).toEqual(["priority", "details"]);
    expect(plan.sections[1]?.rows.map((row) => row.pathLabel)).toEqual(["notes"]);
  });
});
