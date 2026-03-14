import type { ComponentType } from "react";

import { CompanyProofPage } from "./company-proof.js";
import { CompanyQueryProofPage } from "./company-query-proof.js";
import { EnvVarSettingsPage } from "./env-vars.js";
import { Explorer } from "./explorer.js";
import { Outliner } from "./outliner.js";
import { RelationshipProofPage } from "./relationship-proof.js";

export type AppRouteKey =
  | "company"
  | "query"
  | "relationships"
  | "explorer"
  | "outliner"
  | "envVars";

export type AppRouteGroupKey = "proofs" | "tools" | "settings";

export type AppRouteDefinition = {
  readonly component: ComponentType;
  readonly description: string;
  readonly group: AppRouteGroupKey;
  readonly key: AppRouteKey;
  readonly label: string;
  readonly path: string;
  readonly shellClassName: string;
  readonly title: string;
};

export const appRouteGroups = [
  {
    key: "proofs",
    label: "Proofs",
  },
  {
    key: "tools",
    label: "Tools",
  },
  {
    key: "settings",
    label: "Settings",
  },
] as const satisfies readonly {
  readonly key: AppRouteGroupKey;
  readonly label: string;
}[];

export const appRoutes = [
  {
    component: CompanyProofPage,
    description:
      "Combined company, address, tags, and relationship editing in the core schema proof surface.",
    group: "proofs",
    key: "company",
    label: "Company",
    path: "/",
    shellClassName:
      "bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] text-slate-950",
    title: "Company proof",
  },
  {
    component: CompanyQueryProofPage,
    description: "Query composition proof for predicate-driven filters and lowered runtime plans.",
    group: "proofs",
    key: "query",
    label: "Query",
    path: "/query",
    shellClassName:
      "bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.16),_transparent_34%),linear-gradient(180deg,_#fafaf9_0%,_#e7e5e4_100%)] text-stone-950",
    title: "Company query builder",
  },
  {
    component: RelationshipProofPage,
    description:
      "Reference-aware editing for linked entities without collapsing into embedded object editing.",
    group: "proofs",
    key: "relationships",
    label: "Relationships",
    path: "/relationships",
    shellClassName:
      "bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#dbeafe_100%)] text-slate-950",
    title: "Relationship proof",
  },
  {
    component: Explorer,
    description:
      "Graph devtool for live entity data, compiled schema shape, and editable metadata.",
    group: "tools",
    key: "explorer",
    label: "Explorer",
    path: "/explorer",
    shellClassName:
      "bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-100",
    title: "Graph explorer",
  },
  {
    component: Outliner,
    description: "Keyboard-first outline editing proof wired directly to the synced graph runtime.",
    group: "tools",
    key: "outliner",
    label: "Outliner",
    path: "/outliner",
    shellClassName:
      "bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#111827_100%)] text-slate-100",
    title: "Outliner",
  },
  {
    component: EnvVarSettingsPage,
    description:
      "Operator settings for safe env-var metadata and authority-backed secret rotation.",
    group: "settings",
    key: "envVars",
    label: "Env vars",
    path: "/settings/env-vars",
    shellClassName:
      "bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.14),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] text-slate-950",
    title: "Environment variables",
  },
] as const satisfies readonly AppRouteDefinition[];

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
