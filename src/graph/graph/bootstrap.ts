import { core } from "./core.js";
import {
  edgeId,
  fieldTreeId,
  fieldTreeKey,
  isEntityType,
  isEnumType,
  isFieldsOutput,
  typeId,
} from "./schema.js";
import type { AnyTypeOutput, EdgeOutput, FieldsOutput } from "./schema.js";
import type { Store } from "./store.js";

type SchemaTree = FieldsOutput;

function isPredicateDef(value: unknown): value is EdgeOutput {
  const candidate = value as Partial<EdgeOutput>;
  return typeof candidate.key === "string" && typeof candidate.range === "string";
}

function isTreeNode(value: unknown): value is SchemaTree {
  return isFieldsOutput(value);
}

function collectPredicates(tree: SchemaTree): EdgeOutput[] {
  const out: EdgeOutput[] = [];
  function walk(node: SchemaTree): void {
    for (const [_name, value] of Object.entries(node)) {
      if (isPredicateDef(value)) {
        out.push(value);
        continue;
      }
      if (isTreeNode(value)) walk(value as SchemaTree);
    }
  }
  walk(tree);
  return out;
}

function collectShapeNodes(tree: SchemaTree): Array<{ id: string; key: string }> {
  const out: Array<{ id: string; key: string }> = [];
  function walk(node: SchemaTree): void {
    out.push({ id: fieldTreeId(node), key: fieldTreeKey(node) });
    for (const [_name, value] of Object.entries(node)) {
      if (isTreeNode(value)) walk(value as SchemaTree);
    }
  }
  walk(tree);
  return out;
}

function assertCurrentFactOnce(
  store: Store,
  subjectId: string,
  predicateId: string,
  objectId: string,
): void {
  if (store.facts(subjectId, predicateId, objectId).length > 0) return;
  store.assert(subjectId, predicateId, objectId);
}

export function bootstrap(store: Store, types: Record<string, AnyTypeOutput> = core): void {
  const entities = Object.values(types).filter(isEntityType);
  const enums = Object.values(types).filter(isEnumType);
  const allPredicates = entities.flatMap((typeDef) => collectPredicates(typeDef.fields));
  const allShapes = entities.flatMap((typeDef) => collectShapeNodes(typeDef.fields));
  const keyPredicateId = edgeId(core.predicate.fields.key);
  const namePredicateId = edgeId(core.node.fields.name);
  const descriptionPredicateId = edgeId(core.node.fields.description);
  const rangePredicateId = edgeId(core.predicate.fields.range);
  const cardinalityPredicateId = edgeId(core.predicate.fields.cardinality);
  const enumMemberPredicateId = edgeId(core.enum.fields.member);
  const nodeTypePredicateId = edgeId(core.node.fields.type);
  const schemaTypeId = typeId(core.type);
  const predicateTypeId = typeId(core.predicate);
  const cardinalityValueByLiteral: Record<string, string> = {
    one: core.cardinality.values.one.id,
    "one?": core.cardinality.values.oneOptional.id,
    many: core.cardinality.values.many.id,
  };

  for (const typeDef of Object.values(types)) {
    const subjectId = typeId(typeDef);
    assertCurrentFactOnce(store, subjectId, keyPredicateId, typeDef.values.key);
    if (typeDef.values.name) {
      assertCurrentFactOnce(store, subjectId, namePredicateId, typeDef.values.name);
    }
    assertCurrentFactOnce(store, subjectId, nodeTypePredicateId, schemaTypeId);
  }

  for (const shape of allShapes) {
    assertCurrentFactOnce(store, shape.id, keyPredicateId, shape.key);
  }

  for (const predicateDef of allPredicates) {
    const predicateId = edgeId(predicateDef);
    assertCurrentFactOnce(store, predicateId, keyPredicateId, predicateDef.key);
    assertCurrentFactOnce(store, predicateId, namePredicateId, predicateDef.key);
    assertCurrentFactOnce(store, predicateId, rangePredicateId, predicateDef.range);
    const cardinalityValueId = cardinalityValueByLiteral[predicateDef.cardinality];
    if (!cardinalityValueId) {
      throw new Error(
        `Unknown cardinality "${predicateDef.cardinality}" for "${predicateDef.key}"`,
      );
    }
    assertCurrentFactOnce(store, predicateId, cardinalityPredicateId, cardinalityValueId);
    assertCurrentFactOnce(store, predicateId, nodeTypePredicateId, predicateTypeId);
  }

  for (const enumDef of enums) {
    const enumId = typeId(enumDef);
    for (const option of Object.values(enumDef.options)) {
      const optionId = option.id ?? option.key;
      assertCurrentFactOnce(store, optionId, keyPredicateId, option.key);
      if (option.name) assertCurrentFactOnce(store, optionId, namePredicateId, option.name);
      if (option.description) {
        assertCurrentFactOnce(store, optionId, descriptionPredicateId, option.description);
      }
      assertCurrentFactOnce(store, optionId, nodeTypePredicateId, schemaTypeId);
      assertCurrentFactOnce(store, enumId, enumMemberPredicateId, optionId);
    }
  }
}
