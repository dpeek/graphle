import {
  createStore,
  edgeId,
  type GraphStore,
  type GraphStoreSnapshot,
} from "@dpeek/graphle-app/graph";
import type { PersistedAuthoritativeGraphRetainedRecord } from "@dpeek/graphle-authority";
import { createEntityWithId, createGraphClient, type GraphClient } from "@dpeek/graphle-client";
import { type GraphWriteTransaction } from "@dpeek/graphle-kernel";
import { core } from "@dpeek/graphle-module-core";
import { workflow } from "@dpeek/graphle-module-workflow";

import { planRecordedMutation } from "./mutation-planning.js";

const retainedDocumentGraph = { ...core, ...workflow } as const;
const typePredicateId = edgeId(core.node.fields.type);
const documentTypeId = workflow.document.values.id as string;
const documentBlockTypeId = workflow.documentBlock.values.id as string;
const tagTypeId = core.tag.values.id as string;
const documentBlockKindIds = {
  markdown: workflow.documentBlockKind.values.markdown.id,
  entity: workflow.documentBlockKind.values.entity.id,
  "repo-path": workflow.documentBlockKind.values["repo-path"].id,
} as const;

export const retainedDocumentRecordKinds = ["document", "document-block"] as const;
export const retainedDocumentRecordVersion = 1 as const;

export type RetainedDocumentRecordKind = (typeof retainedDocumentRecordKinds)[number];
export type RetainedDocumentBlockKind = keyof typeof documentBlockKindIds;
export type RetainedDocumentRepairReason =
  | "document-record-version-upgraded"
  | "document-block-record-version-upgraded";

export type RetainedDocumentRecord = {
  readonly recordId: string;
  readonly recordKind: "document";
  readonly version: typeof retainedDocumentRecordVersion;
  readonly payload: {
    readonly description?: string;
    readonly isArchived: boolean;
    readonly slug?: string;
    readonly tagIds: readonly string[];
    readonly title: string;
  };
};

export type RetainedDocumentBlockRecord = {
  readonly recordId: string;
  readonly recordKind: "document-block";
  readonly version: typeof retainedDocumentRecordVersion;
  readonly payload: {
    readonly content?: string;
    readonly description?: string;
    readonly documentId: string;
    readonly entityId?: string;
    readonly kind: RetainedDocumentBlockKind;
    readonly order: number;
    readonly path?: string;
    readonly title: string;
  };
};

export type RetainedDocumentState = {
  readonly blocks: readonly RetainedDocumentBlockRecord[];
  readonly documents: readonly RetainedDocumentRecord[];
};

export type LoadedRetainedDocumentState = {
  readonly repairReasons: readonly RetainedDocumentRepairReason[];
  readonly state: RetainedDocumentState;
};

type RetainedDocumentLegacyRecord = {
  readonly recordId: string;
  readonly recordKind: "document";
  readonly version: 0;
  readonly payload: {
    readonly archived?: boolean;
    readonly description?: string;
    readonly slug?: string;
    readonly tagIds?: readonly string[];
    readonly title: string;
  };
};

type RetainedDocumentBlockLegacyRecord = {
  readonly recordId: string;
  readonly recordKind: "document-block";
  readonly version: 0;
  readonly payload: {
    readonly description?: string;
    readonly documentId: string;
    readonly entityId?: string;
    readonly kind: RetainedDocumentBlockKind;
    readonly markdown?: string;
    readonly path?: string;
    readonly repoPath?: string;
    readonly title: string;
    readonly position: number;
  };
};

function compareString(left: string, right: string): number {
  return left.localeCompare(right);
}

function trimOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function hasEntityOfType(store: GraphStore, entityId: string, typeId: string): boolean {
  return store.facts(entityId, typePredicateId, typeId).length > 0;
}

function hasEntity(store: GraphStore, entityId: string): boolean {
  return store.facts(entityId, typePredicateId).length > 0;
}

function readDocumentBlockKind(value: string): RetainedDocumentBlockKind {
  if (value === "markdown" || value === documentBlockKindIds.markdown) {
    return "markdown";
  }
  if (value === "entity" || value === documentBlockKindIds.entity) {
    return "entity";
  }
  if (value === "repo-path" || value === documentBlockKindIds["repo-path"]) {
    return "repo-path";
  }
  throw new Error(`Unsupported retained document block kind "${value}".`);
}

function buildDocumentInput(
  record: RetainedDocumentRecord,
  store: GraphStore,
): GraphClient<typeof retainedDocumentGraph>["document"] extends {
  create(input: infer TInput): string;
}
  ? TInput
  : never {
  return {
    description: record.payload.description,
    isArchived: record.payload.isArchived,
    name: record.payload.title,
    slug: record.payload.slug,
    tags: record.payload.tagIds.filter((tagId) => hasEntityOfType(store, tagId, tagTypeId)),
  };
}

