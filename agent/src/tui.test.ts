import { expect, test } from "bun:test";

import type { AgentSessionRef } from "./session-events.js";
import { createAgentTuiStore, renderAgentTuiFrame } from "./tui.js";

function createSupervisorSession(): AgentSessionRef {
  return {
    id: "supervisor",
    kind: "supervisor",
    rootSessionId: "supervisor",
    title: "Supervisor",
    workerId: "supervisor",
    workspacePath: "/Users/dpeek/code/io",
  };
}

function createWorkerSession(): AgentSessionRef {
  return {
    branchName: "ope-67",
    id: "worker:OPE-67:1",
    issue: {
      id: "issue-67",
      identifier: "OPE-67",
      title: "Implement io agent tui",
    },
    kind: "worker",
    parentSessionId: "supervisor",
    rootSessionId: "supervisor",
    title: "Implement io agent tui",
    workerId: "OPE-67",
    workspacePath: "/Users/dpeek/code/io/.io/tree/ope-67",
  };
}

test("AgentTuiStore keeps supervisor first and records status plus raw output", () => {
  const store = createAgentTuiStore();
  const supervisor = createSupervisorSession();
  const worker = createWorkerSession();

  store.observe({
    phase: "started",
    sequence: 1,
    session: supervisor,
    timestamp: "2026-03-10T02:00:00.000Z",
    type: "session",
  });
  store.observe({
    code: "ready",
    format: "line",
    sequence: 2,
    session: supervisor,
    text: "ready at /Users/dpeek/code/io",
    timestamp: "2026-03-10T02:00:01.000Z",
    type: "status",
  });
  store.observe({
    phase: "scheduled",
    sequence: 3,
    session: worker,
    timestamp: "2026-03-10T02:00:02.000Z",
    type: "session",
  });
  store.observe({
    code: "thread-started",
    format: "line",
    sequence: 4,
    session: worker,
    text: "Session started",
    timestamp: "2026-03-10T02:00:03.000Z",
    type: "status",
  });
  store.observe({
    code: "agent-message-delta",
    format: "chunk",
    itemId: "msg-1",
    sequence: 5,
    session: worker,
    text: "Inspecting ",
    timestamp: "2026-03-10T02:00:04.000Z",
    type: "status",
  });
  store.observe({
    code: "agent-message-delta",
    format: "chunk",
    itemId: "msg-1",
    sequence: 6,
    session: worker,
    text: "runtime state",
    timestamp: "2026-03-10T02:00:05.000Z",
    type: "status",
  });
  store.observe({
    code: "agent-message-completed",
    format: "close",
    itemId: "msg-1",
    sequence: 7,
    session: worker,
    timestamp: "2026-03-10T02:00:06.000Z",
    type: "status",
  });
  store.observe({
    encoding: "jsonl",
    line: '{"method":"thread/started"}',
    sequence: 8,
    session: worker,
    stream: "stdout",
    timestamp: "2026-03-10T02:00:07.000Z",
    type: "raw-line",
  });
  store.observe({
    encoding: "text",
    line: "stderr line",
    sequence: 9,
    session: worker,
    stream: "stderr",
    timestamp: "2026-03-10T02:00:08.000Z",
    type: "raw-line",
  });

  const snapshot = store.getSnapshot();
  expect(snapshot.sessions.map((session) => session.session.id)).toEqual([
    "supervisor",
    "worker:OPE-67:1",
  ]);
  expect(snapshot.sessions[0]?.body).toContain("Session started | /Users/dpeek/code/io");
  expect(snapshot.sessions[0]?.body).toContain("ready at /Users/dpeek/code/io\n");
  expect(snapshot.sessions[1]?.body).toContain(
    "Session scheduled | ope-67 | /Users/dpeek/code/io/.io/tree/ope-67\n",
  );
  expect(snapshot.sessions[1]?.body).toContain("Session started\n");
  expect(snapshot.sessions[1]?.body).toContain("Inspecting runtime state\n");
  expect(snapshot.sessions[1]?.body).toContain('jsonl: {"method":"thread/started"}\n');
  expect(snapshot.sessions[1]?.body).toContain("stderr: stderr line\n");
});

test("renderAgentTuiFrame lays out supervisor and worker columns", () => {
  const frame = renderAgentTuiFrame(
    {
      sessions: [
        {
          body: "Session started | /Users/dpeek/code/io\nready at /Users/dpeek/code/io\nNo issues\n",
          firstSequence: 1,
          lastSequence: 3,
          phase: "started",
          session: createSupervisorSession(),
        },
        {
          body:
            "Session scheduled | ope-67 | /Users/dpeek/code/io/.io/tree/ope-67\n" +
            "Session started\n" +
            'jsonl: {"method":"thread/started"}\n' +
            "stderr: stderr line\n",
          firstSequence: 4,
          lastSequence: 7,
          phase: "completed",
          session: createWorkerSession(),
        },
      ],
    },
    { columns: 80, rows: 8 },
  );

  const [firstLine] = frame.split("\n");
  expect(firstLine?.startsWith("Supervisor")).toBe(true);
  expect(firstLine).toContain("|OPE-67 Implement io agent tui");
  expect(frame).toContain("started");
  expect(frame).toContain("completed");
  expect(frame).toContain("No issues");
  expect(frame).toContain("stderr: stderr line");
});
