import { describe, expect, it, setDefaultTimeout } from "bun:test";

import {
  bootstrap,
  createStore,
  createTypeClient,
  edgeId,
  type AuthorizationContext,
  type GraphWriteTransaction,
  type StoreSnapshot,
} from "@io/core/graph";
import { core } from "@io/core/graph/modules";
import { ops } from "@io/core/graph/modules/ops";
import type {
  WorkflowMutationAction,
  WorkflowMutationResult,
} from "@io/core/graph/modules/ops/workflow";
import { pkm } from "@io/core/graph/modules/pkm";

import { createAnonymousAuthorizationContext } from "./auth-bridge.js";
import { createInMemoryTestWebAppAuthorityStorage } from "./authority-test-storage.js";
import {
  applyStagedWebAuthorityMutation,
  type WebAppAuthority,
  createWebAppAuthority,
  type WebAuthorityCommand,
  type WebAppAuthorityStorage,
  type WebAppAuthoritySyncOptions,
  type WebAppAuthorityTransactionOptions,
} from "./authority.js";
import {
  handleWebCommandRequest,
  handleSyncRequest,
  handleTransactionRequest,
} from "./server-routes.js";

const productGraph = { ...core, ...pkm, ...ops } as const;
const envVarSecretPredicateId = edgeId(ops.envVar.fields.secret);

setDefaultTimeout(20_000);

