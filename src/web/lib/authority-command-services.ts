import {
  isSecretBackedField,
  type AnyTypeOutput,
  type AuthorizationContext,
  type AuthoritativeGraphWriteResult,
  type AuthoritativeWriteScope,
  type GraphWriteTransaction,
  type NamespaceClient,
  type PolicyError,
  type Store,
} from "@io/core/graph";

import {
  buildWriteSecretFieldCommandTargets,
  createWriteSecretFieldCommandPolicy,
  evaluateCommandAuthorization,
} from "./authority-authorization-services.js";
import type { CompiledFieldDefinition } from "./authority-compiled-fields.js";
import type {
  WebAppAuthorityCommand,
  WebAppAuthorityCommandResult,
  WebAppAuthoritySecretWrite,
} from "./authority.js";
import {
  buildSecretHandleName,
  secretFieldEntityIdRequiredMessage,
  secretFieldPlaintextRequiredMessage,
  secretFieldPredicateIdRequiredMessage,
  type WriteSecretFieldInput,
  type WriteSecretFieldResult,
} from "./secret-fields.js";
import { runWorkflowMutationCommand } from "./workflow-authority.js";

type SecretValuesRef = {
  current: Map<string, string>;
};

type PendingSecretWriteRef = {
  current: WebAppAuthoritySecretWrite | null;
};

type WebAuthorityMutationRollback = () => void;
type WebAuthorityMutationStageContext = {
  addRollback(rollback: WebAuthorityMutationRollback): void;
};

type SecretHandleMutationGraph = NamespaceClient<Record<string, AnyTypeOutput>> & {
  readonly secretHandle: {
    create(values: {
      readonly name: string;
      readonly version: number;
      readonly lastRotatedAt: Date;
    }): string;
    get(id: string): { readonly version?: number } | undefined;
    update(
      id: string,
      values: {
        readonly name?: string;
        readonly version?: number;
        readonly lastRotatedAt?: Date;
      },
    ): void;
  };
};

export function trimOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed?.length ? trimmed : undefined;
}

function runWebAuthorityMutationRollbacks(
  rollbacks: readonly WebAuthorityMutationRollback[],
): void {
  const rollbackErrors: unknown[] = [];
  for (let index = rollbacks.length - 1; index >= 0; index -= 1) {
    const rollback = rollbacks[index];
    if (!rollback) continue;
    try {
      rollback();
    } catch (error) {
      rollbackErrors.push(error);
    }
  }

  if (rollbackErrors.length === 1) {
    throw rollbackErrors[0];
  }
  if (rollbackErrors.length > 1) {
    throw new AggregateError(rollbackErrors, "Web authority mutation rollback failed.");
  }
}

/**
 * Applies a staged web authority mutation and unwinds any authority-local side
 * effects if the authoritative commit fails.
 */
export async function applyStagedWebAuthorityMutation<TResult>(input: {
  readonly changed: boolean;
  readonly result: TResult;
  readonly writeScope: AuthoritativeWriteScope;
  readonly commit: (writeScope: AuthoritativeWriteScope) => Promise<void>;
  readonly stage?: (result: TResult, context: WebAuthorityMutationStageContext) => void;
}): Promise<TResult> {
  if (!input.changed) return input.result;

  const rollbacks: WebAuthorityMutationRollback[] = [];
  try {
    input.stage?.(input.result, {
      addRollback(rollback) {
        rollbacks.push(rollback);
      },
    });
    await input.commit(input.writeScope);
  } catch (error) {
    try {
      runWebAuthorityMutationRollbacks(rollbacks);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Web authority mutation failed and rollback did not complete.",
      );
    }
    throw error;
  }

  return input.result;
}

