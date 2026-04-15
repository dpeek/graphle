import type { PersistedAuthoritativeGraphRetainedRecord } from "@dpeek/graphle-authority";

import {
  createPersistedRetainedDocumentRecords,
  loadRetainedDocumentStateFromPersistedRecords,
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

export function readPersistedRetainedRecordsFromSql(
  sql: DurableObjectSqlStorageLike,
  options: {
    readonly includeDeleted?: boolean;
    readonly recordKinds?: readonly string[];
  } = {},
): readonly PersistedAuthoritativeGraphRetainedRecord[] {
  const filters: string[] = [];
  const bindings: unknown[] = [];

  if (options.recordKinds && options.recordKinds.length > 0) {
    filters.push(`record_kind IN (${options.recordKinds.map(() => "?").join(", ")})`);
    bindings.push(...options.recordKinds);
  }
  if (options.includeDeleted !== true) {
    filters.push("deleted_at IS NULL");
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
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
      ${whereClause}
      ORDER BY record_kind ASC, record_id ASC`,
      ...bindings,
    ),
  );

  return rows.map((row) => ({
    recordKind: requireString(row.record_kind, "io_retained_record.record_kind"),
    recordId: requireString(row.record_id, "io_retained_record.record_id"),
    version: requireInteger(row.version, "io_retained_record.version"),
    payload: JSON.parse(requireString(row.payload_json, "io_retained_record.payload_json")),
  }));
}

export function readRetainedDocumentStateFromSql(
  sql: DurableObjectSqlStorageLike,
): LoadedRetainedDocumentState | null {
  return loadRetainedDocumentStateFromPersistedRecords(
    readPersistedRetainedRecordsFromSql(sql, {
      recordKinds: retainedDocumentRecordKinds,
    }),
  );
}

function replaceRetainedRecordRows(
  sql: DurableObjectSqlStorageLike,
  input: {
    readonly materializedAtCursor?: string;
    readonly recordKinds?: readonly string[];
    readonly records: readonly PersistedAuthoritativeGraphRetainedRecord[];
  },
): void {
  if (input.recordKinds && input.recordKinds.length > 0) {
    sql.exec(
      `DELETE FROM io_retained_record
      WHERE record_kind IN (${input.recordKinds.map(() => "?").join(", ")})`,
      ...input.recordKinds,
    );
  } else {
    sql.exec("DELETE FROM io_retained_record");
  }
  if (input.records.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  for (const record of input.records) {
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
      input.materializedAtCursor ?? null,
    );
  }
}

export function replacePersistedRetainedRecordRows(
  sql: DurableObjectSqlStorageLike,
  records: readonly PersistedAuthoritativeGraphRetainedRecord[],
  materializedAtCursor?: string,
): void {
  replaceRetainedRecordRows(sql, {
    records,
    materializedAtCursor,
  });
}

export function replaceRetainedDocumentRows(
  sql: DurableObjectSqlStorageLike,
  retained?: RetainedDocumentState | null,
  materializedAtCursor?: string,
): void {
  replaceRetainedRecordRows(sql, {
    recordKinds: retainedDocumentRecordKinds,
    records: retained ? createPersistedRetainedDocumentRecords(retained) : [],
    materializedAtCursor,
  });
}
