import type { ReactElement } from "react";

import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";

const supportedPaths = ["/", "/query", "/workflow", "/graph", "/views", "/sync"] as const;

export async function renderWithRouterLocation(
  origin: string,
  pathname: (typeof supportedPaths)[number],
  input: ReactElement,
): Promise<string> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin } as Location,
  });

  try {
    const rootRoute = createRootRoute({ component: Outlet });
    const routeTree = rootRoute.addChildren(
      supportedPaths.map((path) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path,
          component: () => (path === pathname ? input : null),
        }),
      ),
    );
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: [pathname] }),
    });

    await router.load();
    return renderToStaticMarkup(<RouterProvider router={router} />);
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, "location", previous);
    } else {
      Reflect.deleteProperty(globalThis, "location");
    }
  }
}