export function createWebAuthorityCommandServices(input: {
  readonly applyStagedMutation: <TResult>(staged: {
    readonly changed: boolean;
    readonly result: TResult;
    readonly writeScope: AuthoritativeWriteScope;
    readonly commit: (writeScope: AuthoritativeWriteScope) => Promise<void>;
    readonly stage?: (
      result: TResult,
      context: {
        addRollback(rollback: () => void): void;
      },
    ) => void;
  }) => Promise<TResult>;
  readonly applyTransaction: (
    transaction: GraphWriteTransaction,
    options: {
      readonly authorization: AuthorizationContext;
      readonly writeScope?: "authority-only" | "client-tx" | "server-command";
    },
  ) => Promise<AuthoritativeGraphWriteResult>;
  readonly authorityStore: Store;
  readonly buildMutation: <TResult>(
    txId: string,
    mutate: (graph: SecretHandleMutationGraph, store: Store) => TResult,
  ) => {
    readonly changed: boolean;
    readonly result: TResult;
    readonly transaction: GraphWriteTransaction;
  };
  readonly compiledFieldIndex: ReadonlyMap<string, CompiledFieldDefinition>;
  readonly createCommandPolicyError: (error: PolicyError) => Error;
  readonly createMutationError: (status: number, message: string) => Error;
  readonly getEntityLabel: (store: Store, entityId: string) => string;
  readonly getFirstObject: (
    store: Store,
    subjectId: string,
    predicateId: string,
  ) => string | undefined;
  readonly pendingSecretWriteRef: PendingSecretWriteRef;
  readonly secretHandleLastRotatedAtPredicateId: string;
  readonly secretHandleVersionPredicateId: string;
  readonly secretValuesRef: SecretValuesRef;
  readonly setSingleReferenceField: (
    store: Store,
    subjectId: string,
    predicateId: string,
    objectId: string,
  ) => void;
  readonly typePredicateId: string;
  readonly writeSecretFieldCommandBasePredicateIds: readonly string[];
  readonly writeSecretFieldCommandKey: string;
}) {
  async function runWriteSecretFieldCommand(
    inputCommand: WriteSecretFieldInput,
    options: { readonly authorization: AuthorizationContext },
  ): Promise<WriteSecretFieldResult> {
    const entityId = trimOptionalString(inputCommand.entityId);
    const predicateId = trimOptionalString(inputCommand.predicateId);
    const plaintext = trimOptionalString(inputCommand.plaintext);

    if (!entityId) {
      throw input.createMutationError(400, secretFieldEntityIdRequiredMessage);
    }
    if (!predicateId) {
      throw input.createMutationError(400, secretFieldPredicateIdRequiredMessage);
    }
    if (!plaintext) {
      throw input.createMutationError(400, secretFieldPlaintextRequiredMessage);
    }

    const fieldDefinition = input.compiledFieldIndex.get(predicateId);
    if (!fieldDefinition) {
      throw input.createMutationError(404, `Predicate "${predicateId}" was not found.`);
    }
    if (!isSecretBackedField(fieldDefinition.field)) {
      throw input.createMutationError(
        400,
        `Predicate "${predicateId}" is not a secret-backed field.`,
      );
    }
    if (fieldDefinition.field.cardinality === "many") {
      throw input.createMutationError(
        400,
        `Secret-backed field "${fieldDefinition.pathLabel}" does not support multi-value writes.`,
      );
    }

    const entityTypeIds = input.authorityStore
      .facts(entityId, input.typePredicateId)
      .map((edge) => edge.o);
    if (entityTypeIds.length === 0) {
      throw input.createMutationError(404, `Entity "${entityId}" was not found.`);
    }
    if (!entityTypeIds.some((typeId) => fieldDefinition.ownerTypeIds.has(typeId))) {
      throw input.createMutationError(
        400,
        `Predicate "${predicateId}" is not defined on entity "${entityId}".`,
      );
    }

    const existingSecretId = input.getFirstObject(input.authorityStore, entityId, predicateId);
    const rotated =
      existingSecretId !== undefined &&
      input.secretValuesRef.current.get(existingSecretId) !== plaintext;
    const secretName = buildSecretHandleName(
      input.getEntityLabel(input.authorityStore, entityId),
      fieldDefinition.fieldLabel,
    );

    const planned = input.buildMutation(
      `secret-field:${entityId}:${predicateId}:${Date.now()}`,
      (mutationGraph, mutationStore) => {
        let secretId = existingSecretId;
        let secretVersion = secretId ? (mutationGraph.secretHandle.get(secretId)?.version ?? 0) : 0;

        if (!secretId) {
          const createdSecretId = mutationGraph.secretHandle.create({
            name: secretName,
            version: 1,
            lastRotatedAt: new Date(),
          });
          secretId = createdSecretId;
          input.setSingleReferenceField(mutationStore, entityId, predicateId, secretId);
          secretVersion = 1;
        } else if (rotated) {
          secretVersion = (mutationGraph.secretHandle.get(secretId)?.version ?? 0) + 1;
          mutationGraph.secretHandle.update(secretId, {
            name: secretName,
            version: secretVersion,
            lastRotatedAt: new Date(),
          });
          input.setSingleReferenceField(mutationStore, entityId, predicateId, secretId);
        } else {
          mutationGraph.secretHandle.update(secretId, {
            name: secretName,
          });
          input.setSingleReferenceField(mutationStore, entityId, predicateId, secretId);
          secretVersion = mutationGraph.secretHandle.get(secretId)?.version ?? secretVersion;
        }
        if (!secretId) {
          throw new Error("Secret command planning must resolve a secret handle id.");
        }

        return {
          created: existingSecretId === undefined,
          entityId,
          predicateId,
          rotated,
          secretId,
          secretVersion,
        } satisfies WriteSecretFieldResult;
      },
    );

    const commandAuthorization = evaluateCommandAuthorization({
      authorization: options.authorization,
      store: input.authorityStore,
      commandKey: input.writeSecretFieldCommandKey,
      commandPolicy: createWriteSecretFieldCommandPolicy(
        predicateId,
        input.writeSecretFieldCommandBasePredicateIds,
      ),
      touchedPredicates: buildWriteSecretFieldCommandTargets(
        {
          entityId,
          predicateId,
          secretId: planned.result.secretId,
        },
        input.compiledFieldIndex,
        input.secretHandleVersionPredicateId,
        input.secretHandleLastRotatedAtPredicateId,
      ),
      writeScope: "server-command",
    });
    if (commandAuthorization.error) {
      throw input.createCommandPolicyError(commandAuthorization.error);
    }

    return input.applyStagedMutation({
      changed: planned.changed,
      result: planned.result,
      writeScope: "server-command",
      async commit(writeScope) {
        await input.applyTransaction(planned.transaction, {
          authorization: options.authorization,
          writeScope,
        });
      },
      stage(result, context) {
        const previousSecretValues = input.secretValuesRef.current;
        context.addRollback(() => {
          input.secretValuesRef.current = previousSecretValues;
          input.pendingSecretWriteRef.current = null;
        });

        const nextSecretValues = new Map(previousSecretValues);
        nextSecretValues.set(result.secretId, plaintext);
        input.secretValuesRef.current = nextSecretValues;
        input.pendingSecretWriteRef.current = {
          secretId: result.secretId,
          value: plaintext,
          version: result.secretVersion,
        };
      },
    });
  }

  async function executeCommand<Command extends WebAppAuthorityCommand>(
    command: Command,
    options: { readonly authorization: AuthorizationContext },
  ): Promise<WebAppAuthorityCommandResult<Command["kind"]>> {
    if (command.kind === "write-secret-field") {
      return runWriteSecretFieldCommand(command.input, options) as Promise<
        WebAppAuthorityCommandResult<Command["kind"]>
      >;
    }
    if (command.kind === "workflow-mutation") {
      return runWorkflowMutationCommand(
        command.input,
        {
          store: input.authorityStore,
          applyTransaction: input.applyTransaction,
        },
        options,
      ) as Promise<WebAppAuthorityCommandResult<Command["kind"]>>;
    }
    throw new Error("Unsupported web authority command.");
  }

  return {
    executeCommand,
    runWriteSecretFieldCommand,
  };
}
