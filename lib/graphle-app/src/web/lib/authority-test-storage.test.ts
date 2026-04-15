import {
  persistedAuthoritativeGraphStateVersion,
  type PersistedAuthoritativeGraphRetainedRecord,
} from "@dpeek/graphle-authority";
import { describe, expect, it } from "bun:test";

import { createInMemoryTestWebAppAuthorityStorage } from "./authority-test-storage.js";

describe("authority-test-storage", () => {
  it("preserves non-document retained rows when retained documents are replaced", async () => {
    const nonDocumentRecord: PersistedAuthoritativeGraphRetainedRecord = {
      recordKind: "workflow-decision",
      recordId: "decision:1",
      version: 1,
      payload: {
        summary: "Keep this retained row while document repair rewrites document records.",
      },
    };
    const storage = createInMemoryTestWebAppAuthorityStorage({
      version: persistedAuthoritativeGraphStateVersion,
      snapshot: {
        edges: [],
        retracted: [],
      },
      writeHistory: {
        cursorPrefix: "tx:test:",
        baseSequence: 0,
        retainedHistoryPolicy: {
          kind: "all",
        },
        results: [],
      },
      retainedRecords: [
        nonDocumentRecord,
        {
          recordKind: "document",
          recordId: "document:1",
          version: 1,
          payload: {
            title: "Before repair",
            isArchived: false,
            tagIds: [],
          },
        },
      ],
    });

    await storage.storage.replaceRetainedDocuments({
      documents: [
        {
          recordKind: "document",
          recordId: "document:1",
          version: 1,
          payload: {
            title: "After repair",
            description: "Updated document payload.",
            isArchived: false,
            tagIds: [],
          },
        },
      ],
      blocks: [
        {
          recordKind: "document-block",
          recordId: "document-block:1",
          version: 1,
          payload: {
            title: "Overview",
            description: "Recovered markdown block.",
            documentId: "document:1",
            kind: "markdown",
            order: 0,
            content: "Recovered retained content.",
          },
        },
      ],
    });

    expect(storage.read()?.retainedRecords).toEqual([
      nonDocumentRecord,
      {
        recordKind: "document",
        recordId: "document:1",
        version: 1,
        payload: {
          title: "After repair",
          description: "Updated document payload.",
          isArchived: false,
          tagIds: [],
        },
      },
      {
        recordKind: "document-block",
        recordId: "document-block:1",
        version: 1,
        payload: {
          title: "Overview",
          description: "Recovered markdown block.",
          documentId: "document:1",
          kind: "markdown",
          order: 0,
          content: "Recovered retained content.",
        },
      },
    ]);
  });
});
