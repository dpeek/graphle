import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";

import type { DurableObjectSqlStorageLike } from "./graph-authority-sql-startup.js";
import {
  bootstrapRetainedRecordTables,
  readRetainedDocumentStateFromSql,
  replaceRetainedDocumentRows,
} from "./graph-authority-sql-retained-records.js";
import type { RetainedDocumentState } from "./retained-documents.js";

function createSqlStorage(): { db: Database; sql: DurableObjectSqlStorageLike } {
  const db = new Database(":memory:");
  return {
    db,
    sql: {
      exec<T extends Record<string, unknown>>(query: string, ...bindings: unknown[]) {
        const statement = db.query(query);
        const trimmed = query.trimStart();
        if (/^(SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(trimmed)) {
          return statement.all(
            ...(bindings as never as Parameters<typeof statement.all>),
          ) as Iterable<T>;
        }
        statement.run(...(bindings as never as Parameters<typeof statement.run>));
        return [] as T[];
      },
    },
  };
}

function queryAll<T extends Record<string, unknown>>(
  db: Database,
  query: string,
  ...bindings: unknown[]
): T[] {
  const statement = db.query(query);
  return statement.all(...(bindings as never as Parameters<typeof statement.all>)) as T[];
}

function createRetainedDocumentState(): RetainedDocumentState {
  return {
    documents: [
      {
        recordId: "document:1",
        recordKind: "document",
        version: 1,
        payload: {
          title: "Workflow Goal",
          description: "Hydrate durable document memory from retained rows.",
          slug: "workflow-goal",
          isArchived: false,
          tagIds: ["tag:docs", "tag:workflow"],
        },
      },
    ],
    blocks: [
      {
        recordId: "document-block:1",
        recordKind: "document-block",
        version: 1,
        payload: {
          title: "Overview",
          description: "Current block head.",
          documentId: "document:1",
          order: 0,
          kind: "markdown",
          content: "Retained markdown body.",
        },
      },
    ],
  };
}

describe("graph-authority-sql-retained-records", () => {
  it("replaces and reloads retained document rows", () => {
    const { db, sql } = createSqlStorage();
    bootstrapRetainedRecordTables(sql);

    replaceRetainedDocumentRows(sql, createRetainedDocumentState(), "web-authority:1:5");

    expect(readRetainedDocumentStateFromSql(sql)).toEqual({
      repairReasons: [],
      state: createRetainedDocumentState(),
    });
    expect(
      queryAll<{ record_kind: string; materialized_at_cursor: string | null }>(
        db,
        `SELECT record_kind, materialized_at_cursor
        FROM io_retained_record
        ORDER BY record_kind ASC, record_id ASC`,
      ),
    ).toEqual([
      {
        record_kind: "document",
        materialized_at_cursor: "web-authority:1:5",
      },
      {
        record_kind: "document-block",
        materialized_at_cursor: "web-authority:1:5",
      },
    ]);
  });

  it("upgrades legacy retained payload versions on load", () => {
    const { db, sql } = createSqlStorage();
    bootstrapRetainedRecordTables(sql);

    db.query(
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
    ).run(
      "document",
      "document:legacy",
      0,
      JSON.stringify({
        title: "Legacy Goal",
        description: "Legacy document payload.",
        slug: "legacy-goal",
        archived: true,
        tagIds: ["tag:legacy"],
      }),
      "2026-03-30T00:00:00.000Z",
      "2026-03-30T00:00:00.000Z",
      "web-authority:1:7",
    );
    db.query(
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
    ).run(
      "document-block",
      "document-block:legacy",
      0,
      JSON.stringify({
        title: "Legacy Block",
        description: "Legacy block payload.",
        documentId: "document:legacy",
        position: 2,
        kind: "repo-path",
        repoPath: "doc/legacy.md",
      }),
      "2026-03-30T00:00:00.000Z",
      "2026-03-30T00:00:00.000Z",
      "web-authority:1:7",
    );

    expect(readRetainedDocumentStateFromSql(sql)).toEqual({
      repairReasons: ["document-block-record-version-upgraded", "document-record-version-upgraded"],
      state: {
        documents: [
          {
            recordId: "document:legacy",
            recordKind: "document",
            version: 1,
            payload: {
              title: "Legacy Goal",
              description: "Legacy document payload.",
              slug: "legacy-goal",
              isArchived: true,
              tagIds: ["tag:legacy"],
            },
          },
        ],
        blocks: [
          {
            recordId: "document-block:legacy",
            recordKind: "document-block",
            version: 1,
            payload: {
              title: "Legacy Block",
              description: "Legacy block payload.",
              documentId: "document:legacy",
              order: 2,
              kind: "repo-path",
              path: "doc/legacy.md",
            },
          },
        ],
      },
    });
  });

  it("clears retained document rows when replacement state is missing", () => {
    const { db, sql } = createSqlStorage();
    bootstrapRetainedRecordTables(sql);

    replaceRetainedDocumentRows(sql, createRetainedDocumentState(), "web-authority:1:5");
    replaceRetainedDocumentRows(sql, null);

    expect(readRetainedDocumentStateFromSql(sql)).toBeNull();
    expect(queryAll(db, "SELECT * FROM io_retained_record")).toEqual([]);
  });
});
