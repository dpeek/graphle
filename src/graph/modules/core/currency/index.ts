import { defineEnum } from "@io/graph-module";
import { defineDefaultEnumTypeModule } from "@io/graph-module";

import { currencyOptions } from "./data.js";

export const currency = defineEnum({
  values: { key: "core:currency", name: "Country" },
  options: currencyOptions,
});

export const currencyTypeModule = defineDefaultEnumTypeModule(currency);
