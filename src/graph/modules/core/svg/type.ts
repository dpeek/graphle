import { defineScalar } from "@io/graph-module";

import { graphIconSeeds } from "../icon/seed.js";
import { expectStringInput } from "../input.js";

export const svgType = defineScalar({
  values: { key: "core:svg", name: "SVG", icon: graphIconSeeds.svg },
  encode: (value: string) => expectStringInput(value),
  decode: (raw) => raw,
});
