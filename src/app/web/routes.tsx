import {
  appRouteGroups,
  appRoutes,
  type AppRouteDefinition,
  type AppRouteGroupKey,
  type AppRouteKey,
} from "../experiments/web.js";

export { appRouteGroups, appRoutes };
export type { AppRouteDefinition, AppRouteGroupKey, AppRouteKey };

const routeByKey = new Map<AppRouteKey, AppRouteDefinition>(
  appRoutes.map((route) => [route.key, route]),
);
const routeByPath = new Map<string, AppRouteKey>(appRoutes.map((route) => [route.path, route.key]));

const legacySurfaceToRoute: Record<string, AppRouteKey> = {
  "env-vars": "envVars",
};

export function getAppRoute(route: AppRouteKey): AppRouteDefinition {
  const definition = routeByKey.get(route);
  if (!definition) throw new Error(`Unknown app route "${route}".`);
  return definition;
}

export function getLegacyAppRoute(search?: string): AppRouteKey | undefined {
  const params = new URLSearchParams(search ?? "");
  const legacySurface = params.get("surface");
  if (!legacySurface) return undefined;
  return legacySurfaceToRoute[legacySurface];
}

export function hrefForAppRoute(route: AppRouteKey): string {
  return getAppRoute(route).path;
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function resolveAppRoute(input: {
  readonly pathname: string;
  readonly search?: string;
}): AppRouteKey {
  const pathname = normalizePathname(input.pathname);
  const pathnameRoute = routeByPath.get(pathname);
  if (pathnameRoute && pathname !== "/") return pathnameRoute;

  const legacyRoute = getLegacyAppRoute(input.search);
  if (legacyRoute) return legacyRoute;

  return pathnameRoute ?? "company";
}
