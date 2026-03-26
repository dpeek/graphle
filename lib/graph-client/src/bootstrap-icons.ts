import type { AnyTypeOutput, EdgeOutput } from "@io/graph-kernel";

type DefinitionIconRef = string | { id: string };

export type GraphIconSeed = Readonly<{
  id: string;
  key: string;
  name: string;
  svg: string;
}>;

const booleanSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M9 11l3 3 10-10" />
  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>`;
const colorSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="16" height="6" rx="2" x="2" y="2" />
  <path d="M10 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
  <rect width="4" height="6" rx="1" x="8" y="16" />
</svg>`;
const countrySvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M21.54 15H17a2 2 0 0 0-2 2v4.54" />
  <path d="M7 3.34V5a3 3 0 0 0 3 3v0a2 2 0 0 1 2 2v0c0 1.1 0.9 2 2 2v0a2 2 0 0 0 2-2v0c0-1.1 0.9-2 2-2h3.17" />
  <path d="M11 21.95V18a2 2 0 0 0-2-2v0a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05" />
  <circle cx="12" cy="12" r="10" />
</svg>`;
const dateSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M8 2v4" />
  <path d="M16 2v4" />
  <rect width="18" height="18" rx="2" x="3" y="4" />
  <path d="M3 10h18" />
</svg>`;
const edgeSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="6" height="6" rx="1" x="16" y="16" />
  <rect width="6" height="6" rx="1" x="2" y="16" />
  <rect width="6" height="6" rx="1" x="9" y="2" />
  <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
  <path d="M12 12V8" />
</svg>`;
const emailSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="20" height="16" rx="2" x="2" y="4" />
  <path d="M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
</svg>`;
const enumSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="7" height="7" rx="1" x="3" y="3" />
  <rect width="7" height="7" rx="1" x="3" y="14" />
  <path d="M14 4h7" />
  <path d="M14 9h7" />
  <path d="M14 15h7" />
  <path d="M14 20h7" />
</svg>`;
const iconSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  <circle cx="10" cy="8" r="2" />
  <path d="M20 13.7l-2.1-2.1c-0.8-0.8-2-0.8-2.8 0L9.7 17" />
</svg>`;
const jsonSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
  <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  <path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1" />
  <path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1" />
</svg>`;
const localeSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M5 8l6 6" />
  <path d="M4 14l6-6 2-3" />
  <path d="M2 5h12" />
  <path d="M7 2h1" />
  <path d="M22 22 17 12 12 22" />
  <path d="M14 18h6" />
</svg>`;
const markdownSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <line x1="4" x2="20" y1="9" y2="9" />
  <line x1="4" x2="20" y1="15" y2="15" />
  <line x1="10" x2="8" y1="3" y2="21" />
  <line x1="16" x2="14" y1="3" y2="21" />
</svg>`;
const numberSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M12 3v18" />
  <rect width="18" height="18" rx="2" x="3" y="3" />
  <path d="M3 9h18" />
  <path d="M3 15h18" />
</svg>`;
const secretSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
  <circle cx="10" cy="16" r="2" />
  <path d="M16 10l-4.5 4.5" />
  <path d="M15 11l1 1" />
</svg>`;
const slugSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M22 17v1c0 0.5-0.5 1-1 1H3c-0.5 0-1-0.5-1-1v-1" />
</svg>`;
const stringSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M17 6.1H3" />
  <path d="M21 12.1H3" />
  <path d="M15.1 18H3" />
</svg>`;
const svgSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M18 16l4-4-4-4" />
  <path d="M6 8 2 12l4 4" />
  <path d="M14.5 4l-5 16" />
</svg>`;
const tagSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 0.586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
  <circle fill="currentColor" cx="7.5" cy="7.5" r="0.5" />
</svg>`;
const unknownSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M12 17h0.01" />
  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
  <path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3" />
</svg>`;
const urlSvg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M15 3h6v6" />
  <path d="M10 14 21 3" />
  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
</svg>`;

function normalizeSeedSvg(svg: string): string {
  return svg.trim().length > 0 ? svg : unknownSvg;
}

function defineGraphIconSeed(alias: string, input: { name: string; svg: string }): GraphIconSeed {
  return Object.freeze({
    id: `seed:icon:${alias}`,
    key: alias,
    name: input.name,
    svg: normalizeSeedSvg(input.svg),
  });
}

export const graphIconSeeds = {
  boolean: defineGraphIconSeed("boolean", { name: "Boolean", svg: booleanSvg }),
  color: defineGraphIconSeed("color", { name: "Color", svg: colorSvg }),
  country: defineGraphIconSeed("country", { name: "Country", svg: countrySvg }),
  date: defineGraphIconSeed("date", { name: "Date", svg: dateSvg }),
  edge: defineGraphIconSeed("edge", { name: "Edge", svg: edgeSvg }),
  email: defineGraphIconSeed("email", { name: "Email", svg: emailSvg }),
  enum: defineGraphIconSeed("enum", { name: "Enum", svg: enumSvg }),
  icon: defineGraphIconSeed("icon", { name: "Icon", svg: iconSvg }),
  json: defineGraphIconSeed("json", { name: "JSON", svg: jsonSvg }),
  locale: defineGraphIconSeed("locale", { name: "Locale", svg: localeSvg }),
  markdown: defineGraphIconSeed("markdown", { name: "Markdown", svg: markdownSvg }),
  number: defineGraphIconSeed("number", { name: "Number", svg: numberSvg }),
  secret: defineGraphIconSeed("secret", { name: "Secret", svg: secretSvg }),
  slug: defineGraphIconSeed("slug", { name: "Slug", svg: slugSvg }),
  string: defineGraphIconSeed("string", { name: "String", svg: stringSvg }),
  svg: defineGraphIconSeed("svg", { name: "SVG", svg: svgSvg }),
  tag: defineGraphIconSeed("tag", { name: "Tag", svg: tagSvg }),
  unknown: defineGraphIconSeed("unknown", { name: "Unknown", svg: unknownSvg }),
  url: defineGraphIconSeed("url", { name: "URL", svg: urlSvg }),
} as const;

export const graphIconSeedList = Object.values(graphIconSeeds);

function isDefinitionIconObject(value: DefinitionIconRef | undefined): value is { id: string } {
  return typeof value === "object" && value !== null && typeof value.id === "string";
}

export function resolveDefinitionIconId(value: DefinitionIconRef | undefined): string {
  if (typeof value === "string" && value.length > 0) return value;
  if (isDefinitionIconObject(value) && value.id.length > 0) return value.id;
  return graphIconSeeds.unknown.id;
}

export function resolveTypeDefinitionIconId(
  typeDef: Pick<AnyTypeOutput, "kind" | "values">,
): string {
  if (typeDef.values.icon) return resolveDefinitionIconId(typeDef.values.icon);
  if (typeDef.kind === "enum") return graphIconSeeds.tag.id;
  return graphIconSeeds.unknown.id;
}

export function resolvePredicateDefinitionIconId(
  predicateDef: Pick<EdgeOutput, "icon" | "range">,
  rangeType?: Pick<AnyTypeOutput, "kind" | "values">,
): string {
  if (predicateDef.icon) return resolveDefinitionIconId(predicateDef.icon);
  if (rangeType?.kind === "entity") return graphIconSeeds.edge.id;
  if (rangeType) return resolveTypeDefinitionIconId(rangeType);
  return graphIconSeeds.unknown.id;
}
