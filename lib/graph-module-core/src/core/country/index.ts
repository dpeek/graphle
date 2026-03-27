import { defineEnum } from "@io/graph-module";
import { defineDefaultEnumTypeModule } from "@io/graph-module";

import { graphIconSeeds } from "../icon/seed.js";
import { countryOptions } from "./data.js";

export const country = defineEnum({
  values: { key: "core:country", name: "Country", icon: graphIconSeeds.country },
  options: countryOptions,
});

export const countryTypeModule = defineDefaultEnumTypeModule(country);
