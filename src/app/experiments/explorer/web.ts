import { Explorer } from "../../web/explorer.js";
import { defineAppExperimentWeb } from "../contracts.js";

export const explorerExperimentWeb = defineAppExperimentWeb({
  key: "graphExplorer",
  label: "Graph explorer",
  description: "Graph devtools over the shared synced runtime and compiled app schema.",
  routes: [
    {
      component: Explorer,
      description:
        "Graph devtool for live entity data, compiled schema shape, and editable metadata.",
      group: "tools",
      key: "explorer",
      label: "Explorer",
      path: "/explorer",
      shellClassName:
        "bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-100",
      title: "Graph explorer",
    },
  ],
});
