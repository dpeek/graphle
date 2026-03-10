import type {
  AgentRawLineEvent,
  AgentSessionEvent,
  AgentSessionEventObserver,
  AgentSessionIssueRef,
  AgentSessionPhase,
  AgentSessionRef,
  AgentStatusCode,
  AgentStatusFormat,
} from "./session-events.js";
import {
  createAgentSessionDisplayState,
  renderAgentStatusEvent,
  type AgentSessionDisplayState,
} from "./session-events.js";

const DEFAULT_MAX_EVENT_HISTORY = 128;
const DEFAULT_MAX_TRANSCRIPT_CHARS = 24_000;

type AgentTuiInternalColumnState = {
  body: string;
  displayState: AgentSessionDisplayState;
  eventHistory: AgentTuiEventRecord[];
  firstSequence: number;
  lastSequence: number;
  phase: AgentSessionPhase | "pending";
  session: AgentSessionRef;
  status?: AgentTuiStatusSummary;
};

export interface AgentTuiEventRecord {
  sequence: number;
  summary: string;
  timestamp: string;
  type: AgentSessionEvent["type"];
}

export interface AgentTuiStatusSummary {
  code: AgentStatusCode;
  format: AgentStatusFormat;
  itemId?: string;
  text?: string;
  timestamp: string;
}

export interface AgentTuiColumnSnapshot {
  body: string;
  childSessionIds: string[];
  depth: number;
  eventHistory: AgentTuiEventRecord[];
  firstSequence: number;
  lastSequence: number;
  parentSessionId?: string;
  phase: AgentSessionPhase | "pending";
  session: AgentSessionRef;
  status?: AgentTuiStatusSummary;
}

export type AgentTuiSessionSnapshot = AgentTuiColumnSnapshot;

export interface AgentTuiSnapshot {
  columns: AgentTuiColumnSnapshot[];
  sessions: AgentTuiSessionSnapshot[];
  updatedAt?: string;
}

export interface AgentTuiStore {
  getSnapshot(): AgentTuiSnapshot;
  observe: AgentSessionEventObserver;
  subscribe(listener: () => void): () => void;
}

export interface AgentTuiStoreOptions {
  maxEventHistory?: number;
  maxTranscriptChars?: number;
}

function mergeSessionRef(current: AgentSessionRef, next: AgentSessionRef): AgentSessionRef {
  let issue: AgentSessionIssueRef | undefined;
  if (current.issue || next.issue) {
    issue = {
      ...current.issue,
      ...next.issue,
    } as AgentSessionIssueRef;
  }
  return {
    ...current,
    ...next,
    issue,
  };
}

function createSessionState(
  session: AgentSessionRef,
  sequence: number,
): AgentTuiInternalColumnState {
  const displayState = createAgentSessionDisplayState();
  displayState.headerPrinted = true;
  return {
    body: "",
    displayState,
    eventHistory: [],
    firstSequence: sequence,
    lastSequence: sequence,
    phase: "pending",
    session,
  };
}

function trimTranscript(text: string, maxChars: number) {
  if (text.length <= maxChars) {
    return text;
  }
  const trimmed = text.slice(text.length - maxChars);
  const firstNewline = trimmed.indexOf("\n");
  if (firstNewline === -1) {
    return trimmed;
  }
  return trimmed.slice(firstNewline + 1);
}

function appendTranscript(
  state: AgentTuiInternalColumnState,
  text: string,
  maxTranscriptChars: number,
) {
  if (!text) {
    return;
  }
  state.body = trimTranscript(`${state.body}${text}`, maxTranscriptChars);
}

function closeOpenLine(state: AgentTuiInternalColumnState, maxTranscriptChars: number) {
  if (!state.displayState.lineOpen) {
    return;
  }
  appendTranscript(state, "\n", maxTranscriptChars);
  state.displayState.lineOpen = false;
  state.displayState.activeAgentMessageId = undefined;
}

function formatLifecycleText(
  phase: AgentSessionPhase,
  data: Record<string, unknown> | undefined,
  session: AgentSessionRef,
) {
  const parts = [`Session ${phase}`];
  const commitSha = typeof data?.commitSha === "string" ? data.commitSha : undefined;
  const reason = typeof data?.reason === "string" ? data.reason : undefined;
  const branchName =
    (typeof data?.branchName === "string" ? data.branchName : undefined) ?? session.branchName;
  const workspacePath =
    (typeof data?.workspacePath === "string" ? data.workspacePath : undefined) ??
    session.workspacePath;
  if (commitSha) {
    parts.push(`commit ${commitSha.slice(0, 7)}`);
  }
  if (branchName) {
    parts.push(branchName);
  }
  if (workspacePath) {
    parts.push(workspacePath);
  }
  let text = parts.join(" | ");
  if (reason) {
    text = `${text}: ${reason}`;
  }
  return `${text}\n`;
}

function formatRawLineEvent(event: AgentRawLineEvent) {
  const prefix = event.encoding === "jsonl" ? "jsonl" : event.stream;
  return `${prefix}: ${event.line}\n`;
}

