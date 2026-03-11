import { describe, expect, it } from "bun:test";
import { act, create, type ReactTestInstance } from "react-test-renderer";

import { createExampleRuntime } from "../graph/runtime.js";

import { AppRuntimeBootstrap, type AppRuntime, useAppRuntime } from "./runtime.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function createDeferred<TValue>() {
  let resolve!: (value: TValue) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<TValue>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return {
    promise,
    reject,
    resolve,
  };
}

function collectText(node: ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === "string" ? child : collectText(child)))
    .join(" ");
}

function RuntimeProbe() {
  const runtime = useAppRuntime();
  return (
    <div data-app-bootstrap="ready">
      {runtime.graph.company.list().map((company) => company.name).join(", ")}
    </div>
  );
}

describe("app runtime bootstrap", () => {
  it("shows loading until the shared runtime has completed its initial sync", async () => {
    const deferred = createDeferred<AppRuntime>();
    let renderer: ReturnType<typeof create> | undefined;

    await act(async () => {
      renderer = create(
        <AppRuntimeBootstrap
          config={{ syncUrl: "http://app.local/api/sync" }}
          loadRuntime={() => deferred.promise}
          renderApp={() => <RuntimeProbe />}
        />,
      );
    });

    expect(renderer!.root.findByProps({ "data-app-bootstrap": "loading" })).toBeDefined();
    expect(
      renderer!.root.findAll((node) => node.props["data-app-bootstrap"] === "ready"),
    ).toHaveLength(0);

    await act(async () => {
      deferred.resolve(createExampleRuntime() as AppRuntime);
      await deferred.promise;
    });

    expect(renderer!.root.findByProps({ "data-app-bootstrap": "ready" }).children.join("")).toContain(
      "Acme Corp",
    );

    act(() => {
      renderer?.unmount();
    });
  });

  it("renders an error state when the initial sync fails", async () => {
    const deferred = createDeferred<AppRuntime>();
    let renderer: ReturnType<typeof create> | undefined;

    await act(async () => {
      renderer = create(
        <AppRuntimeBootstrap
          config={{ syncUrl: "http://app.local/api/sync" }}
          loadRuntime={() => deferred.promise}
          renderApp={() => <RuntimeProbe />}
        />,
      );
    });

    await act(async () => {
      deferred.reject(new Error("authority offline"));
      try {
        await deferred.promise;
      } catch {
        // The component owns the visible error state.
      }
    });

    const errorState = renderer!.root.findByProps({ "data-app-bootstrap": "error" });
    expect(errorState).toBeDefined();
    expect(collectText(errorState)).toContain("authority offline");

    act(() => {
      renderer?.unmount();
    });
  });
});
