import { createFileRoute } from "@tanstack/react-router";

import { QueryPage } from "../components/query-page.js";
import { validateQueryRouteSearch } from "../lib/query-route-state.js";

function QueryRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <QueryPage
      onSearchChange={(nextSearch) =>
        navigate({
          replace: true,
          search: nextSearch,
        })
      }
      search={search}
    />
  );
}

export const Route = createFileRoute("/query")({
  validateSearch: validateQueryRouteSearch,
  component: QueryRoute,
});
