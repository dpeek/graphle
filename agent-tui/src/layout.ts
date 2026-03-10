import type { AgentSessionRef } from "./session-events.js";
import type { AgentTuiColumnSnapshot, AgentTuiSnapshot } from "./store.js";

const DEFAULT_FRAME_COLUMNS = 120;
const DEFAULT_FRAME_ROWS = 32;

export interface AgentTuiFrameSize {
  columns?: number;
  rows?: number;
}

export interface AgentTuiColumnComponentModel {
  childrenLine: string;
  id: string;
  latestEventLine: string;
  metaLine: string;
  parentLine: string;
  statusLine: string;
  title: string;
  transcript: string;
}

export interface AgentTuiRootComponentModel {
  columns: AgentTuiColumnComponentModel[];
}

function normalizeColumnSnapshot(column: AgentTuiColumnSnapshot): AgentTuiColumnSnapshot {
  return {
    ...column,
    childSessionIds: column.childSessionIds ?? [],
    depth: column.depth ?? 0,
    eventHistory: column.eventHistory ?? [],
    parentSessionId: column.parentSessionId ?? column.session.parentSessionId,
  };
}

function formatTitle(session: AgentSessionRef) {
  if (session.kind === "supervisor") {
    return "Supervisor";
  }
  const identifier = session.issue?.identifier ?? session.workerId;
  return `${identifier} ${session.title}`;
}

function formatMetaLine(column: AgentTuiColumnSnapshot) {
  const parts: string[] = [column.phase];
  if (column.session.kind !== "supervisor") {
    parts.unshift(column.session.workerId);
  }
  if (column.session.branchName) {
    parts.push(column.session.branchName);
  }
  return parts.join(" | ");
}

function formatStatusLine(column: AgentTuiColumnSnapshot) {
  const text = column.status?.text?.trim();
  if (text) {
    return `Status: ${text}`;
  }
  if (column.status) {
    return `Status: ${column.status.code}`;
  }
  return "Status: waiting for runtime events";
}

function formatParentLine(
  column: AgentTuiColumnSnapshot,
  columnsById: Map<string, AgentTuiColumnSnapshot>,
) {
  if (!column.parentSessionId) {
    return "Parent: none";
  }
  const parent = columnsById.get(column.parentSessionId);
  return `Parent: ${parent ? formatTitle(parent.session) : column.parentSessionId}`;
}

function formatChildrenLine(
  column: AgentTuiColumnSnapshot,
  columnsById: Map<string, AgentTuiColumnSnapshot>,
) {
  const childSessionIds = column.childSessionIds ?? [];
  if (!childSessionIds.length) {
    return "Children: none";
  }
  const labels = childSessionIds.map((childId) => {
    const child = columnsById.get(childId);
    return child ? formatTitle(child.session) : childId;
  });
  return `Children: ${labels.join(", ")}`;
}

function formatLatestEventLine(column: AgentTuiColumnSnapshot) {
  const eventHistory = column.eventHistory ?? [];
  const latest = eventHistory[eventHistory.length - 1];
  if (!latest) {
    return "Latest: waiting for events";
  }
  return `Latest: ${latest.summary}`;
}

function formatTranscript(column: AgentTuiColumnSnapshot) {
  const body = column.body.trimEnd();
  if (body.length) {
    return body;
  }
  return "Waiting for session transcript...";
}

export function buildAgentTuiRootComponentModel(
  snapshot: AgentTuiSnapshot,
): AgentTuiRootComponentModel {
  const columns = (snapshot.columns ?? snapshot.sessions ?? []).map(normalizeColumnSnapshot);
  if (!columns.length) {
    return {
      columns: [
        {
          childrenLine: "Children: none",
          id: "empty",
          latestEventLine: "Latest: waiting for events",
          metaLine: "idle",
          parentLine: "Parent: none",
          statusLine: "Status: waiting for runtime events",
          title: "Agent Sessions",
          transcript: "Waiting for agent session events...",
        },
      ],
    };
  }

  const columnsById = new Map(columns.map((column) => [column.session.id, column]));
  return {
    columns: columns.map((column) => ({
      childrenLine: formatChildrenLine(column, columnsById),
      id: column.session.id,
      latestEventLine: formatLatestEventLine(column),
      metaLine: formatMetaLine(column),
      parentLine: formatParentLine(column, columnsById),
      statusLine: formatStatusLine(column),
      title: formatTitle(column.session),
      transcript: formatTranscript(column),
    })),
  };
}

