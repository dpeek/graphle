import {
  materializeRetainedDocumentRecord,
  retainedDocumentRecordKinds,
  type LoadedRetainedDocumentState,
  type RetainedDocumentState,
} from "./retained-documents.js";
import type { DurableObjectSqlStorageLike } from "./graph-authority-sql-startup.js";

type SqlRow = Record<string, unknown>;

type RetainedRecordRow = {
  created_at: string;
  deleted_at: string | null;
  materialized_at_cursor: string | null;
  payload_json: string;
  record_id: string;
  record_kind: string;
  updated_at: string;
  version: number;
};

function readAllRows<T extends SqlRow>(cursor: Iterable<T>): T[] {
  return [...cursor];
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

function retainedRecords(
  state: RetainedDocumentState,
): Array<RetainedDocumentState["documents"][number] | RetainedDocumentState["blocks"][number]> {
  return [...state.documents, ...state.blocks];
}

export function bootstrapRetainedRecordTables(sql: DurableObjectSqlStorageLike): void {
  sql.exec(
    `CREATE TABLE IF NOT EXISTS io_retained_record (
      record_kind TEXT NOT NULL,
      record_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      materialized_at_cursor TEXT,
      PRIMARY KEY (record_kind, record_id)
    )`,
  );
  sql.exec(
    `CREATE INDEX IF NOT EXISTS io_retained_record_kind_cursor_idx
    ON io_retained_record (record_kind, materialized_at_cursor)`,
  );
}

export function readRetainedDocumentStateFromSql(
  sql: DurableObjectSqlStorageLike,
): LoadedRetainedDocumentState | null {
  const rows = readAllRows<RetainedRecordRow>(
    sql.exec(
      `SELECT
        record_kind,
        record_id,
        version,
        payload_json,
        created_at,
        updated_at,
        deleted_at,
        materialized_at_cursor
      FROM io_retained_record
      WHERE record_kind IN (?, ?)
        AND deleted_at IS NULL
      ORDER BY record_kind ASC, record_id ASC`,
      ...retainedDocumentRecordKinds,
    ),
  );
  if (rows.length === 0) {
    return null;
  }

  const repairReasons = new Set<LoadedRetainedDocumentState["repairReasons"][number]>();
  const documents: RetainedDocumentState["documents"][number][] = [];
  const blocks: RetainedDocumentState["blocks"][number][] = [];

  for (const row of rows) {
    const materialized = materializeRetainedDocumentRecord({
      payload: JSON.parse(requireString(row.payload_json, "io_retained_record.payload_json")),
      recordId: requireString(row.record_id, "io_retained_record.record_id"),
      recordKind: requireString(row.record_kind, "io_retained_record.record_kind"),
      version: requireInteger(row.version, "io_retained_record.version"),
    });
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

  return {
    repairReasons: [...repairReasons].sort(),
    state: {
      documents,
      blocks,
    },
  };
}

export function replaceRetainedDocumentRows(
  sql: DurableObjectSqlStorageLike,
  retained?: RetainedDocumentState | null,
  materializedAtCursor?: string,
): void {
  sql.exec(
    `DELETE FROM io_retained_record
    WHERE record_kind IN (?, ?)`,
    ...retainedDocumentRecordKinds,
  );
  if (!retained) {
    return;
  }

  const now = new Date().toISOString();
  for (const record of retainedRecords(retained)) {
    sql.exec(
      `INSERT INTO io_retained_record (
        record_kind,
        record_id,
        version,
        payload_json,
        created_at,
        updated_at,
        deleted_at,
        materialized_at_cursor
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
      record.recordKind,
      record.recordId,
      record.version,
      JSON.stringify(record.payload),
      now,
      now,
      materializedAtCursor ?? null,
    );
  }
}
