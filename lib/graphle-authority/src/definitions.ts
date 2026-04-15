import {
  edgeId,
  type AnyTypeOutput,
  type EdgeOutput,
  type EntityTypeOutput,
} from "@dpeek/graphle-kernel";

type AuthoritativeCoreNode = EntityTypeOutput & {
  readonly fields: {
    readonly type: EdgeOutput;
  };
};

function isEntityTypeWithNodeTypeField(value: unknown): value is AuthoritativeCoreNode {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AuthoritativeCoreNode>;
  return (
    candidate.kind === "entity" &&
    typeof candidate.fields?.type === "object" &&
    candidate.fields.type !== null &&
    typeof candidate.fields.type.key === "string"
  );
}

export function resolveAuthoritativeDefinitions<
  const TNamespace extends Record<string, AnyTypeOutput>,
  const TDefinitions extends Record<string, AnyTypeOutput> = TNamespace,
>(namespace: TNamespace, definitions?: TDefinitions): TDefinitions {
  return (definitions ?? (namespace as unknown as TDefinitions)) as TDefinitions;
}

export function readAuthoritativeNodeTypePredicateId(
  definitions: Record<string, AnyTypeOutput>,
): string {
  const node = definitions.node;
  if (!isEntityTypeWithNodeTypeField(node)) {
    throw new Error(
      'Authoritative graph definitions must include the built-in core "node.type" predicate. Pass definitions that already include `core`.',
    );
  }

  return edgeId(node.fields.type);
}
