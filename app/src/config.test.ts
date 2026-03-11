import { describe, expect, it } from "bun:test";

import { resolveRuntimeConfigSyncUrl } from "./config.js";

describe("app runtime config", () => {
  it("defaults the sync url to the current origin", () => {
    expect(resolveRuntimeConfigSyncUrl("http://app.local/proof?surface=company")).toBe(
      "http://app.local/api/sync",
    );
  });

  it("accepts an alternate configured sync endpoint", () => {
    expect(
      resolveRuntimeConfigSyncUrl(
        "http://app.local/proof?surface=company",
        "https://graph.example/sync",
      ),
    ).toBe("https://graph.example/sync");
  });
});