function buildDocumentBlockInput(
  record: RetainedDocumentBlockRecord,
  store: GraphStore,
): GraphClient<typeof retainedDocumentGraph>["documentBlock"] extends {
  create(input: infer TInput): string;
}
  ? TInput
  : never {
  if (!hasEntityOfType(store, record.payload.documentId, documentTypeId)) {
    throw new Error(
      `Retained document block "${record.recordId}" references missing document "${record.payload.documentId}".`,
    );
  }

  return {
    content: record.payload.kind === "markdown" ? record.payload.content : undefined,
    description: record.payload.description,
    document: record.payload.documentId,
    entity:
      record.payload.kind === "entity" &&
      record.payload.entityId &&
      hasEntity(store, record.payload.entityId)
        ? record.payload.entityId
        : undefined,
    kind: documentBlockKindIds[record.payload.kind],
    name: record.payload.title,
    order: record.payload.order,
    path: record.payload.kind === "repo-path" ? record.payload.path : undefined,
  };
}

function createDocumentRecord(
  document: ReturnType<GraphClient<typeof retainedDocumentGraph>["document"]["get"]>,
): RetainedDocumentRecord {
  return {
    recordId: document.id,
    recordKind: "document",
    version: retainedDocumentRecordVersion,
    payload: {
      description: trimOptionalString(document.description),
      isArchived: document.isArchived,
      slug: trimOptionalString(document.slug),
      tagIds: [...document.tags].sort(compareString),
      title: document.name,
    },
  };
}

function createDocumentBlockRecord(
  block: ReturnType<GraphClient<typeof retainedDocumentGraph>["documentBlock"]["get"]>,
): RetainedDocumentBlockRecord {
  return {
    recordId: block.id,
    recordKind: "document-block",
    version: retainedDocumentRecordVersion,
    payload: {
      content: trimOptionalString(block.content),
      description: trimOptionalString(block.description),
      documentId: block.document,
      entityId: trimOptionalString(block.entity),
      kind: readDocumentBlockKind(block.kind),
      order: block.order,
      path: trimOptionalString(block.path),
      title: block.name,
    },
  };
}

function normalizeStringArray(value: unknown, label: string): readonly string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Expected "${label}" to be an array.`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`Expected "${label}[${index}]" to be a string.`);
    }
    return entry;
  });
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Expected "${label}" to be a boolean.`);
  }
  return value;
}

function requireInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Expected "${label}" to be an integer.`);
  }
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected "${label}" to be a string.`);
  }
  return value;
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return requireString(value, label);
}

export function createRetainedDocumentState(snapshot: GraphStoreSnapshot): RetainedDocumentState {
  const graph = createGraphClient(createStore(snapshot), retainedDocumentGraph);

  return {
    documents: graph.document
      .list()
      .map(createDocumentRecord)
      .sort((left, right) => compareString(left.recordId, right.recordId)),
    blocks: graph.documentBlock
      .list()
      .map(createDocumentBlockRecord)
      .sort(
        (left, right) =>
          compareString(left.payload.documentId, right.payload.documentId) ||
          left.payload.order - right.payload.order ||
          compareString(left.recordId, right.recordId),
      ),
  };
}

export function hasRetainedDocumentState(state: RetainedDocumentState): boolean {
  return state.documents.length > 0 || state.blocks.length > 0;
}

export function createPersistedRetainedDocumentRecords(
  state: RetainedDocumentState,
): readonly PersistedAuthoritativeGraphRetainedRecord[] {
  return [...state.documents, ...state.blocks].map((record) => ({
    recordKind: record.recordKind,
    recordId: record.recordId,
    version: record.version,
    payload: structuredClone(record.payload),
  }));
}

