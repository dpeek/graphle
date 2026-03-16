import type { NamespaceClient } from "@io/core/graph";

import ids from "../../graph/app.json";
import { statusTypeModule } from "../../type/status/index.js";
import type { companyExperimentSchema } from "./graph.js";

type CompanyExperimentClient = NamespaceClient<typeof companyExperimentSchema>;
const activeStatusId = ids.keys[statusTypeModule.type.values.active.key];
const pausedStatusId = ids.keys[statusTypeModule.type.values.paused.key];

export type CompanyExperimentIds = {
  readonly acme: string;
  readonly alice: string;
  readonly atlas: string;
  readonly estii: string;
};

export function seedCompanyExperiment(graph: CompanyExperimentClient): CompanyExperimentIds {
  const acme = graph.company.create({
    name: "Acme Corp",
    status: activeStatusId,
    foundedYear: 1987,
    createdAt: new Date(),
    website: new URL("https://acme.com"),
    tags: ["enterprise", "saas"],
    address: {
      address_line1: "200 George St",
      locality: "Sydney",
      postal_code: "2000",
    },
  });

  const estii = graph.company.create({
    name: "Estii",
    status: pausedStatusId,
    website: new URL("https://estii.com"),
  });

  const atlas = graph.company.create({
    name: "Atlas Labs",
    status: activeStatusId,
    foundedYear: 2015,
    website: new URL("https://atlas.io"),
  });

  const alice = graph.person.create({
    name: "Alice",
    worksAt: [acme],
  });

  graph.company.node(acme).update({
    tags: ["enterprise", "ai"],
  });

  return {
    acme,
    alice,
    atlas,
    estii,
  };
}
