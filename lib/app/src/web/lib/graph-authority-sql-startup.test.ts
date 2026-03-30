import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";

import {
  loadPersistedAuthorityState,
  type DurableObjectSqlStorageLike,
} from "./graph-authority-sql-startup.js";
import { bootstrapDurableObjectAuthoritySchema } from "./graph-authority-sql-storage.js";

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

describe("graph-authority-sql-startup", () => {
  it("loads retained records even when graph metadata is missing", () => {
    const { db, sql } = createSqlStorage();
    bootstrapDurableObjectAuthoritySchema({ sql });

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
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`,
    ).run(
      "document",
      "document:retained",
      1,
      JSON.stringify({
        title: "Retained Workflow Goal",
        description: "Loaded without graph metadata.",
        slug: "retained-workflow-goal",
        isArchived: false,
        tagIds: [],
      }),
      "2026-03-30T00:00:00.000Z",
      "2026-03-30T00:00:00.000Z",
    );

    expect(
      loadPersistedAuthorityState(sql, {
        defaultRetainedHistoryPolicy: {
          kind: "transaction-count",
          maxTransactions: 128,
        },
        expectedSchemaVersion: 1,
      }),
    ).toEqual({
      snapshot: {
        edges: [],
        retracted: [],
      },
      retainedRecords: [
        {
          recordKind: "document",
          recordId: "document:retained",
          version: 1,
          payload: {
            title: "Retained Workflow Goal",
            description: "Loaded without graph metadata.",
            slug: "retained-workflow-goal",
            isArchived: false,
            tagIds: [],
          },
        },
      ],
      recovery: "reset-baseline",
      startupDiagnostics: {
        recovery: "reset-baseline",
        repairReasons: [],
        resetReasons: ["missing-write-history"],
      },
    });
  });
});
