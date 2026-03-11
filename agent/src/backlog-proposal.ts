import { relative } from "node:path";

import { resolveIssueModule } from "./issue-routing.js";
import type { AgentIssue, ResolvedContextBundle, Workflow, WorkflowModule } from "./types.js";

export const MANAGED_BACKLOG_PROPOSAL_START = "<!-- io-managed:backlog-proposal:start -->";
export const MANAGED_BACKLOG_PROPOSAL_END = "<!-- io-managed:backlog-proposal:end -->";

const MANAGED_BACKLOG_PROPOSAL_BLOCK = new RegExp(
  `${escapeForRegExp(MANAGED_BACKLOG_PROPOSAL_START)}[\\s\\S]*?${escapeForRegExp(MANAGED_BACKLOG_PROPOSAL_END)}\\s*`,
);

const STATE_HEADING_PATTERNS = [
  /what this stream is about/i,
  /what has landed/i,
  /current focus/i,
  /current state/i,
  /current behavior/i,
  /what io is/i,
  /purpose/i,
] as const;

const CONSTRAINT_HEADING_PATTERNS = [
  /when changing this repo/i,
  /local constraints/i,
  /validation/i,
  /module guardrails/i,
  /migration boundary/i,
  /scope/i,
  /out of scope/i,
  /notes/i,
] as const;

const GOAL_HEADING_PATTERNS = [
  /objective/i,
  /current focus/i,
  /long-term goal/i,
  /good changes/i,
  /what this stream is about/i,
] as const;

interface MarkdownSection {
  heading?: string;
  lines: string[];
}

interface ProposalOption {
  alignment: string;
  focus: string;
  title: string;
}

export function shouldWriteManagedBacklogProposal(
  issue: AgentIssue,
  workflow: Pick<Workflow, "modules">,
) {
  return !issue.hasParent &&
    issue.labels.includes("io") &&
    Boolean(resolveIssueModule(workflow.modules, issue));
}

export function rewriteManagedBacklogDescription(options: {
  bundle: ResolvedContextBundle;
  issue: AgentIssue;
  repoRoot: string;
  workflow: Pick<Workflow, "modules">;
}) {
  const { bundle, issue, repoRoot, workflow } = options;
  const module = resolveIssueModule(workflow.modules, issue);
  if (!module) {
    return issue.description;
  }

  const managedBlock = renderManagedBacklogProposalBlock({
    bundle,
    description: issue.description,
    module,
    repoRoot,
  });

  if (MANAGED_BACKLOG_PROPOSAL_BLOCK.test(issue.description)) {
    return issue.description.replace(MANAGED_BACKLOG_PROPOSAL_BLOCK, `${managedBlock}\n\n`).trimEnd();
  }

  const preservedDescription = issue.description.trimEnd();
  if (!preservedDescription) {
    return managedBlock;
  }
  return `${preservedDescription}\n\n${managedBlock}`;
}

export function buildManagedParentProposal(options: {
  issue: AgentIssue;
  module: WorkflowModule;
  repoRoot: string;
  resolvedContext: ResolvedContextBundle;
}) {
  const description = rewriteManagedBacklogDescription({
    bundle: options.resolvedContext,
    issue: options.issue,
    repoRoot: options.repoRoot,
    workflow: {
      modules: {
        [options.module.id]: options.module,
      },
    },
  });

  return {
    changed: description !== options.issue.description,
    description,
  };
}

