import type { TypeModuleMeta } from "@io/graph-module";
import { defineScalar } from "@io/graph-module";
import { defineScalarModule } from "@io/graph-module";

import { graphIconSeeds } from "../icon/seed.js";
import { expectStringInput } from "./input.js";
import { stringFilter } from "./string.js";

export const markdownMeta = {
  searchable: true,
  summary: {
    kind: "value",
    format: (value: string) => value,
  },
  display: {
    kind: "markdown",
    allowed: ["text", "markdown"] as const,
    format: (value: string) => value,
  },
  editor: {
    kind: "markdown",
    allowed: ["text", "textarea", "markdown"] as const,
    placeholder: "# Topic title",
    multiline: true,
  },
} satisfies TypeModuleMeta<
  string,
  readonly ["text", "markdown"],
  readonly ["text", "textarea", "markdown"]
>;

export const markdownType = defineScalar({
  values: { key: "core:markdown", name: "Markdown", icon: graphIconSeeds.markdown },
  encode: (value: string) => expectStringInput(value),
  decode: (raw) => raw,
});

export const markdownTypeModule = defineScalarModule({
  type: markdownType,
  meta: markdownMeta,
  filter: stringFilter,
});
