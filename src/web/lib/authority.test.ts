import { describe, expect, it } from "bun:test";

import {
  bootstrap,
  createStore,
  createTypeClient,
  edgeId,
  type GraphWriteTransaction,
  type StoreSnapshot,
} from "@io/core/graph";
import { core } from "@io/core/graph/modules";
import { ops } from "@io/core/graph/modules/ops";
import { pkm } from "@io/core/graph/modules/pkm";

import { createInMemoryTestWebAppAuthorityStorage } from "./authority-test-storage.js";
import {
  createWebAppAuthority,
  executeAuthorityCommand,
  type WebAppAuthorityCommand,
  type WebAppAuthorityStorage,
} from "./authority.js";
import { handleCommandRequest } from "./server-routes.js";

const productGraph = { ...core, ...pkm, ...ops } as const;
const envVarSecretPredicateId = edgeId(ops.envVar.fields.secret);

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
      executeAuthorityCommand({
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
    const result = await executeAuthorityCommand({
      changed: transaction.ops.length > 0,
      result: {
        description: "Rotated by the authority command",
        entityId: envVarId,
      },
      writeScope: "authority-only",
      async commit(writeScope) {
        await authority.applyTransaction(transaction, { writeScope });
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
    const storage = createInMemoryTestWebAppAuthorityStorage();
    const authority = await createWebAppAuthority(storage.storage);
    const envVarId = authority.graph.envVar.create({
      description: "Primary model credential",
      name: "OPENAI_API_KEY",
    });

    const created = await authority.writeSecretField({
      entityId: envVarId,
      predicateId: envVarSecretPredicateId,
      plaintext: "sk-live-first",
    });
    const createdSecretId = authority.graph.envVar.get(envVarId).secret;
    if (!createdSecretId) throw new Error("Expected created env var secret.");

    expect(created.created).toBe(true);
    expect(created.rotated).toBe(false);
    expect(created.secretVersion).toBe(1);
    expect(JSON.stringify(authority.createSyncPayload())).not.toContain("sk-live-first");
    expect(storage.read()?.secrets?.[createdSecretId]?.value).toBe("sk-live-first");
    expect(
      storage
        .read()
        ?.writeHistory.results.at(-1)
        ?.txId.startsWith(`secret-field:${envVarId}:${envVarSecretPredicateId}:`),
    ).toBe(true);
    expect(storage.read()?.writeHistory.results.at(-1)?.writeScope).toBe("server-command");

    const rotated = await authority.writeSecretField({
      entityId: envVarId,
      predicateId: envVarSecretPredicateId,
      plaintext: "sk-live-second",
    });
    const restarted = await createWebAppAuthority(storage.storage);
    const restartedSecretId = restarted.graph.envVar.get(envVarId).secret;
    if (!restartedSecretId) throw new Error("Expected restarted env var secret.");

    expect(rotated.created).toBe(false);
    expect(rotated.rotated).toBe(true);
    expect(rotated.secretVersion).toBe(2);
    expect(storage.read()?.secrets?.[createdSecretId]?.value).toBe("sk-live-second");
    expect(restartedSecretId).toBe(createdSecretId);
    expect(restarted.graph.secretHandle.get(restartedSecretId)?.version).toBe(2);
    expect(JSON.stringify(restarted.createSyncPayload())).not.toContain("sk-live-second");

    const confirmed = await restarted.writeSecretField({
      entityId: envVarId,
      predicateId: envVarSecretPredicateId,
      plaintext: "sk-live-second",
    });

    expect(confirmed).toMatchObject({
      created: false,
      rotated: false,
      secretId: createdSecretId,
      secretVersion: 2,
    });
  });

  it("rejects ordinary transactions that directly rewrite secret-backed refs", async () => {
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

    await authority.writeSecretField({
      entityId: primaryEnvVarId,
      predicateId: envVarSecretPredicateId,
      plaintext: "sk-live-first",
    });
    await authority.writeSecretField({
      entityId: secondaryEnvVarId,
      predicateId: envVarSecretPredicateId,
      plaintext: "xapp-secret",
    });

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

    await expect(authority.applyTransaction(transaction)).rejects.toThrow(
      'Field "ops:envVar:secret" requires "server-command" writes and cannot be changed through an ordinary transaction.',
    );
    expect(authority.graph.envVar.get(primaryEnvVarId).secret).toBe(primarySecretId);
  });

  it("rolls back staged secret state when a server-command commit fails", async () => {
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

    const created = await authority.writeSecretField({
      entityId: envVarId,
      predicateId: envVarSecretPredicateId,
      plaintext: "sk-live-first",
    });

    failServerCommandCommit = true;

    await expect(
      authority.writeSecretField({
        entityId: envVarId,
        predicateId: envVarSecretPredicateId,
        plaintext: "sk-live-second",
      }),
    ).rejects.toThrow("forced server-command commit failure");

    expect(backingStorage.read()?.secrets?.[created.secretId]?.value).toBe("sk-live-first");
    expect(authority.graph.secretHandle.get(created.secretId)?.version).toBe(1);

    failServerCommandCommit = false;

    const retried = await authority.writeSecretField({
      entityId: envVarId,
      predicateId: envVarSecretPredicateId,
      plaintext: "sk-live-second",
    });

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

  it("executes secret-field writes through the shared authority command envelope", async () => {
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
    } satisfies WebAppAuthorityCommand;

    const result = await authority.executeCommand(command);

    expect(result).toMatchObject({
      created: true,
      entityId: envVarId,
      predicateId: envVarSecretPredicateId,
      rotated: false,
      secretVersion: 1,
    });
    expect(authority.graph.envVar.get(envVarId).secret).toBe(result.secretId);
    expect(storage.read()?.writeHistory.results.at(-1)?.writeScope).toBe("server-command");
    expect(JSON.stringify(authority.createSyncPayload())).not.toContain("sk-live-command");
  });

  it("routes shared authority commands through the web server helper", async () => {
    const storage = createInMemoryTestWebAppAuthorityStorage();
    const authority = await createWebAppAuthority(storage.storage);
    const envVarId = authority.graph.envVar.create({
      description: "Shared command route credential",
      name: "OPENAI_API_KEY",
    });

    const response = await handleCommandRequest(
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
        } satisfies WebAppAuthorityCommand),
      }),
      authority,
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
    expect(JSON.stringify(authority.createSyncPayload())).not.toContain("sk-live-command-route");
  });
});
