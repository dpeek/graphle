import { describe, expect, it } from "bun:test";

import { hrefForAppRoute, resolveAppRoute } from "./routes.js";

describe("app routes", () => {
  it("maps the env-var settings pathname to the operator route", () => {
    expect(resolveAppRoute({ pathname: "/settings/env-vars" })).toBe("envVars");
    expect(hrefForAppRoute("envVars")).toBe("/settings/env-vars");
  });

  it("keeps the legacy query-param surface alias for env vars", () => {
    expect(resolveAppRoute({ pathname: "/", search: "?surface=env-vars" })).toBe("envVars");
  });
});
