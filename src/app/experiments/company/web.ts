import { CompanyProofPage } from "../../web/company-proof.js";
import { CompanyQueryProofPage } from "../../web/company-query-proof.js";
import { RelationshipProofPage } from "../../web/relationship-proof.js";
import { defineAppExperimentWeb } from "../contracts.js";
import { companyExperimentGraph } from "./graph.js";

const { description, key, label } = companyExperimentGraph;

export const companyExperimentWeb = defineAppExperimentWeb({
  key,
  label,
  description,
  routes: [
    {
      component: CompanyProofPage,
      description:
        "Combined company, address, tags, and relationship editing in the core schema proof surface.",
      group: "proofs",
      key: "company",
      label: "Company",
      path: "/",
      shellClassName:
        "bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] text-slate-950",
      title: "Company proof",
    },
    {
      component: CompanyQueryProofPage,
      description:
        "Query composition proof for predicate-driven filters and lowered runtime plans.",
      group: "proofs",
      key: "query",
      label: "Query",
      path: "/query",
      shellClassName:
        "bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.16),_transparent_34%),linear-gradient(180deg,_#fafaf9_0%,_#e7e5e4_100%)] text-stone-950",
      title: "Company query builder",
    },
    {
      component: RelationshipProofPage,
      description:
        "Reference-aware editing for linked entities without collapsing into embedded object editing.",
      group: "proofs",
      key: "relationships",
      label: "Relationships",
      path: "/relationships",
      shellClassName:
        "bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#dbeafe_100%)] text-slate-950",
      title: "Relationship proof",
    },
  ],
});
