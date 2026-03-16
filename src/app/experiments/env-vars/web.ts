import { EnvVarSettingsPage } from "../../web/env-vars.js";
import { defineAppExperimentWeb } from "../contracts.js";
import { envVarsExperimentGraph } from "./graph.js";

const { description, key, label } = envVarsExperimentGraph;

export const envVarsExperimentWeb = defineAppExperimentWeb({
  key,
  label,
  description,
  routes: [
    {
      component: EnvVarSettingsPage,
      description:
        "Operator settings for safe env-var metadata and authority-backed secret rotation.",
      group: "settings",
      key: "envVars",
      label: "Env vars",
      path: "/settings/env-vars",
      shellClassName:
        "bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.14),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] text-slate-950",
      title: "Environment variables",
    },
  ],
});
