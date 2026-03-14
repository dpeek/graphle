import { useEffect, useSyncExternalStore, type MouseEvent } from "react";

import {
  appRouteGroups,
  appRoutes,
  getAppRoute,
  getLegacyAppRoute,
  hrefForAppRoute,
  resolveAppRoute,
  type AppRouteDefinition,
  type AppRouteKey,
} from "./routes.js";

export type AppLocationSnapshot = {
  readonly hash: string;
  readonly pathname: string;
  readonly search: string;
};

export type AppBrowser = {
  getSnapshot(): string;
  push(url: string): void;
  replace(url: string): void;
  subscribe(listener: () => void): () => void;
};

function readWindowLocation(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function parseLocationSnapshot(snapshot: string): AppLocationSnapshot {
  const location = new URL(snapshot, "https://io.test");
  return {
    hash: location.hash,
    pathname: location.pathname,
    search: location.search,
  };
}

function emitLocationChange(): void {
  window.dispatchEvent(new Event("popstate"));
}

const windowAppBrowser: AppBrowser = {
  getSnapshot: readWindowLocation,
  push(url) {
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` === url)
      return;
    window.history.pushState(window.history.state, "", url);
    emitLocationChange();
  },
  replace(url) {
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` === url)
      return;
    window.history.replaceState(window.history.state, "", url);
    emitLocationChange();
  },
  subscribe(listener) {
    window.addEventListener("popstate", listener);
    return () => {
      window.removeEventListener("popstate", listener);
    };
  },
};

function buildCanonicalAppUrl(location: AppLocationSnapshot, route: AppRouteKey): string {
  const params = new URLSearchParams(location.search);
  params.delete("surface");
  const nextSearch = params.toString();
  return `${hrefForAppRoute(route)}${nextSearch ? `?${nextSearch}` : ""}${location.hash}`;
}

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}

function NavLink({
  active,
  browser,
  route,
}: {
  active: boolean;
  browser: AppBrowser;
  route: AppRouteDefinition;
}) {
  return (
    <a
      className={
        "rounded-full border px-3 py-1.5 text-sm transition " +
        (active
          ? "border-cyan-300/40 bg-cyan-400/15 text-white"
          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white")
      }
      data-app-shell-link={route.key}
      href={route.path}
      onClick={(event) => {
        if (!isPlainLeftClick(event)) return;
        event.preventDefault();
        browser.push(route.path);
      }}
    >
      {route.label}
    </a>
  );
}

export function AppShell({ browser = windowAppBrowser }: { browser?: AppBrowser }) {
  const location = parseLocationSnapshot(
    useSyncExternalStore(browser.subscribe, browser.getSnapshot, browser.getSnapshot),
  );
  const routeKey = resolveAppRoute(location);
  const route = getAppRoute(routeKey);
  const Screen = route.component;

  useEffect(() => {
    if (!getLegacyAppRoute(location.search)) return;
    const canonicalUrl = buildCanonicalAppUrl(location, routeKey);
    const currentUrl = `${location.pathname}${location.search}${location.hash}`;
    if (canonicalUrl === currentUrl) return;
    browser.replace(canonicalUrl);
  }, [browser, location.hash, location.pathname, location.search, routeKey]);

  return (
    <div className={`min-h-screen ${route.shellClassName}`} data-app-shell-route={route.key}>
      <header className="border-b border-white/10 bg-slate-950/80 text-slate-100 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs tracking-[0.28em] text-cyan-300 uppercase">IO app shell</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">{route.title}</h1>
              <p className="mt-1 text-sm text-slate-300">{route.description}</p>
            </div>
            <p className="max-w-sm text-sm text-slate-400">
              Registered routes own the shared shell, navigation, and canonical browser paths.
            </p>
          </div>
          <nav className="grid gap-3 md:grid-cols-3">
            {appRouteGroups.map((group) => {
              const routes = appRoutes.filter((routeEntry) => routeEntry.group === group.key);
              return (
                <section
                  className="rounded-[1.4rem] border border-white/10 bg-white/5 p-3"
                  data-app-shell-group={group.key}
                  key={group.key}
                >
                  <p className="text-xs tracking-[0.22em] text-slate-400 uppercase">
                    {group.label}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {routes.map((routeEntry) => (
                      <NavLink
                        active={routeEntry.key === route.key}
                        browser={browser}
                        key={routeEntry.key}
                        route={routeEntry}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="px-4 py-6 sm:px-6 sm:py-8">
        <Screen />
      </main>
    </div>
  );
}

export function createTestAppBrowser(initialUrl: string): AppBrowser & { url(): string } {
  const listeners = new Set<() => void>();
  let location = new URL(initialUrl, "https://io.test");

  function publish(): void {
    for (const listener of listeners) listener();
  }

  function update(url: string): void {
    location = new URL(url, location);
    publish();
  }

  return {
    getSnapshot() {
      return `${location.pathname}${location.search}${location.hash}`;
    },
    push(url) {
      update(url);
    },
    replace(url) {
      update(url);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    url() {
      return `${location.pathname}${location.search}${location.hash}`;
    },
  };
}
