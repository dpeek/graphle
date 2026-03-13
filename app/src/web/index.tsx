import React from "react";
import { createRoot } from "react-dom/client";

import { CompanyQueryProofPage } from "./company-query-proof.js";
import { CompanyProofPage } from "./company-proof.js";
import { EnvVarSettingsPage } from "./env-vars.js";
import { Explorer } from "./explorer.js";
import { Outliner } from "./outliner.js";
import { RelationshipProofPage } from "./relationship-proof.js";
import { resolveAppRoute } from "./routes.js";
import { AppRuntimeBootstrap } from "./runtime.js";

function resolveSurface() {
  const route = resolveAppRoute(window.location);

  if (route === "company") return <CompanyProofPage />;
  if (route === "explorer") return <Explorer />;
  if (route === "outliner") return <Outliner />;
  if (route === "query") return <CompanyQueryProofPage />;
  if (route === "relationships") return <RelationshipProofPage />;
  if (route === "envVars") return <EnvVarSettingsPage />;
  return <CompanyProofPage />;
}

const app = resolveSurface();

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root mount element");
}

createRoot(root).render(
  <React.StrictMode>
    <AppRuntimeBootstrap renderApp={() => app} />
  </React.StrictMode>,
);
