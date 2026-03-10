import { createTestRenderer } from "@opentui/core/testing";
import { expect, test } from "bun:test";

import type { AgentSessionRef } from "./session-events.js";
import { createAgentTuiStore } from "./store.js";
import { createAgentTui } from "./tui.js";

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
    branchName: "ope-68",
    id: "worker:OPE-68:1",
    issue: {
      id: "issue-68",
      identifier: "OPE-68",
      title: "Run plan",
    },
    kind: "worker",
    parentSessionId: "supervisor",
    rootSessionId: "supervisor",
    title: "Run plan",
    workerId: "OPE-68",
    workspacePath: "/Users/dpeek/code/io/.io/tree/ope-68",
  };
}

function createChildSession(): AgentSessionRef {
  return {
    id: "child:OPE-68:1",
    kind: "child",
    parentSessionId: "worker:OPE-68:1",
    rootSessionId: "supervisor",
    title: "Helper",
    workerId: "OPE-68",
    workspacePath: "/Users/dpeek/code/io/.io/tree/ope-68",
  };
}

test("AgentTuiStore tracks column hierarchy, summaries, and event history", () => {
  const store = createAgentTuiStore();
  const supervisor = createSupervisorSession();
  const worker = createWorkerSession();
  const child = createChildSession();

  store.observe({
    phase: "started",
    sequence: 1,
    session: supervisor,
    timestamp: "2026-03-10T02:00:00.000Z",
    type: "session",
  });
  store.observe({
    phase: "scheduled",
    sequence: 2,
    session: worker,
    timestamp: "2026-03-10T02:00:01.000Z",
    type: "session",
  });
  store.observe({
    code: "thread-started",
    format: "line",
    sequence: 3,
    session: worker,
    text: "Session started",
    timestamp: "2026-03-10T02:00:02.000Z",
    type: "status",
  });
  store.observe({
    phase: "started",
    sequence: 4,
    session: child,
    timestamp: "2026-03-10T02:00:03.000Z",
    type: "session",
  });
  store.observe({
    code: "tool",
    format: "line",
    sequence: 5,
    session: child,
    text: 'Tool: helper.spawn {"mode":"plan"}',
    timestamp: "2026-03-10T02:00:04.000Z",
    type: "status",
  });

  const snapshot = store.getSnapshot();
  const columns = snapshot.columns ?? [];
  expect(columns.map((column) => column.session.id)).toEqual([
    "supervisor",
    "worker:OPE-68:1",
    "child:OPE-68:1",
  ]);
  expect(columns[1]?.childSessionIds).toEqual(["child:OPE-68:1"]);
  expect(columns[2]?.parentSessionId).toBe("worker:OPE-68:1");
  expect(columns[2]?.status?.text).toBe('Tool: helper.spawn {"mode":"plan"}');
  expect(columns[2]?.eventHistory.at(-1)?.summary).toContain("tool");
  expect(columns[1]?.body).toContain("Session started\n");
});

test("createAgentTui renders placeholder columns with OpenTUI", async () => {
  const { captureCharFrame, renderOnce, renderer } = await createTestRenderer({
    height: 16,
    width: 96,
  });

  const tui = createAgentTui({
    renderer,
    requireTty: false,
  });
  const supervisor = createSupervisorSession();
  const worker = createWorkerSession();
  const child = createChildSession();

  try {
    await tui.start();
    tui.observe({
      phase: "started",
      sequence: 1,
      session: supervisor,
      timestamp: "2026-03-10T02:10:00.000Z",
      type: "session",
    });
    tui.observe({
      phase: "scheduled",
      sequence: 2,
      session: worker,
      timestamp: "2026-03-10T02:10:01.000Z",
      type: "session",
    });
    tui.observe({
      code: "thread-started",
      format: "line",
      sequence: 3,
      session: worker,
      text: "Session started",
      timestamp: "2026-03-10T02:10:02.000Z",
      type: "status",
    });
    tui.observe({
      phase: "started",
      sequence: 4,
      session: child,
      timestamp: "2026-03-10T02:10:03.000Z",
      type: "session",
    });
    tui.observe({
      code: "tool",
      format: "line",
      sequence: 5,
      session: child,
      text: "Tool: helper.spawn",
      timestamp: "2026-03-10T02:10:04.000Z",
      type: "status",
    });

    await Promise.resolve();
    await renderOnce();

    const frame = captureCharFrame();
    expect(frame).toContain("Supervisor");
    expect(frame).toContain("OPE-68 Run plan");
    expect(frame).toContain("Helper");
    expect(frame).toContain("Children:");
    expect(frame).toContain("Latest:");
    expect(frame).toContain("Transcript");
  } finally {
    await tui.stop();
    renderer.destroy();
  }
});
