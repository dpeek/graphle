import type { TypeModuleMeta } from "@io/graph-module";
import { defineScalar } from "@io/graph-module";
import { defineScalarModule } from "@io/graph-module";

import { graphIconSeeds } from "../icon/seed.js";
import { expectStringInput } from "./input.js";
import { stringFilter } from "./string.js";

export const svgMeta = {
  searchable: false,
  summary: {
    kind: "value",
    format: (value: string) => value,
  },
  display: {
    kind: "svg",
    allowed: ["text", "svg"] as const,
    format: (value: string) => value,
  },
  editor: {
    kind: "svg",
    allowed: ["text", "textarea", "svg"] as const,
    placeholder: '<svg viewBox="0 0 24 24">...</svg>',
    multiline: true,
  },
} satisfies TypeModuleMeta<string, readonly ["text", "svg"], readonly ["text", "textarea", "svg"]>;

export const svgType = defineScalar({
  values: { key: "core:svg", name: "SVG", icon: graphIconSeeds.svg },
  encode: (value: string) => expectStringInput(value),
  decode: (raw) => raw,
});

export const svgTypeModule = defineScalarModule({
  type: svgType,
  meta: svgMeta,
  filter: stringFilter,
});
