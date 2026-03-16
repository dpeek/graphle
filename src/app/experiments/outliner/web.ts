import { Outliner } from "../../web/outliner.js";
import { defineAppExperimentWeb } from "../contracts.js";
import { outlinerExperimentGraph } from "./graph.js";

const { description, key, label } = outlinerExperimentGraph;

export const outlinerExperimentWeb = defineAppExperimentWeb({
  key,
  label,
  description,
  routes: [
    {
      component: Outliner,
      description:
        "Keyboard-first outline editing proof wired directly to the synced graph runtime.",
      group: "tools",
      key: "outliner",
      label: "Outliner",
      path: "/outliner",
      shellClassName:
        "bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#111827_100%)] text-slate-100",
      title: "Outliner",
    },
  ],
});
