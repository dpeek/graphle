import type { TypeModuleFilter } from "@io/graph-module";
import type { TypeModuleMeta } from "@io/graph-module";
import { defineScalar } from "@io/graph-module";
import { defineScalarModule } from "@io/graph-module";

import { graphIconSeeds } from "../icon/seed.js";
import { expectUrlInput } from "./input.js";

function parseUrl(raw: string): URL {
  return new URL(raw);
}

export const urlFilter = {
  defaultOperator: "equals",
  operators: {
    equals: {
      label: "Equals",
      operand: {
        kind: "url",
        placeholder: "https://example.com",
      },
      parse: parseUrl,
      format: (operand: URL) => operand.toString(),
      test: (value: URL, operand: URL) => value.toString() === operand.toString(),
    },
    host: {
      label: "Host",
      operand: {
        kind: "string",
        placeholder: "example.com",
      },
      parse: (raw: string) => raw,
      format: (operand: string) => operand,
      test: (value: URL, operand: string) => value.host === operand,
    },
  },
} satisfies TypeModuleFilter<URL>;

export const urlMeta = {
  searchable: true,
  summary: {
    kind: "value",
    format: (value: URL) => value.toString(),
  },
  display: {
    kind: "link",
    allowed: ["link", "external-link", "text"] as const,
    format: (value: URL) => value.toString(),
  },
  editor: {
    kind: "url",
    allowed: ["url", "text"] as const,
    placeholder: "https://example.com",
  },
} satisfies TypeModuleMeta<
  URL,
  readonly ["link", "external-link", "text"],
  readonly ["url", "text"]
>;

export const urlType = defineScalar({
  values: { key: "core:url", name: "URL", icon: graphIconSeeds.url },
  encode: (value: URL) => expectUrlInput(value).toString(),
  decode: (raw) => new URL(raw),
});

export const urlTypeModule = defineScalarModule({
  type: urlType,
  meta: urlMeta,
  filter: urlFilter,
});