function summarizeEvent(event: AgentSessionEvent) {
  switch (event.type) {
    case "session":
      return formatLifecycleText(event.phase, event.data, event.session).trimEnd();
    case "status": {
      const text = event.text?.trim();
      if (text) {
        return `${event.code}: ${text}`;
      }
      if (event.itemId) {
        return `${event.code}: ${event.itemId}`;
      }
      return event.code;
    }
    case "raw-line":
      return `${event.stream} ${event.encoding}: ${event.line}`;
  }
}

function pushEventHistory(
  state: AgentTuiInternalColumnState,
  event: AgentSessionEvent,
  maxEventHistory: number,
) {
  state.eventHistory.push({
    sequence: event.sequence,
    summary: summarizeEvent(event),
    timestamp: event.timestamp,
    type: event.type,
  });
  if (state.eventHistory.length > maxEventHistory) {
    state.eventHistory.splice(0, state.eventHistory.length - maxEventHistory);
  }
}

function compareColumnOrder(left: AgentTuiInternalColumnState, right: AgentTuiInternalColumnState) {
  if (left.session.kind === "supervisor" && right.session.kind !== "supervisor") {
    return -1;
  }
  if (left.session.kind !== "supervisor" && right.session.kind === "supervisor") {
    return 1;
  }
  if (left.firstSequence !== right.firstSequence) {
    return left.firstSequence - right.firstSequence;
  }
  return left.session.id.localeCompare(right.session.id);
}

function buildColumnSnapshots(
  sessions: Map<string, AgentTuiInternalColumnState>,
): AgentTuiColumnSnapshot[] {
  const states = Array.from(sessions.values());
  const statesById = new Map(states.map((state) => [state.session.id, state]));
  const childrenByParent = new Map<string, AgentTuiInternalColumnState[]>();
  const roots: AgentTuiInternalColumnState[] = [];

  for (const state of states) {
    const parentId = state.session.parentSessionId;
    if (!parentId || parentId === state.session.id || !statesById.has(parentId)) {
      roots.push(state);
      continue;
    }
    const children = childrenByParent.get(parentId) ?? [];
    children.push(state);
    childrenByParent.set(parentId, children);
  }

  roots.sort(compareColumnOrder);
  for (const children of childrenByParent.values()) {
    children.sort(compareColumnOrder);
  }

  const columns: AgentTuiColumnSnapshot[] = [];
  const visited = new Set<string>();

  const visit = (state: AgentTuiInternalColumnState, depth: number) => {
    if (visited.has(state.session.id)) {
      return;
    }
    visited.add(state.session.id);
    const childStates = childrenByParent.get(state.session.id) ?? [];
    columns.push({
      body: state.body,
      childSessionIds: childStates.map((child) => child.session.id),
      depth,
      eventHistory: [...state.eventHistory],
      firstSequence: state.firstSequence,
      lastSequence: state.lastSequence,
      parentSessionId: state.session.parentSessionId,
      phase: state.phase,
      session: state.session,
      status: state.status,
    });
    for (const child of childStates) {
      visit(child, depth + 1);
    }
  };

  for (const root of roots) {
    visit(root, 0);
  }

  const orphaned = states.filter((state) => !visited.has(state.session.id)).sort(compareColumnOrder);
  for (const state of orphaned) {
    visit(state, 0);
  }

  return columns;
}

export function createAgentTuiStore(options: AgentTuiStoreOptions = {}): AgentTuiStore {
  const listeners = new Set<() => void>();
  const maxEventHistory = options.maxEventHistory ?? DEFAULT_MAX_EVENT_HISTORY;
  const maxTranscriptChars = options.maxTranscriptChars ?? DEFAULT_MAX_TRANSCRIPT_CHARS;
  const sessions = new Map<string, AgentTuiInternalColumnState>();
  let updatedAt: string | undefined;

  const getSessionState = (event: AgentSessionEvent) => {
    const existing = sessions.get(event.session.id);
    if (existing) {
      existing.session = mergeSessionRef(existing.session, event.session);
      existing.lastSequence = event.sequence;
      return existing;
    }
    const created = createSessionState(event.session, event.sequence);
    sessions.set(event.session.id, created);
    return created;
  };

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot() {
      const columns = buildColumnSnapshots(sessions);
      return {
        columns,
        sessions: columns,
        updatedAt,
      };
    },
    observe(event) {
      const state = getSessionState(event);
      updatedAt = event.timestamp;

      if (event.type === "session") {
        state.phase = event.phase;
        closeOpenLine(state, maxTranscriptChars);
        appendTranscript(
          state,
          formatLifecycleText(event.phase, event.data, state.session),
          maxTranscriptChars,
        );
        pushEventHistory(state, event, maxEventHistory);
        notify();
        return;
      }

      if (event.type === "status") {
        state.status = {
          code: event.code,
          format: event.format,
          itemId: event.itemId,
          text: event.text,
          timestamp: event.timestamp,
        };
        renderAgentStatusEvent({
          event,
          state: state.displayState,
          writeDisplay: (text) => {
            appendTranscript(state, text, maxTranscriptChars);
          },
        });
        pushEventHistory(state, event, maxEventHistory);
        notify();
        return;
      }

      closeOpenLine(state, maxTranscriptChars);
      appendTranscript(state, formatRawLineEvent(event), maxTranscriptChars);
      pushEventHistory(state, event, maxEventHistory);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