function truncateEnd(text: string, width: number) {
  if (width <= 0) {
    return "";
  }
  if (text.length <= width) {
    return text;
  }
  if (width <= 3) {
    return text.slice(0, width);
  }
  return `${text.slice(0, width - 3)}...`;
}

function padCell(text: string, width: number) {
  return truncateEnd(text, width).padEnd(Math.max(width, 0), " ");
}

function wrapLine(text: string, width: number) {
  if (width <= 0) {
    return [];
  }
  if (!text.length) {
    return [""];
  }
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += width) {
    chunks.push(text.slice(index, index + width));
  }
  return chunks;
}

function wrapBody(text: string, width: number) {
  if (width <= 0) {
    return [];
  }
  const sourceLines = text.split("\n");
  if (text.endsWith("\n")) {
    sourceLines.pop();
  }
  return sourceLines.flatMap((line) => wrapLine(line, width));
}

function distributeColumnWidths(totalWidth: number, columnCount: number) {
  if (columnCount <= 0) {
    return [];
  }
  const separatorWidth = Math.max(0, columnCount - 1);
  const availableWidth = Math.max(columnCount, totalWidth - separatorWidth);
  const baseWidth = Math.floor(availableWidth / columnCount);
  let remainder = availableWidth % columnCount;
  return Array.from({ length: columnCount }, () => {
    const width = baseWidth + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return width;
  });
}

function renderEmptyFrame(columns: number, rows: number) {
  const safeColumns = Math.max(1, columns);
  const safeRows = Math.max(1, rows);
  const lines = Array.from({ length: safeRows }, (_, index) =>
    index === 0
      ? padCell("Waiting for agent session events...", safeColumns)
      : "".padEnd(safeColumns, " "),
  );
  return lines.join("\n");
}

function renderColumn(model: AgentTuiColumnComponentModel, width: number, rows: number) {
  const fixedLines = [
    padCell(model.title, width),
    padCell(model.metaLine, width),
    padCell(model.statusLine, width),
    padCell(model.parentLine, width),
    padCell(model.childrenLine, width),
    padCell(model.latestEventLine, width),
    "".padEnd(Math.max(width, 0), "-"),
  ];
  const bodyHeight = Math.max(0, rows - fixedLines.length);
  const wrappedBody = wrapBody(model.transcript, width);
  const visibleBody = wrappedBody.slice(-bodyHeight);
  const paddedBody = visibleBody
    .map((line) => padCell(line, width))
    .concat(
      Array.from({ length: Math.max(0, bodyHeight - visibleBody.length) }, () =>
        "".padEnd(width, " "),
      ),
    );
  return fixedLines.concat(paddedBody);
}

export function renderAgentTuiFrame(snapshot: AgentTuiSnapshot, size: AgentTuiFrameSize = {}) {
  const columns = Math.max(1, size.columns ?? DEFAULT_FRAME_COLUMNS);
  const rows = Math.max(1, size.rows ?? DEFAULT_FRAME_ROWS);
  const layout = buildAgentTuiRootComponentModel(snapshot);
  if (!layout.columns.length) {
    return renderEmptyFrame(columns, rows);
  }

  const widths = distributeColumnWidths(columns, layout.columns.length);
  const columnsByModel = layout.columns.map((model, index) =>
    renderColumn(model, widths[index] ?? 1, rows),
  );
  const lines = Array.from({ length: rows }, (_, rowIndex) =>
    columnsByModel
      .map((column, index) => column[rowIndex] ?? "".padEnd(widths[index] ?? 1, " "))
      .join("|"),
  );
  return lines.join("\n");
}
