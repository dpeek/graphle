import { expect, test } from "bun:test";

import {
  DEFAULT_BACKLOG_BUILTIN_DOC_IDS,
  DEFAULT_EXECUTE_BUILTIN_DOC_IDS,
  DEFAULT_REVIEW_BUILTIN_DOC_IDS,
  listBuiltinDocs,
  resolveBuiltinDoc,
} from "./builtins.js";

test("builtin docs expose stable ids for each shipped family", () => {
  const ids = listBuiltinDocs().map((doc) => doc.id);

  expect(ids).toContain("builtin:graphle.agent.execute.default");
  expect(ids).toContain("builtin:graphle.agent.backlog.default");
  expect(ids).toContain("builtin:graphle.agent.review.default");
  expect(ids).toContain("builtin:graphle.core.git-safety");
  expect(ids).toContain("builtin:graphle.core.validation");
  expect(ids).toContain("builtin:graphle.linear.status-updates");
  expect(ids).toContain("builtin:graphle.context.discovery");
});

test("default execute, backlog, and review bundles resolve to shipped built-ins", () => {
  for (const id of [
    ...DEFAULT_EXECUTE_BUILTIN_DOC_IDS,
    ...DEFAULT_BACKLOG_BUILTIN_DOC_IDS,
    ...DEFAULT_REVIEW_BUILTIN_DOC_IDS,
  ]) {
    expect(resolveBuiltinDoc(id)?.content.length).toBeGreaterThan(0);
  }
});