function renderManagedBacklogProposalBlock(options: {
  bundle: ResolvedContextBundle;
  description: string;
  module: WorkflowModule;
  repoRoot: string;
}) {
  const { bundle, description, module, repoRoot } = options;
  const analysisText = stripManagedBacklogProposal(stripHtmlComments(description));
  const repoDocs = bundle.docs.filter((doc) => doc.source !== "builtin");
  const modulePath = toRepoRelativePath(repoRoot, module.path);
  const stateBullets = collectHighlights({
    docs: prioritizeModuleDocs(repoDocs, module),
    fallback: [
      `The primary stream is the \`${module.id}\` module under \`${modulePath}\`.`,
      "Keep the planning brief aligned with the module's shipped workflow and docs.",
    ],
    headingPatterns: STATE_HEADING_PATTERNS,
    maxItems: 4,
  });
  const constraintBullets = collectHighlights({
    docs: [...prioritizeModuleDocs(repoDocs, module), createIssueDocForAnalysis(analysisText)],
    fallback: [
      "Preserve human-authored notes and narrowing decisions outside this managed block.",
      "Keep the brief concise, concrete, and easy to refresh on later backlog runs.",
      "Prefer one primary module surface unless a cross-module exception is explicit.",
    ],
    headingPatterns: CONSTRAINT_HEADING_PATTERNS,
    maxItems: 4,
  });
  const goalBullets = collectHighlights({
    docs: prioritizeModuleDocs(repoDocs, module),
    fallback: [
      "Improve planning quality without losing operator visibility.",
      "Keep the next slice explicit, narrow, and reviewable.",
      "Turn the parent issue into durable execution guidance.",
    ],
    headingPatterns: GOAL_HEADING_PATTERNS,
    maxItems: 4,
  });
  const optionsList = buildWorkOptions({
    goals: goalBullets,
    module,
    repoRoot,
    themes: extractIssueThemes(analysisText),
  });

  return [
    MANAGED_BACKLOG_PROPOSAL_START,
    "## Managed Brief",
    "",
    "### Current Module State",
    ...stateBullets.map((bullet) => `- ${bullet}`),
    "",
    "### Constraints",
    ...constraintBullets.map((bullet) => `- ${bullet}`),
    "",
    "### Work Options",
    ...optionsList.flatMap((option, index) => [
      `${index + 1}. **${option.title}**`,
      `   Focus: ${option.focus}`,
      `   Alignment: ${option.alignment}`,
    ]),
    MANAGED_BACKLOG_PROPOSAL_END,
  ].join("\n");
}

function buildWorkOptions(options: {
  goals: string[];
  module: WorkflowModule;
  repoRoot: string;
  themes: string[];
}) {
  const { goals, module, repoRoot, themes } = options;
  const modulePath = toRepoRelativePath(repoRoot, module.path);
  const fallbackThemes = [
    `Stabilize the parent brief contract for \`${module.id}\` in \`${modulePath}\`.`,
    `Generate planning guidance directly from the assembled \`${module.id}\` context bundle.`,
    `Prove rerun safety and keep the next slice reviewable in \`${modulePath}\`.`,
  ];
  const fallbackGoals = [
    "Keep the planning loop explicit, legible, and easy to refresh.",
    "Improve execution readiness without forcing humans to reopen every linked doc.",
    "Preserve operator trust by keeping planning changes deterministic and scoped.",
  ];

  return Array.from({ length: 3 }, (_, index): ProposalOption => {
    const focus = themes[index] ?? fallbackThemes[index] ?? fallbackThemes[0]!;
    const alignment = goals[index] ?? fallbackGoals[index] ?? fallbackGoals[0]!;
    return {
      alignment,
      focus,
      title: createOptionTitle(focus, index),
    };
  });
}

function createOptionTitle(focus: string, index: number) {
  const cleaned = normalizeHighlight(focus)
    .replace(/^focus on\s+/i, "")
    .replace(/\.$/, "");
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 8);
  if (words.length) {
    const title = words.join(" ");
    return title.charAt(0).toUpperCase() + title.slice(1);
  }
  return `Option ${index + 1}`;
}

function extractIssueThemes(description: string) {
  const sections = splitMarkdownSections(description);
  const prioritizedSections = [
    { limit: 3, pattern: /deliverables/i },
    { limit: 2, pattern: /scope/i },
    { limit: 1, pattern: /outcome/i },
    { limit: 1, pattern: /notes/i },
  ] as const;
  const prioritizedThemes: string[] = [];

  for (const { limit, pattern } of prioritizedSections) {
    for (const section of sections.filter((entry) => matchesAnyPattern(entry.heading, [pattern]))) {
      prioritizedThemes.push(...extractSectionHighlights(section, limit).map(normalizeHighlight));
      if (uniqueOrdered(prioritizedThemes).length >= 3) {
        return uniqueOrdered(prioritizedThemes).filter(Boolean).slice(0, 3);
      }
    }
  }

  const themes = uniqueOrdered(prioritizedThemes).filter(Boolean);
  if (themes.length) {
    return themes.slice(0, 3);
  }

  const fallback = uniqueOrdered(
    sections.flatMap((section) => extractSectionHighlights(section, 1)).map(normalizeHighlight),
  ).filter(Boolean);
  return fallback.slice(0, 3);
}

