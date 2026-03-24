import { createFileRoute } from "@tanstack/react-router";

import { ViewsPage } from "../components/views-page";

function ViewsRoute() {
  return <ViewsPage />;
}

export const Route = createFileRoute("/views")({
  component: ViewsRoute,
});
