export type AppRouteKey =
  | "company"
  | "query"
  | "relationships"
  | "explorer"
  | "outliner"
  | "envVars";

const routePathByKey: Record<AppRouteKey, string> = {
  company: "/",
  query: "/query",
  relationships: "/relationships",
  explorer: "/explorer",
  outliner: "/outliner",
  envVars: "/settings/env-vars",
};

const legacySurfaceToRoute: Record<string, AppRouteKey> = {
  company: "company",
  query: "query",
  relationships: "relationships",
  explorer: "explorer",
  outliner: "outliner",
  "env-vars": "envVars",
};

export function hrefForAppRoute(route: AppRouteKey): string {
  return routePathByKey[route];
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function resolveAppRoute(input: {
  readonly pathname: string;
  readonly search?: string;
}): AppRouteKey {
  const params = new URLSearchParams(input.search ?? "");
  const legacySurface = params.get("surface");
  if (legacySurface) return legacySurfaceToRoute[legacySurface] ?? "company";

  const pathname = normalizePathname(input.pathname);
  const routeByPath = (Object.entries(routePathByKey) as [AppRouteKey, string][])
    .find((entry) => entry[1] === pathname)?.[0];
  if (routeByPath) return routeByPath;
  return "company";
}
