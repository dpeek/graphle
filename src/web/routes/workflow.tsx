import { createFileRoute } from "@tanstack/react-router";

import { WorkflowPage } from "../components/workflow-page";

function WorkflowRoute() {
  return <WorkflowPage />;
}

export const Route = createFileRoute("/workflow")({
  component: WorkflowRoute,
});
