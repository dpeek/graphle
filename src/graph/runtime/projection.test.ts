import { describe, expect, it } from "bun:test";

import {
  createModuleReadScope,
  createModuleReadScopeRequest,
  defineModuleReadScopeDefinition,
  defineProjectionCatalog,
  defineProjectionSpec,
  matchesModuleReadScope,
  matchesModuleReadScopeRequest,
} from "./projection.js";
import { createModuleSyncScope, graphSyncScope } from "./sync/index.js";

describe("projection runtime contracts", () => {
  it("materializes stable requested and delivered module read scopes", () => {
    const definition = defineModuleReadScopeDefinition({
      kind: "module",
      moduleId: "ops/workflow",
      scopeId: "scope:ops/workflow:review",
      definitionHash: "scope-def:ops/workflow:review:v1",
    });

    const requestedScope = createModuleReadScopeRequest(definition);
    const deliveredScope = createModuleReadScope(definition, "policy:0");

    expect(requestedScope).toEqual({
      kind: "module",
      moduleId: "ops/workflow",
      scopeId: "scope:ops/workflow:review",
    });
    expect(deliveredScope).toEqual({
      kind: "module",
      moduleId: "ops/workflow",
      scopeId: "scope:ops/workflow:review",
      definitionHash: "scope-def:ops/workflow:review:v1",
      policyFilterVersion: "policy:0",
    });
    expect(matchesModuleReadScopeRequest(requestedScope, definition)).toBe(true);
    expect(matchesModuleReadScopeRequest(deliveredScope, definition)).toBe(true);
    expect(matchesModuleReadScopeRequest(graphSyncScope, definition)).toBe(false);
    expect(matchesModuleReadScope(deliveredScope, definition)).toBe(true);
    expect(
      matchesModuleReadScope(
        createModuleSyncScope({
          moduleId: definition.moduleId,
          scopeId: definition.scopeId,
          definitionHash: "scope-def:ops/workflow:review:v2",
          policyFilterVersion: "policy:0",
        }),
        definition,
      ),
    ).toBe(false);
  });

  it("validates projection metadata and catalog uniqueness", () => {
    const projectBranchBoard = defineProjectionSpec({
      projectionId: "ops/workflow:project-branch-board",
      kind: "collection-index",
      definitionHash: "projection-def:ops/workflow:project-branch-board:v1",
      sourceScopeKinds: ["module"],
      dependencyKeys: ["projection:ops/workflow:project-branch-board", "scope:ops/workflow:review"],
      rebuildStrategy: "full",
      visibilityMode: "policy-filtered",
    });

    expect(defineProjectionCatalog([projectBranchBoard])).toEqual([projectBranchBoard]);

    expect(() =>
      defineProjectionSpec({
        ...projectBranchBoard,
        dependencyKeys: [
          "projection:ops/workflow:project-branch-board",
          "projection:ops/workflow:project-branch-board",
        ],
      }),
    ).toThrow("dependencyKeys must not contain duplicate values.");

    expect(() =>
      defineProjectionCatalog([
        projectBranchBoard,
        defineProjectionSpec({
          ...projectBranchBoard,
          definitionHash: "projection-def:ops/workflow:project-branch-board:v2",
        }),
      ]),
    ).toThrow("projectionId must not contain duplicate values.");
  });
});