export function sameRetainedDocumentState(
  left: RetainedDocumentState,
  right: RetainedDocumentState,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function materializeRetainedDocumentRecord(input: {
  readonly payload: unknown;
  readonly recordId: string;
  readonly recordKind: string;
  readonly version: number;
}): {
  readonly record: RetainedDocumentBlockRecord | RetainedDocumentRecord;
  readonly repairReason?: RetainedDocumentRepairReason;
} | null {
  if (input.recordKind === "document") {
    if (input.version === retainedDocumentRecordVersion) {
      const payload = (input.payload ?? {}) as Record<string, unknown>;
      return {
        record: {
          recordId: input.recordId,
          recordKind: "document",
          version: retainedDocumentRecordVersion,
          payload: {
            description: readOptionalString(payload.description, `${input.recordId}.description`),
            isArchived: requireBoolean(payload.isArchived, `${input.recordId}.isArchived`),
            slug: readOptionalString(payload.slug, `${input.recordId}.slug`),
            tagIds: normalizeStringArray(payload.tagIds, `${input.recordId}.tagIds`)
              .slice()
              .sort(compareString),
            title: requireString(payload.title, `${input.recordId}.title`),
          },
        },
      };
    }

    if (input.version === 0) {
      const payload = (input.payload ?? {}) as RetainedDocumentLegacyRecord["payload"];
      return {
        record: {
          recordId: input.recordId,
          recordKind: "document",
          version: retainedDocumentRecordVersion,
          payload: {
            description: trimOptionalString(
              readOptionalString(payload.description, `${input.recordId}.description`),
            ),
            isArchived: payload.archived ?? false,
            slug: trimOptionalString(readOptionalString(payload.slug, `${input.recordId}.slug`)),
            tagIds: normalizeStringArray(payload.tagIds, `${input.recordId}.tagIds`)
              .slice()
              .sort(compareString),
            title: requireString(payload.title, `${input.recordId}.title`),
          },
        },
        repairReason: "document-record-version-upgraded",
      };
    }

    throw new Error(
      `Unsupported retained document record version "${input.version}" for "${input.recordId}".`,
    );
  }

  if (input.recordKind === "document-block") {
    if (input.version === retainedDocumentRecordVersion) {
      const payload = (input.payload ?? {}) as Record<string, unknown>;
      return {
        record: {
          recordId: input.recordId,
          recordKind: "document-block",
          version: retainedDocumentRecordVersion,
          payload: {
            content: trimOptionalString(
              readOptionalString(payload.content, `${input.recordId}.content`),
            ),
            description: trimOptionalString(
              readOptionalString(payload.description, `${input.recordId}.description`),
            ),
            documentId: requireString(payload.documentId, `${input.recordId}.documentId`),
            entityId: trimOptionalString(
              readOptionalString(payload.entityId, `${input.recordId}.entityId`),
            ),
            kind: readDocumentBlockKind(requireString(payload.kind, `${input.recordId}.kind`)),
            order: requireInteger(payload.order, `${input.recordId}.order`),
            path: trimOptionalString(readOptionalString(payload.path, `${input.recordId}.path`)),
            title: requireString(payload.title, `${input.recordId}.title`),
          },
        },
      };
    }

    if (input.version === 0) {
      const payload = (input.payload ?? {}) as RetainedDocumentBlockLegacyRecord["payload"];
      return {
        record: {
          recordId: input.recordId,
          recordKind: "document-block",
          version: retainedDocumentRecordVersion,
          payload: {
            content: trimOptionalString(
              readOptionalString(payload.markdown, `${input.recordId}.markdown`),
            ),
            description: trimOptionalString(
              readOptionalString(payload.description, `${input.recordId}.description`),
            ),
            documentId: requireString(payload.documentId, `${input.recordId}.documentId`),
            entityId: trimOptionalString(
              readOptionalString(payload.entityId, `${input.recordId}.entityId`),
            ),
            kind: readDocumentBlockKind(requireString(payload.kind, `${input.recordId}.kind`)),
            order: requireInteger(payload.position, `${input.recordId}.position`),
            path: trimOptionalString(
              readOptionalString(payload.path ?? payload.repoPath, `${input.recordId}.repoPath`),
            ),
            title: requireString(payload.title, `${input.recordId}.title`),
          },
        },
        repairReason: "document-block-record-version-upgraded",
      };
    }

    throw new Error(
      `Unsupported retained document block record version "${input.version}" for "${input.recordId}".`,
    );
  }

  return null;
}

export function loadRetainedDocumentStateFromPersistedRecords(
  records: readonly PersistedAuthoritativeGraphRetainedRecord[],
): LoadedRetainedDocumentState | null {
  if (records.length === 0) {
    return null;
  }

  const repairReasons = new Set<LoadedRetainedDocumentState["repairReasons"][number]>();
  const documents: RetainedDocumentState["documents"][number][] = [];
  const blocks: RetainedDocumentState["blocks"][number][] = [];

  for (const record of records) {
    const materialized = materializeRetainedDocumentRecord(record);
    if (!materialized) {
      continue;
    }
    if (materialized.repairReason) {
      repairReasons.add(materialized.repairReason);
    }
    if (materialized.record.recordKind === "document") {
      documents.push(materialized.record);
      continue;
    }
    blocks.push(materialized.record);
  }

  if (documents.length === 0 && blocks.length === 0) {
    return null;
  }

  return {
    repairReasons: [...repairReasons].sort(),
    state: {
      documents,
      blocks,
    },
  };
}

export function planRetainedDocumentRecovery(
  snapshot: GraphStoreSnapshot,
  retained: RetainedDocumentState,
  txId: string,
): {
  readonly changed: boolean;
  readonly transaction: GraphWriteTransaction;
} {
  const planned = planRecordedMutation(snapshot, retainedDocumentGraph, txId, (graph, store) => {
    for (const record of retained.documents) {
      const input = buildDocumentInput(record, store);
      if (hasEntityOfType(store, record.recordId, documentTypeId)) {
        graph.document.update(record.recordId, input);
        continue;
      }
      createEntityWithId(store, retainedDocumentGraph, workflow.document, record.recordId, input);
    }

    for (const record of retained.blocks) {
      const input = buildDocumentBlockInput(record, store);
      if (hasEntityOfType(store, record.recordId, documentBlockTypeId)) {
        graph.documentBlock.update(record.recordId, input);
        continue;
      }
      createEntityWithId(
        store,
        retainedDocumentGraph,
        workflow.documentBlock,
        record.recordId,
        input,
      );
    }
  });

  return {
    changed: planned.changed,
    transaction: planned.transaction,
  };
}
