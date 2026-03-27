import { sanitizeSvgMarkup } from "@io/core/graph";
import { defineType } from "@io/graph-module";

import { node } from "../node/index.js";
import { slugTypeModule } from "../slug/index.js";
import { svgTypeModule } from "../svg/index.js";
import { graphIconSeeds } from "./seed.js";

function normalizeSvgMarkup(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const result = sanitizeSvgMarkup(value);
  return result.ok ? result.svg : value;
}

function validateSvgMarkup(input: { value: unknown }) {
  if (typeof input.value !== "string") return undefined;
  const result = sanitizeSvgMarkup(input.value);
  return result.ok ? undefined : result.issues;
}

export const icon = defineType({
  values: { key: "core:icon", name: "Icon", icon: graphIconSeeds.icon },
  fields: {
    ...node.fields,
    key: slugTypeModule.field({
      cardinality: "one",
      icon: graphIconSeeds.string,
      meta: {
        label: "Key",
      },
      filter: {
        operators: ["equals", "prefix"] as const,
        defaultOperator: "equals",
      },
    }),
    svg: svgTypeModule.field({
      cardinality: "one",
      meta: {
        label: "SVG",
      },
      onCreate: ({ incoming }) => normalizeSvgMarkup(incoming),
      onUpdate: ({ incoming }) => normalizeSvgMarkup(incoming),
      validate: ({ value }) => validateSvgMarkup({ value }),
    }),
  },
});
