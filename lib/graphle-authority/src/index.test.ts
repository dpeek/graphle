import { describe, expect, it } from "bun:test";

const requiredExports = [
  "authorizeCommand",
  "authorizeRead",
  "authorizeWrite",
  "createAuthoritativeGraphWriteResultValidator",
  "createAuthoritativeGraphWriteSession",
  "createAuthoritativeTotalSyncPayload",
  "createAuthoritativeTotalSyncValidator",
  "createPersistedAuthoritativeGraph",
  "defineAdmissionPolicy",
  "defineInstalledModuleActivationState",
  "defineInstalledModuleRecord",
  "defineInstalledModuleRuntimeExpectation",
  "defineInstalledModuleTarget",
  "defineShareGrant",
  "defineShareSurface",
  "defineWebPrincipalBootstrapPayload",
  "persistedAuthoritativeGraphStateVersion",
  "planInstalledModuleLifecycle",
  "validateAuthoritativeGraphWriteResult",
  "validateAuthoritativeGraphWriteTransaction",
  "validateAuthoritativeTotalSyncPayload",
  "validateInstalledModuleCompatibility",
  "validateShareGrant",
  "validateShareSurface",
] as const;

const forbiddenExports = [
  "createGraphClient",
  "createSyncedGraphClient",
  "createGraphStore",
  "GraphCommandSpec",
  "createModuleReadScope",
  "ObjectViewSpec",
  "WorkflowSpec",
] as const;

describe("@dpeek/graphle-authority", () => {
  it("keeps the package surface focused on authority-owned runtime behavior", async () => {
    const authorityExports = await import("@dpeek/graphle-authority");

    expect(Object.keys(authorityExports)).toEqual(expect.arrayContaining([...requiredExports]));
    for (const name of forbiddenExports) {
      expect(Object.keys(authorityExports)).not.toContain(name);
    }
    expect(Object.keys(authorityExports)).not.toContain("createJsonPersistedAuthoritativeGraph");
    expect(Object.keys(authorityExports)).not.toContain(
      "createJsonPersistedAuthoritativeGraphStorage",
    );
  });

  it("exposes node-backed persistence helpers from the server subpath", async () => {
    const authorityServerExports = await import("@dpeek/graphle-authority/server");

    expect(Object.keys(authorityServerExports)).toEqual(
      expect.arrayContaining([
        "createJsonPersistedAuthoritativeGraph",
        "createJsonPersistedAuthoritativeGraphStorage",
      ]),
    );
  });
});
