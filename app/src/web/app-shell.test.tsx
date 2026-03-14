import { describe, expect, it } from "bun:test";

import { act, create, type ReactTestInstance } from "react-test-renderer";

import { createExampleRuntime } from "../graph/runtime.js";
import { AppShell, createTestAppBrowser } from "./app-shell.js";
import { AppRuntimeBootstrap, type AppRuntime } from "./runtime.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

async function renderShell(url: string) {
  const browser = createTestAppBrowser(url);
  let renderer: ReturnType<typeof create> | undefined;

  await act(async () => {
    renderer = create(
      <AppRuntimeBootstrap
        loadRuntime={() => Promise.resolve(createExampleRuntime() as AppRuntime)}
        renderApp={() => <AppShell browser={browser} />}
      />,
    );
  });

  return {
    browser,
    renderer: renderer!,
  };
}

function clickNavLink(node: ReactTestInstance): void {
  act(() => {
    node.props.onClick({
      altKey: false,
      button: 0,
      ctrlKey: false,
      defaultPrevented: false,
      metaKey: false,
      preventDefault() {},
      shiftKey: false,
    });
  });
}

describe("app shell", () => {
  it("canonicalizes legacy surface URLs onto shared route paths", async () => {
    const { browser, renderer } = await renderShell("/?surface=env-vars&mode=demo#details");

    expect(browser.url()).toBe("/settings/env-vars?mode=demo#details");
    expect(renderer.root.findByProps({ "data-app-shell-route": "envVars" })).toBeDefined();

    act(() => {
      renderer.unmount();
    });
  });

  it("navigates between registered routes from the shared shell", async () => {
    const { browser, renderer } = await renderShell("/settings/env-vars");

    const queryLink = renderer.root.findByProps({ "data-app-shell-link": "query" });
    clickNavLink(queryLink);

    expect(browser.url()).toBe("/query");
    expect(renderer.root.findByProps({ "data-app-shell-route": "query" })).toBeDefined();
    expect(renderer.root.findByProps({ "data-company-query-match-count": "" })).toBeDefined();

    act(() => {
      renderer.unmount();
    });
  });
});
