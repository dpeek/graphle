import type {
  AgentIssue,
  ManagedCommentChildMutation,
} from "./types.js";

type ManagedBacklogOption = {
  alignment: string;
  focus: string;
  title: string;
};

type MarkdownSection = {
  heading?: string;
  lines: string[];
};

function uniqueOrdered(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

function isListItem(line: string) {
  return /^\s*(?:[-*+]|\d+\.)\s+/.test(line);
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
        heading: headingMatch[2]?.trim(),
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

export function parseManagedBacklogOptions(description: string): ManagedBacklogOption[] {
  const options: ManagedBacklogOption[] = [];

  for (const section of splitMarkdownSections(description).filter((entry) =>
    Boolean(entry.heading && /^work options$/i.test(entry.heading))
  )) {
    for (let index = 0; index < section.lines.length; index++) {
      const title = section.lines[index]?.match(/^\d+\.\s+\*\*(.+?)\*\*$/)?.[1]?.trim();
      const focus = section.lines[index + 1]?.match(/^\s*Focus:\s*(.+)$/)?.[1]?.trim();
      const alignment = section.lines[index + 2]?.match(/^\s*Alignment:\s*(.+)$/)?.[1]?.trim();
      if (!title || !focus || !alignment) {
        continue;
      }
      options.push({ alignment, focus, title });
    }
  }

  return options;
}

function renderManagedBacklogChildDescription(options: {
  docs: string[];
  issue: AgentIssue;
  note?: string;
  option: ManagedBacklogOption;
  primaryModuleId: string;
}) {
  const docLines = options.docs.length
    ? options.docs.map((doc) => `- ${doc}`)
    : ["- Reuse the parent issue brief and module defaults."];
  const noteLines = options.note?.trim() ? [`- Operator note: ${options.note.trim()}`] : [];

  return [
    "## Outcome",
    `- ${options.option.focus}`,
    `- Land the next ${options.primaryModuleId} stream slice for ${options.issue.identifier}.`,
    "",
    "## Scope",
    `- ${options.option.alignment}`,
    `- Keep the work centered on the ${options.primaryModuleId} module surface.`,
    "",
    "## Acceptance Criteria",
    `- ${options.option.focus}`,
    `- ${options.option.alignment}`,
    "- Keep the parent stream description and child backlog aligned.",
    "",
    "## Module Scope",
    `- Primary module: ${options.primaryModuleId}`,
    "",
    "## Dependencies And Docs",
    `- Parent issue: ${options.issue.identifier}`,
    ...docLines,
    ...noteLines,
    "",
    "## Out Of Scope",
    "- Unrelated module work or repo-wide refactors beyond this slice.",
  ].join("\n");
}

export function buildManagedBacklogChildMutations(options: {
  docs: string[];
  issue: AgentIssue;
  note?: string;
  optionList: ManagedBacklogOption[];
  primaryModuleId: string;
}) {
  return options.optionList.map(
    (option, index): ManagedCommentChildMutation => ({
      blockedBy: index === 0 ? [] : [`managed-backlog-${index}`],
      description: renderManagedBacklogChildDescription({
        docs: options.docs,
        issue: options.issue,
        note: options.note,
        option,
        primaryModuleId: options.primaryModuleId,
      }),
      docs: options.docs,
      labels: [options.primaryModuleId],
      priority: options.issue.priority,
      reference: `managed-backlog-${index + 1}`,
      state: "Todo",
      title: option.title,
    }),
  );
}

export function buildManagedBacklogChildren(options: {
  docs: string[];
  issue: AgentIssue;
  note?: string;
  parentDescription: string;
  primaryModuleId: string;
}) {
  return buildManagedBacklogChildMutations({
    docs: uniqueOrdered(options.docs),
    issue: options.issue,
    note: options.note,
    optionList: parseManagedBacklogOptions(options.parentDescription),
    primaryModuleId: options.primaryModuleId,
  });
}
