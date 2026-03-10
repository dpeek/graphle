import {
  BoxRenderable,
  TextRenderable,
  createCliRenderer,
  type CliRenderer,
} from "@opentui/core";

import { buildAgentTuiRootComponentModel } from "./layout.js";
import type { AgentSessionEventObserver } from "./session-events.js";
import {
  createAgentTuiStore,
  type AgentTuiSnapshot,
  type AgentTuiStore,
  type AgentTuiStoreOptions,
} from "./store.js";

const APP_ROOT_ID = "agent-tui-root";

export type AgentTuiTerminal = NodeJS.WriteStream;

export interface AgentTuiOptions extends AgentTuiStoreOptions {
  input?: NodeJS.ReadStream;
  output?: AgentTuiTerminal;
  renderer?: CliRenderer;
  requireTty?: boolean;
  store?: AgentTuiStore;
}

export interface AgentTui {
  getSnapshot(): AgentTuiSnapshot;
  observe: AgentSessionEventObserver;
  start(): Promise<void>;
  stop(): Promise<void>;
}

type AgentTuiRenderableView = {
  destroy: () => void;
  render: (snapshot: AgentTuiSnapshot) => void;
};

function createTranscriptContent(title: string, content: string) {
  return `${title}\n\n${content}`;
}

function createColumnRenderable(
  renderer: CliRenderer,
  model: ReturnType<typeof buildAgentTuiRootComponentModel>["columns"][number],
) {
  const box = new BoxRenderable(renderer, {
    border: true,
    borderStyle: "single",
    flexBasis: 0,
    flexDirection: "column",
    flexGrow: 1,
    height: "100%",
    id: `column:${model.id}`,
    minWidth: 24,
    paddingX: 1,
    title: model.title,
  });

  box.add(
    new TextRenderable(renderer, {
      content: [model.metaLine, model.statusLine, model.parentLine, model.childrenLine].join("\n"),
      id: `summary:${model.id}`,
      wrapMode: "char",
    }),
  );
  box.add(
    new TextRenderable(renderer, {
      content: `${model.latestEventLine}\n`,
      id: `latest:${model.id}`,
      marginTop: 1,
      wrapMode: "char",
    }),
  );
  box.add(
    new TextRenderable(renderer, {
      content: createTranscriptContent("Transcript", model.transcript),
      flexGrow: 1,
      id: `transcript:${model.id}`,
      marginTop: 1,
      wrapMode: "char",
    }),
  );

  return box;
}

function createAgentTuiRenderableView(renderer: CliRenderer): AgentTuiRenderableView {
  const removeRoot = () => {
    if (!renderer.root.findDescendantById(APP_ROOT_ID)) {
      return;
    }
    renderer.root.remove(APP_ROOT_ID);
  };

  return {
    destroy() {
      removeRoot();
      renderer.requestRender();
    },
    render(snapshot) {
      removeRoot();
      const layout = buildAgentTuiRootComponentModel(snapshot);
      const root = new BoxRenderable(renderer, {
        flexDirection: "row",
        gap: 1,
        height: "100%",
        id: APP_ROOT_ID,
        width: "100%",
      });
      for (const column of layout.columns) {
        root.add(createColumnRenderable(renderer, column));
      }
      renderer.root.add(root);
      renderer.requestRender();
    },
  };
}

export function createAgentTui(options: AgentTuiOptions = {}): AgentTui {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const requireTty = options.requireTty ?? true;
  const store =
    options.store ??
    createAgentTuiStore({
      maxEventHistory: options.maxEventHistory,
      maxTranscriptChars: options.maxTranscriptChars,
    });
  let active = false;
  let renderScheduled = false;
  let renderer = options.renderer;
  let startPromise: Promise<void> | undefined;
  let unsubscribe: (() => void) | undefined;
  let view: AgentTuiRenderableView | undefined;

  const ownsRenderer = !options.renderer;

  const render = () => {
    renderScheduled = false;
    if (!active || !view) {
      return;
    }
    view.render(store.getSnapshot());
  };

  const scheduleRender = () => {
    if (!active || renderScheduled) {
      return;
    }
    renderScheduled = true;
    queueMicrotask(render);
  };

  const ensureStarted = async () => {
    if (startPromise) {
      await startPromise;
      return;
    }

    startPromise = (async () => {
      if (!renderer) {
        if (requireTty && !output.isTTY) {
          throw new Error("io agent tui requires a TTY");
        }
        renderer = await createCliRenderer({
          autoFocus: false,
          exitOnCtrlC: false,
          stdin: input,
          stdout: output,
          useAlternateScreen: true,
          useConsole: false,
          useMouse: false,
        });
      }

      view = createAgentTuiRenderableView(renderer);
      if (ownsRenderer) {
        renderer.start();
      }
      view.render(store.getSnapshot());
    })();

    try {
      await startPromise;
    } catch (error) {
      startPromise = undefined;
      throw error;
    }
  };

  return {
    getSnapshot() {
      return store.getSnapshot();
    },
    observe(event) {
      store.observe(event);
    },
    async start() {
      if (active) {
        await ensureStarted();
        return;
      }
      active = true;
      unsubscribe = store.subscribe(scheduleRender);
      try {
        await ensureStarted();
      } catch (error) {
        active = false;
        unsubscribe?.();
        unsubscribe = undefined;
        throw error;
      }
    },
    async stop() {
      if (!active && !startPromise) {
        return;
      }
      active = false;
      renderScheduled = false;
      unsubscribe?.();
      unsubscribe = undefined;

      try {
        await startPromise;
      } catch {
        // Ignore startup failures while tearing down the wrapper.
      }

      view?.destroy();
      view = undefined;
      startPromise = undefined;

      if (renderer && ownsRenderer) {
        renderer.destroy();
        renderer = undefined;
      }
    },
  };
}
