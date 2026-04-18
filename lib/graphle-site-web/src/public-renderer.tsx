import { renderToStaticMarkup } from "react-dom/server";

import type { GraphlePublicSiteRuntime } from "./graph.js";
import { GraphleSitePreview } from "./site-feature.js";
import {
  findGraphleSiteItemView,
  listGraphleSiteItemViews,
  resolveGraphleSiteRoute,
  type GraphleSiteRoute,
  type GraphleSiteItemView,
} from "./site-items.js";
import type { GraphleSiteHealth, GraphleSiteSession } from "./status.js";

export interface PublicSiteRenderAssets {
  readonly scripts?: readonly string[];
  readonly styles?: readonly string[];
}

export interface RenderPublicSiteRouteOptions {
  readonly runtime: GraphlePublicSiteRuntime;
  readonly path: string;
  readonly assets?: PublicSiteRenderAssets;
  readonly health?: GraphleSiteHealth;
  readonly session?: GraphleSiteSession;
  readonly now?: () => Date;
}

export interface RenderedPublicSiteRoute {
  readonly html: string;
  readonly items: readonly GraphleSiteItemView[];
  readonly route: GraphleSiteRoute;
  readonly status: number;
  readonly title: string;
}

function routeTitle(route: GraphleSiteRoute, runtime: GraphlePublicSiteRuntime): string {
  if (route.kind !== "item") return "Page not found";
  return findGraphleSiteItemView(runtime, route.itemId)?.title ?? "Page not found";
}

export function renderPublicSiteRoute({
  runtime,
  path,
  health = {},
  session = { authenticated: false, session: null },
  now = () => new Date(),
}: RenderPublicSiteRouteOptions): RenderedPublicSiteRoute {
  const route = resolveGraphleSiteRoute(runtime, path);
  const items = listGraphleSiteItemViews(runtime);
  const title = routeTitle(route, runtime);
  const html = renderToStaticMarkup(
    <GraphleSitePreview
      path={path}
      runtime={runtime}
      status={{
        state: "ready",
        snapshot: {
          loadedAt: now().toISOString(),
          health,
          session,
          path,
        },
      }}
    />,
  );

  return {
    html,
    items,
    route,
    status: route.kind === "not-found" ? 404 : 200,
    title,
  };
}