function createTestAuthorizationContext(
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext {
  return {
    ...createAnonymousAuthorizationContext({
      graphId: "graph:test",
      policyVersion: 0,
    }),
    ...overrides,
  };
}

function createAuthorityAuthorizationContext(
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext {
  return createTestAuthorizationContext({
    principalId: "principal:authority",
    principalKind: "service",
    roleKeys: ["graph:authority"],
    sessionId: "session:authority",
    ...overrides,
  });
}

function createHumanAuthorizationContext(
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext {
  return createTestAuthorizationContext({
    principalId: "principal:human",
    principalKind: "human",
    roleKeys: ["graph:member"],
    sessionId: "session:human",
    ...overrides,
  });
}

function buildGraphWriteTransaction(
  before: StoreSnapshot,
  after: StoreSnapshot,
  id: string,
): GraphWriteTransaction {
  const previousEdgeIds = new Set(before.edges.map((edge) => edge.id));
  const previousRetractedIds = new Set(before.retracted);

  return {
    id,
    ops: [
      ...after.retracted
        .filter((edgeId) => !previousRetractedIds.has(edgeId))
        .map((edgeId) => ({ op: "retract" as const, edgeId })),
      ...after.edges
        .filter((edge) => !previousEdgeIds.has(edge.id))
        .map((edge) => ({
          op: "assert" as const,
          edge: { ...edge },
        })),
    ],
  };
}

async function executeWorkflowMutation(
  authority: WebAppAuthority,
  authorization: AuthorizationContext,
  input: WorkflowMutationAction,
): Promise<WorkflowMutationResult> {
  return (await authority.executeCommand(
    {
      kind: "workflow-mutation",
      input,
    },
    { authorization },
  )) as WorkflowMutationResult;
}

async function createWorkflowFixture(
  authority: WebAppAuthority,
  authorization: AuthorizationContext,
) {
  const project = await executeWorkflowMutation(authority, authorization, {
    action: "createProject",
    title: "IO",
    projectKey: "project:io",
  });
  const repository = await executeWorkflowMutation(authority, authorization, {
    action: "createRepository",
    projectId: project.summary.id,
    title: "io",
    repositoryKey: "repo:io",
    repoRoot: "/tmp/io",
    defaultBaseBranch: "main",
  });
  const branch = await executeWorkflowMutation(authority, authorization, {
    action: "createBranch",
    projectId: project.summary.id,
    title: "Workflow authority",
    branchKey: "branch:workflow-authority",
    goalSummary: "Implement workflow authority commands",
    state: "ready",
  });
  const repositoryBranch = await executeWorkflowMutation(authority, authorization, {
    action: "attachBranchRepositoryTarget",
    branchId: branch.summary.id,
    repositoryId: repository.summary.id,
    branchName: "workflow-authority",
    baseBranchName: "main",
  });

  return {
    branchId: branch.summary.id,
    projectId: project.summary.id,
    repositoryBranchId: repositoryBranch.summary.id,
    repositoryId: repository.summary.id,
  };
}

describe("web authority", () => {
  it("rolls back staged side effects when staging fails before commit", async () => {
    const secretValuesRef = {
      current: new Map([["secret:existing", "sk-live-first"]]),
    };
    const pendingSecretWriteRef = {
      current: null as {
        readonly secretId: string;
        readonly value: string;
      } | null,
    };
    let commitCalls = 0;

    await expect(
      applyStagedWebAuthorityMutation({
        changed: true,
        result: {
          secretId: "secret:existing",
          secretVersion: 2,
        },
        writeScope: "server-command",
        async commit() {
          commitCalls += 1;
        },
        stage(result, context) {
          const previousSecretValues = secretValuesRef.current;
          context.addRollback(() => {
            secretValuesRef.current = previousSecretValues;
            pendingSecretWriteRef.current = null;
          });

          const nextSecretValues = new Map(previousSecretValues);
          nextSecretValues.set(result.secretId, "sk-live-second");
          secretValuesRef.current = nextSecretValues;
          pendingSecretWriteRef.current = {
            secretId: result.secretId,
            value: "sk-live-second",
          };

          throw new Error("forced staging failure");
        },
      }),
    ).rejects.toThrow("forced staging failure");

    expect(commitCalls).toBe(0);
    expect(secretValuesRef.current).toEqual(new Map([["secret:existing", "sk-live-first"]]));
    expect(pendingSecretWriteRef.current).toBeNull();
  });

  it("allows authority-only commands to reuse the shared authority command seam", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const storage = createInMemoryTestWebAppAuthorityStorage();
    const authority = await createWebAppAuthority(storage.storage);
    const envVarId = authority.graph.envVar.create({
      description: "Managed by the authority",
      name: "OPENAI_API_KEY",
    });
    const mutationStore = createStore();
    bootstrap(mutationStore, core);
    bootstrap(mutationStore, pkm);
    bootstrap(mutationStore, ops);
    const mutationGraph = createTypeClient(mutationStore, productGraph);
    mutationStore.replace(authority.store.snapshot());
    const before = mutationStore.snapshot();

    mutationGraph.envVar.update(envVarId, {
      description: "Rotated by the authority command",
    });

    const transaction = buildGraphWriteTransaction(
      before,
      mutationStore.snapshot(),
      "tx:authority-only-command",
    );
    const result = await applyStagedWebAuthorityMutation({
      changed: transaction.ops.length > 0,
      result: {
        description: "Rotated by the authority command",
        entityId: envVarId,
      },
      writeScope: "authority-only",
      async commit(writeScope) {
        await authority.applyTransaction(transaction, { authorization, writeScope });
      },
    });

    expect(result).toEqual({
      description: "Rotated by the authority command",
      entityId: envVarId,
    });
    expect(authority.graph.envVar.get(envVarId).description).toBe(
      "Rotated by the authority command",
    );
    expect(storage.read()?.writeHistory.results.at(-1)?.writeScope).toBe("authority-only");
  });

  it("stores secret plaintext outside sync and reloads it across restart", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const storage = createInMemoryTestWebAppAuthorityStorage();
    const authority = await createWebAppAuthority(storage.storage);
    const envVarId = authority.graph.envVar.create({
      description: "Primary model credential",
      name: "OPENAI_API_KEY",
    });

    const created = await authority.writeSecretField(
      {
        entityId: envVarId,
        predicateId: envVarSecretPredicateId,
        plaintext: "sk-live-first",
      },
      { authorization },
    );
    const createdSecretId = authority.graph.envVar.get(envVarId).secret;
    if (!createdSecretId) throw new Error("Expected created env var secret.");

    expect(created.created).toBe(true);
    expect(created.rotated).toBe(false);
    expect(created.secretVersion).toBe(1);
    expect(JSON.stringify(authority.createSyncPayload({ authorization }))).not.toContain(
      "sk-live-first",
    );
    expect(storage.read()?.secrets?.[createdSecretId]?.value).toBe("sk-live-first");
    expect(
      storage
        .read()
        ?.writeHistory.results.at(-1)
        ?.txId.startsWith(`secret-field:${envVarId}:${envVarSecretPredicateId}:`),
    ).toBe(true);
    expect(storage.read()?.writeHistory.results.at(-1)?.writeScope).toBe("server-command");

    const rotated = await authority.writeSecretField(
      {
        entityId: envVarId,
        predicateId: envVarSecretPredicateId,
        plaintext: "sk-live-second",
      },
      { authorization },
    );
    const restarted = await createWebAppAuthority(storage.storage);
    const restartedSecretId = restarted.graph.envVar.get(envVarId).secret;
    if (!restartedSecretId) throw new Error("Expected restarted env var secret.");

    expect(rotated.created).toBe(false);
    expect(rotated.rotated).toBe(true);
    expect(rotated.secretVersion).toBe(2);
    expect(storage.read()?.secrets?.[createdSecretId]?.value).toBe("sk-live-second");
    expect(restartedSecretId).toBe(createdSecretId);
    expect(restarted.graph.secretHandle.get(restartedSecretId)?.version).toBe(2);
    expect(JSON.stringify(restarted.createSyncPayload({ authorization }))).not.toContain(
      "sk-live-second",
    );

    const confirmed = await restarted.writeSecretField(
      {
        entityId: envVarId,
        predicateId: envVarSecretPredicateId,
        plaintext: "sk-live-second",
      },
      { authorization },
    );

    expect(confirmed).toMatchObject({
      created: false,
      rotated: false,
      secretId: createdSecretId,
      secretVersion: 2,
    });
  });

  it("rejects ordinary transactions that directly rewrite secret-backed refs", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const storage = createInMemoryTestWebAppAuthorityStorage();
    const authority = await createWebAppAuthority(storage.storage);

    const primaryEnvVarId = authority.graph.envVar.create({
      description: "Primary model credential",
      name: "OPENAI_API_KEY",
    });
    const secondaryEnvVarId = authority.graph.envVar.create({
      description: "Notifications integration",
      name: "SLACK_BOT_TOKEN",
    });

    await authority.writeSecretField(
      {
        entityId: primaryEnvVarId,
        predicateId: envVarSecretPredicateId,
        plaintext: "sk-live-first",
      },
      { authorization },
    );
    await authority.writeSecretField(
      {
        entityId: secondaryEnvVarId,
        predicateId: envVarSecretPredicateId,
        plaintext: "xapp-secret",
      },
      { authorization },
    );

    const primarySecretId = authority.graph.envVar.get(primaryEnvVarId).secret;
    const secondarySecretId = authority.graph.envVar.get(secondaryEnvVarId).secret;
    if (!primarySecretId || !secondarySecretId) {
      throw new Error("Expected both env vars to reference secrets.");
    }

    const mutationStore = createStore();
    bootstrap(mutationStore, core);
    bootstrap(mutationStore, pkm);
    bootstrap(mutationStore, ops);
    const mutationGraph = createTypeClient(mutationStore, productGraph);
    mutationStore.replace(authority.store.snapshot());
    const before = mutationStore.snapshot();

    mutationGraph.envVar.update(primaryEnvVarId, {
      secret: secondarySecretId,
    });

    const transaction = buildGraphWriteTransaction(
      before,
      mutationStore.snapshot(),
      "tx:direct-secret",
    );

    await expect(authority.applyTransaction(transaction, { authorization })).rejects.toMatchObject({
      result: expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "policy.write.forbidden",
            message: expect.stringContaining('requires "server-command" writes'),
          }),
        ]),
      }),
    });
    expect(authority.graph.envVar.get(primaryEnvVarId).secret).toBe(primarySecretId);
  });

  it("rolls back staged secret state when a server-command commit fails", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const backingStorage = createInMemoryTestWebAppAuthorityStorage();
    let failServerCommandCommit = false;
    const storage = {
      load() {
        return backingStorage.storage.load();
      },
      loadSecrets() {
        return backingStorage.storage.loadSecrets();
      },
      async commit(input, options) {
        if (failServerCommandCommit) {
          throw new Error("forced server-command commit failure");
        }
        await backingStorage.storage.commit(input, options);
      },
      persist(input) {
        return backingStorage.storage.persist(input);
      },
    } satisfies WebAppAuthorityStorage;
    const authority = await createWebAppAuthority(storage);
    const envVarId = authority.graph.envVar.create({
      description: "Primary model credential",
      name: "OPENAI_API_KEY",
    });

    const created = await authority.writeSecretField(
      {
        entityId: envVarId,
        predicateId: envVarSecretPredicateId,
        plaintext: "sk-live-first",
      },
      { authorization },
    );

    failServerCommandCommit = true;

    await expect(
      authority.writeSecretField(
        {
          entityId: envVarId,
          predicateId: envVarSecretPredicateId,
          plaintext: "sk-live-second",
        },
        { authorization },
      ),
    ).rejects.toThrow("forced server-command commit failure");

    expect(backingStorage.read()?.secrets?.[created.secretId]?.value).toBe("sk-live-first");
    expect(authority.graph.secretHandle.get(created.secretId)?.version).toBe(1);

    failServerCommandCommit = false;

    const retried = await authority.writeSecretField(
      {
        entityId: envVarId,
        predicateId: envVarSecretPredicateId,
        plaintext: "sk-live-second",
      },
      { authorization },
    );

    expect(created).toMatchObject({
      created: true,
      rotated: false,
      secretVersion: 1,
    });
    expect(retried).toMatchObject({
      created: false,
      rotated: true,
      secretId: created.secretId,
      secretVersion: 2,
    });
    expect(backingStorage.read()?.secrets?.[created.secretId]?.value).toBe("sk-live-second");
    expect(authority.graph.secretHandle.get(created.secretId)?.version).toBe(2);
    expect(backingStorage.read()?.writeHistory.results.at(-1)?.writeScope).toBe("server-command");
  });

  it("routes generic secret-field writes through the web server helper", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const storage = createInMemoryTestWebAppAuthorityStorage();
    const authority = await createWebAppAuthority(storage.storage);
    const envVarId = authority.graph.envVar.create({
      description: "Shared command credential",
      name: "OPENAI_API_KEY",
    });
    const command = {
      kind: "write-secret-field",
      input: {
        entityId: envVarId,
        predicateId: envVarSecretPredicateId,
        plaintext: "sk-live-command",
      },
    } satisfies WebAuthorityCommand;

    const result = await authority.executeCommand(command, { authorization });

    expect(result).toMatchObject({
      created: true,
      entityId: envVarId,
      predicateId: envVarSecretPredicateId,
      rotated: false,
      secretVersion: 1,
    });
    expect(authority.graph.envVar.get(envVarId).secret).toBe(result.secretId);
    expect(storage.read()?.writeHistory.results.at(-1)?.writeScope).toBe("server-command");
    expect(JSON.stringify(authority.createSyncPayload({ authorization }))).not.toContain(
      "sk-live-command",
    );
  });

  it("rejects unsupported command kinds before mutating the web authority", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const storage = createInMemoryTestWebAppAuthorityStorage();
    const authority = await createWebAppAuthority(storage.storage);
    const before = authority.store.snapshot();

    await expect(
      authority.executeCommand(
        {
          kind: "unsupported-web-proof",
        } as unknown as WebAuthorityCommand,
        { authorization },
      ),
    ).rejects.toThrow("Unsupported web authority command.");

    expect(authority.store.snapshot()).toEqual(before);
  });

  it("routes shared authority commands through the web server helper", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const storage = createInMemoryTestWebAppAuthorityStorage();
    const authority = await createWebAppAuthority(storage.storage);
    const envVarId = authority.graph.envVar.create({
      description: "Shared command route credential",
      name: "OPENAI_API_KEY",
    });

    const response = await handleWebCommandRequest(
      new Request("http://web.local/api/commands", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: "write-secret-field",
          input: {
            entityId: envVarId,
            predicateId: envVarSecretPredicateId,
            plaintext: "sk-live-command-route",
          },
        } satisfies WebAuthorityCommand),
      }),
      authority,
      authorization,
    );
    const payload = (await response.json()) as {
      readonly created: boolean;
      readonly entityId: string;
      readonly predicateId: string;
      readonly rotated: boolean;
      readonly secretId: string;
      readonly secretVersion: number;
    };

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      created: true,
      entityId: envVarId,
      predicateId: envVarSecretPredicateId,
      rotated: false,
      secretVersion: 1,
    });
    expect(authority.graph.envVar.get(envVarId).secret).toBe(payload.secretId);
    expect(storage.read()?.writeHistory.results.at(-1)?.writeScope).toBe("server-command");
    expect(JSON.stringify(authority.createSyncPayload({ authorization }))).not.toContain(
      "sk-live-command-route",
    );
  });

  it("denies direct transactions without authority access by default", async () => {
    const authorization = createHumanAuthorizationContext();
    const storage = createInMemoryTestWebAppAuthorityStorage();
    const authority = await createWebAppAuthority(storage.storage);
    const mutationStore = createStore();
    bootstrap(mutationStore, core);
    bootstrap(mutationStore, pkm);
    bootstrap(mutationStore, ops);
    mutationStore.replace(authority.store.snapshot());
    const mutationGraph = createTypeClient(mutationStore, productGraph);
    const before = mutationStore.snapshot();

    mutationGraph.envVar.create({
      description: "Blocked without authority access",
      name: "OPENAI_API_KEY",
    });

    const transaction = buildGraphWriteTransaction(
      before,
      mutationStore.snapshot(),
      "tx:forbidden",
    );

    await expect(authority.applyTransaction(transaction, { authorization })).rejects.toMatchObject({
      result: expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "policy.write.forbidden",
            message: expect.stringContaining("policy.write.forbidden"),
          }),
        ]),
      }),
    });
    expect(storage.read()?.writeHistory.results.length ?? 0).toBe(0);
  });

  it("denies authority commands without authority access and surfaces stable vocabulary", async () => {
    const authorization = createHumanAuthorizationContext();
    const storage = createInMemoryTestWebAppAuthorityStorage();
    const authority = await createWebAppAuthority(storage.storage);
    const envVarId = authority.graph.envVar.create({
      description: "Shared command credential",
      name: "OPENAI_API_KEY",
    });

    await expect(
      authority.executeCommand(
        {
          kind: "write-secret-field",
          input: {
            entityId: envVarId,
            predicateId: envVarSecretPredicateId,
            plaintext: "sk-live-command",
          },
        },
        { authorization },
      ),
    ).rejects.toMatchObject({
      code: "policy.command.forbidden",
      message: expect.stringContaining("policy.command.forbidden"),
      status: 403,
    });
    expect(storage.read()?.writeHistory.results.length ?? 0).toBe(0);
  });

  it("rejects stale policy versions before authoritative writes commit", async () => {
    const authorization = createAuthorityAuthorizationContext({
      policyVersion: 1,
    });
    const storage = createInMemoryTestWebAppAuthorityStorage();
    const authority = await createWebAppAuthority(storage.storage);
    const mutationStore = createStore();
    bootstrap(mutationStore, core);
    bootstrap(mutationStore, pkm);
    bootstrap(mutationStore, ops);
    mutationStore.replace(authority.store.snapshot());
    const mutationGraph = createTypeClient(mutationStore, productGraph);
    const before = mutationStore.snapshot();

    mutationGraph.envVar.create({
      description: "Blocked by stale policy version",
      name: "OPENAI_API_KEY",
    });

    const transaction = buildGraphWriteTransaction(
      before,
      mutationStore.snapshot(),
      "tx:stale-policy",
    );

    await expect(authority.applyTransaction(transaction, { authorization })).rejects.toMatchObject({
      result: expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "policy.stale_context",
            message: expect.stringContaining("policy.stale_context"),
          }),
        ]),
      }),
    });
    expect(storage.read()?.writeHistory.results.length ?? 0).toBe(0);
  });

  it("creates workflow entities through the shared workflow mutation command", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const storage = createInMemoryTestWebAppAuthorityStorage();
    const authority = await createWebAppAuthority(storage.storage);

    const project = await executeWorkflowMutation(authority, authorization, {
      action: "createProject",
      title: "IO",
      projectKey: "project:io",
    });
    const repository = await executeWorkflowMutation(authority, authorization, {
      action: "createRepository",
      projectId: project.summary.id,
      title: "io",
      repositoryKey: "repo:io",
      repoRoot: "/tmp/io",
      defaultBaseBranch: "main",
    });
    const branch = await executeWorkflowMutation(authority, authorization, {
      action: "createBranch",
      projectId: project.summary.id,
      title: "Workflow authority",
      branchKey: "branch:workflow-authority",
      goalSummary: "Implement workflow mutation commands",
      state: "ready",
    });

    expect(project).toMatchObject({
      action: "createProject",
      created: true,
      summary: {
        entity: "project",
        projectKey: "project:io",
        title: "IO",
      },
    });
    expect(repository).toMatchObject({
      action: "createRepository",
      created: true,
      summary: {
        entity: "repository",
        repositoryKey: "repo:io",
        projectId: project.summary.id,
      },
    });
    expect(branch).toMatchObject({
      action: "createBranch",
      created: true,
      summary: {
        entity: "branch",
        branchKey: "branch:workflow-authority",
        projectId: project.summary.id,
        state: "ready",
      },
    });
    expect(storage.read()?.writeHistory.results.at(-1)?.writeScope).toBe("server-command");
  });

  it("enforces the v1 inferred-project and attached-repository limits", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const authority = await createWebAppAuthority(
      createInMemoryTestWebAppAuthorityStorage().storage,
    );
    const project = await executeWorkflowMutation(authority, authorization, {
      action: "createProject",
      title: "IO",
      projectKey: "project:io",
    });
    await executeWorkflowMutation(authority, authorization, {
      action: "createRepository",
      projectId: project.summary.id,
      title: "io",
      repositoryKey: "repo:io",
      repoRoot: "/tmp/io",
      defaultBaseBranch: "main",
    });

    await expect(
      executeWorkflowMutation(authority, authorization, {
        action: "createProject",
        title: "Second inferred project",
        projectKey: "project:io-2",
      }),
    ).rejects.toMatchObject({
      code: "invalid-transition",
      message: "Branch 6 v1 supports exactly one inferred workflow project per graph.",
      status: 409,
    });

    await expect(
      executeWorkflowMutation(authority, authorization, {
        action: "createRepository",
        projectId: project.summary.id,
        title: "io-2",
        repositoryKey: "repo:io-2",
        repoRoot: "/tmp/io-2",
        defaultBaseBranch: "main",
      }),
    ).rejects.toMatchObject({
      code: "invalid-transition",
      message: "Branch 6 v1 supports exactly one attached workflow repository per graph.",
      status: 409,
    });
  });

  it("rejects commit activation when the branch has no repository mapping", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const authority = await createWebAppAuthority(
      createInMemoryTestWebAppAuthorityStorage().storage,
    );
    const project = await executeWorkflowMutation(authority, authorization, {
      action: "createProject",
      title: "IO",
      projectKey: "project:io",
    });
    await executeWorkflowMutation(authority, authorization, {
      action: "createRepository",
      projectId: project.summary.id,
      title: "io",
      repositoryKey: "repo:io",
      repoRoot: "/tmp/io",
      defaultBaseBranch: "main",
    });
    const branch = await executeWorkflowMutation(authority, authorization, {
      action: "createBranch",
      projectId: project.summary.id,
      title: "Unmapped branch",
      branchKey: "branch:unmapped",
      goalSummary: "Try to activate without a repository target",
      state: "ready",
    });
    const commit = await executeWorkflowMutation(authority, authorization, {
      action: "createCommit",
      branchId: branch.summary.id,
      title: "Activate me",
      commitKey: "commit:activate-me",
      order: 0,
      state: "ready",
    });

    await expect(
      executeWorkflowMutation(authority, authorization, {
        action: "setCommitState",
        commitId: commit.summary.id,
        state: "active",
      }),
    ).rejects.toMatchObject({
      code: "repository-missing",
      status: 409,
    });
  });

  it("rejects a second active commit on the same branch", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const authority = await createWebAppAuthority(
      createInMemoryTestWebAppAuthorityStorage().storage,
    );
    const fixture = await createWorkflowFixture(authority, authorization);
    const firstCommit = await executeWorkflowMutation(authority, authorization, {
      action: "createCommit",
      branchId: fixture.branchId,
      title: "First commit",
      commitKey: "commit:first",
      order: 0,
      state: "ready",
    });
    const secondCommit = await executeWorkflowMutation(authority, authorization, {
      action: "createCommit",
      branchId: fixture.branchId,
      title: "Second commit",
      commitKey: "commit:second",
      order: 1,
      state: "ready",
    });

    await executeWorkflowMutation(authority, authorization, {
      action: "setCommitState",
      commitId: firstCommit.summary.id,
      state: "active",
    });

    await expect(
      executeWorkflowMutation(authority, authorization, {
        action: "setCommitState",
        commitId: secondCommit.summary.id,
        state: "active",
      }),
    ).rejects.toMatchObject({
      code: "branch-lock-conflict",
      status: 409,
    });
  });

  it("finalizes repository commits and advances the branch", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const authority = await createWebAppAuthority(
      createInMemoryTestWebAppAuthorityStorage().storage,
    );
    const fixture = await createWorkflowFixture(authority, authorization);
    const commit = await executeWorkflowMutation(authority, authorization, {
      action: "createCommit",
      branchId: fixture.branchId,
      title: "Finalize me",
      commitKey: "commit:finalize-me",
      order: 0,
      state: "ready",
    });

    await executeWorkflowMutation(authority, authorization, {
      action: "setCommitState",
      commitId: commit.summary.id,
      state: "active",
    });
    const repositoryCommit = await executeWorkflowMutation(authority, authorization, {
      action: "createRepositoryCommit",
      repositoryId: fixture.repositoryId,
      repositoryBranchId: fixture.repositoryBranchId,
      workflowCommitId: commit.summary.id,
      title: "Finalize me",
      state: "attached",
      worktree: {
        path: "/tmp/io-worktree",
        branchName: "workflow-authority",
      },
    });
    const finalized = await executeWorkflowMutation(authority, authorization, {
      action: "attachCommitResult",
      repositoryCommitId: repositoryCommit.summary.id,
      sha: "abc1234",
    });

    expect(finalized).toMatchObject({
      action: "attachCommitResult",
      created: false,
      summary: {
        entity: "repository-commit",
        id: repositoryCommit.summary.id,
        sha: "abc1234",
        state: "committed",
        workflowCommitId: commit.summary.id,
      },
    });
    expect(authority.graph.workflowCommit.get(commit.summary.id).state).toBe(
      ops.workflowCommitState.values.committed.id,
    );
    expect(authority.graph.workflowBranch.get(fixture.branchId).state).toBe(
      ops.workflowBranchState.values.done.id,
    );
    expect(authority.graph.workflowBranch.get(fixture.branchId).activeCommit).toBeUndefined();
    expect(authority.graph.repositoryCommit.get(repositoryCommit.summary.id).state).toBe(
      ops.repositoryCommitState.values.committed.id,
    );
    expect(
      authority.graph.repositoryCommit.get(repositoryCommit.summary.id).worktree.leaseState,
    ).toBe(ops.repositoryCommitLeaseState.values.released.id);
  });

  it("returns workflow failure codes through the command route", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const authority = await createWebAppAuthority(
      createInMemoryTestWebAppAuthorityStorage().storage,
    );
    const project = await executeWorkflowMutation(authority, authorization, {
      action: "createProject",
      title: "IO",
      projectKey: "project:io",
    });
    await executeWorkflowMutation(authority, authorization, {
      action: "createRepository",
      projectId: project.summary.id,
      title: "io",
      repositoryKey: "repo:io",
      repoRoot: "/tmp/io",
      defaultBaseBranch: "main",
    });
    const branch = await executeWorkflowMutation(authority, authorization, {
      action: "createBranch",
      projectId: project.summary.id,
      title: "Route branch",
      branchKey: "branch:route-branch",
      goalSummary: "Exercise route failures",
      state: "ready",
    });
    const commit = await executeWorkflowMutation(authority, authorization, {
      action: "createCommit",
      branchId: branch.summary.id,
      title: "Route commit",
      commitKey: "commit:route-commit",
      order: 0,
      state: "ready",
    });

    const response = await handleWebCommandRequest(
      new Request("http://web.local/api/commands", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: "workflow-mutation",
          input: {
            action: "setCommitState",
            commitId: commit.summary.id,
            state: "active",
          },
        } satisfies WebAuthorityCommand),
      }),
      authority,
      authorization,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "repository-missing",
      error: `Workflow branch "${branch.summary.id}" does not have a managed repository branch target.`,
    });
  });
  it("passes explicit authorization context through sync and transaction helpers", async () => {
    const authorization = createTestAuthorizationContext({
      principalId: "principal-1",
      principalKind: "human",
      sessionId: "session-1",
    });
    const syncAuthorizations: AuthorizationContext[] = [];
    const transactionAuthorizations: AuthorizationContext[] = [];
    const authority = {
      createSyncPayload(options: WebAppAuthoritySyncOptions) {
        syncAuthorizations.push(options.authorization);
        return {
          mode: "total" as const,
          cursor: "cursor:total",
          snapshot: {
            edges: [],
            retracted: [],
          },
        };
      },
      async applyTransaction(
        _transaction: GraphWriteTransaction,
        options: WebAppAuthorityTransactionOptions,
      ) {
        transactionAuthorizations.push(options.authorization);
        return {
          cursor: "cursor:tx",
          replayed: false,
          txId: "tx:route",
          writeScope: "client-tx" as const,
        };
      },
    } as unknown as WebAppAuthority;

    const syncResponse = handleSyncRequest(
      new Request("http://web.local/api/sync"),
      authority,
      authorization,
    );
    const transactionResponse = await handleTransactionRequest(
      new Request("http://web.local/api/tx", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: "tx:route",
          ops: [],
        }),
      }),
      authority,
      authorization,
    );

    expect(syncResponse.status).toBe(200);
    expect(transactionResponse.status).toBe(200);
    expect(syncAuthorizations).toEqual([authorization]);
    expect(transactionAuthorizations).toEqual([authorization]);
  });

  it("rejects unsupported /api/commands payloads before dispatching the web proof", async () => {
    const authorization = createAuthorityAuthorizationContext();
    const storage = createInMemoryTestWebAppAuthorityStorage();
    const authority = await createWebAppAuthority(storage.storage);
    const before = authority.store.snapshot();

    const response = await handleWebCommandRequest(
      new Request("http://web.local/api/commands", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: "unsupported-web-proof",
        }),
      }),
      authority,
      authorization,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Request body must be a supported /api/commands payload.",
    });
    expect(authority.store.snapshot()).toEqual(before);
  });
});
