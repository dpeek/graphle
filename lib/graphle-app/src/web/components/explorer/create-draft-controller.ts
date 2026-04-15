import { type GraphStore, type AnyTypeOutput } from "@dpeek/graphle-app/graph";
import {
  createEntityDraftController as createGenericEntityDraftController,
  type EntityDraftController,
} from "@dpeek/graphle-react";
import type { MutableRefObject } from "react";

import { typePredicateId } from "./model.js";
import type { EntityCatalogEntry } from "./model.js";

type DraftControllerOptions = {
  entry: EntityCatalogEntry;
  entityEntryByIdRef: MutableRefObject<ReadonlyMap<string, EntityCatalogEntry>>;
  initialInput: Record<string, unknown>;
  store: GraphStore;
  typeById: ReadonlyMap<string, AnyTypeOutput>;
};

export type DraftController = EntityDraftController;

export function createEntityDraftController({
  entry,
  entityEntryByIdRef,
  initialInput,
  store,
  typeById,
}: DraftControllerOptions): DraftController {
  return createGenericEntityDraftController({
    draftSubjectId: `draft:${entry.id}`,
    fieldTree: entry.typeDef.fields as Record<string, unknown>,
    initialInput,
    listEntities(rangeTypeId) {
      const rangeEntry = entityEntryByIdRef.current.get(rangeTypeId);
      return rangeEntry ? rangeEntry.ids.map((id) => rangeEntry.getRef(id)) : [];
    },
    resolveEntity(rangeTypeId, id) {
      if (store.facts(id, typePredicateId, rangeTypeId).length === 0) return undefined;
      const rangeEntry = entityEntryByIdRef.current.get(rangeTypeId);
      return rangeEntry ? rangeEntry.getRef(id) : undefined;
    },
    typeById,
    validate(input) {
      return entry.validateCreate(input as never);
    },
  });
}
