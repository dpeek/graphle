import { type AnyTypeOutput } from "@dpeek/graphle-app/graph";
import { buildEntityCreateDefaults } from "@dpeek/graphle-surface";
import { setDraftValue } from "@dpeek/graphle-react";

import type { EntityCatalogEntry } from "./model.js";

const defaultTagColors = [
  "#2563eb",
  "#0f766e",
  "#d97706",
  "#be123c",
  "#7c3aed",
  "#0891b2",
] as const;

export function buildCreateDefaults(
  entry: EntityCatalogEntry,
  typeById: ReadonlyMap<string, AnyTypeOutput>,
): Record<string, unknown> {
  const defaults = buildEntityCreateDefaults(
    entry.typeDef.fields as Record<string, unknown>,
    typeById,
  );

  if (entry.key === "workflow:documentBlock" || entry.key === "workflow:documentPlacement") {
    return setDraftValue(defaults, [], "order", entry.count);
  }

  if (entry.key === "core:tag") {
    return setDraftValue(
      defaults,
      [],
      "color",
      defaultTagColors[entry.count % defaultTagColors.length] ?? defaultTagColors[0],
    );
  }

  return defaults;
}