function collectHighlights(options: {
  docs: Array<{ content: string; id: string; path?: string }>;
  fallback: string[];
  headingPatterns: readonly RegExp[];
  maxItems: number;
}) {
  const { docs, fallback, headingPatterns, maxItems } = options;
  const highlights = uniqueOrdered(
    docs.flatMap((doc) => {
      const sections = splitMarkdownSections(doc.content);
      const matched = sections.filter((section) => matchesAnyPattern(section.heading, headingPatterns));
      return matched.flatMap((section) => extractSectionHighlights(section, 2));
    }),
  )
    .map(normalizeHighlight)
    .filter(Boolean);
  if (highlights.length >= maxItems) {
    return highlights.slice(0, maxItems);
  }
  return uniqueOrdered([...highlights, ...fallback.map(normalizeHighlight).filter(Boolean)]).slice(
    0,
    maxItems,
  );
}

function prioritizeModuleDocs(
  docs: Array<{ content: string; id: string; path?: string; source?: string }>,
  module: WorkflowModule,
) {
  return [...docs].sort((left, right) => {
    const leftScore = isModuleDoc(left.path, module) ? 0 : 1;
    const rightScore = isModuleDoc(right.path, module) ? 0 : 1;
    return leftScore - rightScore;
  });
}

function isModuleDoc(path: string | undefined, module: WorkflowModule) {
  return Boolean(path && (path === module.path || path.startsWith(`${module.path}/`)));
}

function createIssueDocForAnalysis(content: string) {
  return {
    content,
    id: "issue.context",
  };
}

function extractSectionHighlights(section: MarkdownSection, limit: number) {
  const bullets = section.lines
    .filter((line) => isListItem(line))
    .map((line) => line.replace(/^\s*(?:[-*+]|\d+\.)\s+/, ""))
    .map(normalizeHighlight)
    .filter(Boolean);
  if (bullets.length) {
    return bullets.slice(0, limit);
  }
  const paragraph = normalizeHighlight(section.lines.join(" "));
  return paragraph ? [paragraph] : [];
}

function splitMarkdownSections(content: string) {
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection = { lines: [] };

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (current.heading || current.lines.length) {
        sections.push(current);
      }
      current = {
        heading: headingMatch[2]?.trim() ?? "",
        lines: [],
      };
      continue;
    }
    current.lines.push(line);
  }

  if (current.heading || current.lines.length) {
    sections.push(current);
  }

  return sections;
}

function normalizeHighlight(value: string) {
  return truncateText(
    value
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/`{3}[\s\S]*?`{3}/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function stripManagedBacklogProposal(description: string) {
  return description.replace(MANAGED_BACKLOG_PROPOSAL_BLOCK, "").trim();
}

function stripHtmlComments(description: string) {
  return description.replace(/<!--[\s\S]*?-->/g, " ").trim();
}

function truncateText(value: string, maxLength = 180) {
  if (!value || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function uniqueOrdered(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(value.trim());
  }
  return result;
}

function matchesAnyPattern(value: string | undefined, patterns: readonly RegExp[]) {
  if (!value) {
    return false;
  }
  return patterns.some((pattern) => pattern.test(value));
}

function isListItem(line: string) {
  return /^\s*(?:[-*+]|\d+\.)\s+/.test(line);
}

function toRepoRelativePath(repoRoot: string, path: string) {
  const relativePath = relative(repoRoot, path);
  return relativePath && !relativePath.startsWith("..") ? `./${relativePath}` : path;
}

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
