import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parse as parseYaml } from "yaml";
import z from "zod";

import {
  DEFAULT_BACKLOG_BUILTIN_DOC_IDS,
  DEFAULT_EXECUTE_BUILTIN_DOC_IDS,
  resolveBuiltinDoc,
} from "./builtins.js";
import type { AgentIssue, AgentRole, IssueRoutingSelection, Workflow } from "./types.js";

const WORKFLOW_FILE = "WORKFLOW.md";
const ISSUE_HINT_BLOCK_PATTERN = /<!--\s*io\b([\s\S]*?)-->/gi;
const BUILTIN_DOC_REF_PATTERN = /(?<![A-Za-z0-9._/-])(builtin:[A-Za-z0-9._-]+)\b/g;
const REGISTERED_DOC_REF_PATTERN =
  /(?<![A-Za-z0-9_/:.-])([A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+)\b/g;
const REPO_PATH_DOC_REF_PATTERN =
  /(?<![A-Za-z0-9_./-])(\.\/[A-Za-z0-9_./-]+\.md(?:#[A-Za-z0-9._/-]+)?)\b/g;

const issueBodyHintsSchema = z
  .object({
    agent: z.enum(["backlog", "execute"]).optional(),
    docs: z.union([z.array(z.string().min(1)), z.string().min(1).transform((value) => [value])]).default([]),
    profile: z.string().min(1).optional(),
  })
  .strict();

type IssueBodyHints = {
  agent?: AgentRole;
  docs: string[];
  profile?: string;
};

type ResolvedDocSection = {
  content: string;
  key: string;
  label: string;
};

export interface ResolvedIssueContext {
  promptTemplate: string;
  selection: IssueRoutingSelection;
  warnings: string[];
}

function uniqueOrdered(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

function collectMatches(text: string, pattern: RegExp) {
  return [...text.matchAll(pattern)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));
}

function stripPathFragment(path: string) {
  return path.split("#", 1)[0]!;
}

function isBuiltinDocReference(reference: string) {
  return reference.startsWith("builtin:");
}

function isRepoPathDocReference(reference: string) {
  return reference.startsWith("./");
}

function getDefaultProfileInclude(agent: AgentRole) {
  return agent === "backlog"
    ? [...DEFAULT_BACKLOG_BUILTIN_DOC_IDS]
    : [...DEFAULT_EXECUTE_BUILTIN_DOC_IDS];
}

function resolveIssueSelection(
  baseSelection: IssueRoutingSelection,
  hints: IssueBodyHints,
): IssueRoutingSelection {
  const agent = hints.agent ?? baseSelection.agent;
  return {
    agent,
    profile: hints.profile?.trim() || (hints.agent && !hints.profile ? agent : baseSelection.profile),
  };
}

function parseIssueBodyHints(description: string) {
  const warnings: string[] = [];
  const matches = [...description.matchAll(ISSUE_HINT_BLOCK_PATTERN)];
  if (matches.length > 1) {
    warnings.push('Multiple `<!-- io ... -->` blocks found; using the first block.');
  }

  const descriptionWithoutHints = description.replaceAll(ISSUE_HINT_BLOCK_PATTERN, "").trim();
  const firstBlockBody = matches[0]?.[1]?.trim();
  if (!firstBlockBody) {
    return {
      descriptionWithoutHints,
      hints: { docs: [] } satisfies IssueBodyHints,
      warnings,
    };
  }

  try {
    const parsed = parseYaml(firstBlockBody) ?? {};
    const result = issueBodyHintsSchema.safeParse(parsed);
    if (!result.success) {
      warnings.push("Invalid issue metadata block; ignoring issue-level hints.");
      return {
        descriptionWithoutHints,
        hints: { docs: [] } satisfies IssueBodyHints,
        warnings,
      };
    }
    return {
      descriptionWithoutHints,
      hints: {
        agent: result.data.agent,
        docs: uniqueOrdered(result.data.docs),
        profile: result.data.profile?.trim(),
      } satisfies IssueBodyHints,
      warnings,
    };
  } catch {
    warnings.push("Invalid issue metadata block; ignoring issue-level hints.");
    return {
      descriptionWithoutHints,
      hints: { docs: [] } satisfies IssueBodyHints,
      warnings,
    };
  }
}

function extractLinkedDocReferences(description: string) {
  return uniqueOrdered([
    ...collectMatches(description, BUILTIN_DOC_REF_PATTERN),
    ...collectMatches(description, REPO_PATH_DOC_REF_PATTERN),
    ...collectMatches(description, REGISTERED_DOC_REF_PATTERN),
  ]);
}

async function readTrimmedFile(path: string) {
  const content = (await readFile(path, "utf8")).trim();
  if (!content) {
    throw new Error(`workflow_doc_empty:${path}`);
  }
  return content;
}

async function resolveDocReference(
  workflow: Workflow,
  repoRoot: string,
  reference: string,
): Promise<ResolvedDocSection | undefined> {
  if (isBuiltinDocReference(reference)) {
    const overridePath = workflow.context.overrides[reference];
    if (overridePath) {
      return {
        content: await readTrimmedFile(overridePath),
        key: `path:${overridePath}`,
        label: reference,
      };
    }

    const builtinDoc = resolveBuiltinDoc(reference);
    if (!builtinDoc) {
      return undefined;
    }
    return {
      content: builtinDoc.content.trim(),
      key: `builtin:${reference}`,
      label: reference,
    };
  }

  if (isRepoPathDocReference(reference)) {
    const absolutePath = resolve(repoRoot, stripPathFragment(reference));
    return {
      content: await readTrimmedFile(absolutePath),
      key: `path:${absolutePath}`,
      label: reference,
    };
  }

  const registeredPath = workflow.context.docs[reference];
  if (!registeredPath) {
    return undefined;
  }
  return {
    content: await readTrimmedFile(registeredPath),
    key: `path:${registeredPath}`,
    label: reference,
  };
}

function appendSection(
  sections: string[],
  seenKeys: Set<string>,
  section: ResolvedDocSection | undefined,
) {
  if (!section || seenKeys.has(section.key)) {
    return;
  }
  seenKeys.add(section.key);
  sections.push(`<!-- ${section.label} -->\n${section.content}`);
}

function resolveProfileInclude(workflow: Workflow, selection: IssueRoutingSelection) {
  const profile = workflow.context.profiles[selection.profile];
  if (profile) {
    return {
      include: [...profile.include],
      warnings: [],
    };
  }
  return {
    include: getDefaultProfileInclude(selection.agent),
    warnings:
      selection.profile === selection.agent
        ? []
        : [`Unknown context profile "${selection.profile}"; using "${selection.agent}" defaults.`],
  };
}

export async function resolveIssueContext(options: {
  baseSelection: IssueRoutingSelection;
  issue: AgentIssue;
  repoRoot: string;
  workflow: Workflow;
}): Promise<ResolvedIssueContext> {
  const { baseSelection, issue, repoRoot, workflow } = options;
  const { descriptionWithoutHints, hints, warnings } = parseIssueBodyHints(issue.description);
  const selection = resolveIssueSelection(baseSelection, hints);
  const linkedDocReferences = extractLinkedDocReferences(descriptionWithoutHints);
  const issueDocReferences = uniqueOrdered([...hints.docs, ...linkedDocReferences]);
  const sections: string[] = [];
  const seenKeys = new Set<string>();
  const prePromptSections: ResolvedDocSection[] = [];
  const postPromptSections: ResolvedDocSection[] = [];

  if (workflow.entrypoint.kind === "io") {
    const profileResolution = resolveProfileInclude(workflow, selection);
    warnings.push(...profileResolution.warnings);

    for (const reference of profileResolution.include) {
      const section = await resolveDocReference(workflow, repoRoot, reference);
      if (!section) {
        throw new Error(`workflow_doc_missing:${reference}`);
      }
      if (isBuiltinDocReference(reference)) {
        if (workflow.entrypoint.promptPath.endsWith(WORKFLOW_FILE)) {
          continue;
        }
        prePromptSections.push(section);
        continue;
      }
      postPromptSections.push(section);
    }
  }

  for (const section of prePromptSections) {
    appendSection(sections, seenKeys, section);
  }

  appendSection(sections, seenKeys, {
    content: workflow.promptTemplate.trim(),
    key: `path:${workflow.entrypoint.promptPath}`,
    label: workflow.entrypoint.promptPath,
  });

  for (const section of postPromptSections) {
    appendSection(sections, seenKeys, section);
  }

  for (const reference of issueDocReferences) {
    try {
      const section = await resolveDocReference(workflow, repoRoot, reference);
      if (!section) {
        warnings.push(`Unresolved issue doc reference: ${reference}`);
        continue;
      }
      appendSection(sections, seenKeys, section);
    } catch {
      warnings.push(`Unresolved issue doc reference: ${reference}`);
    }
  }

  return {
    promptTemplate: sections.join("\n\n"),
    selection,
    warnings,
  };
}
