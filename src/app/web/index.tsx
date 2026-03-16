import React from "react";
import { createRoot } from "react-dom/client";

import { AppShell } from "./app-shell.js";
import { AppRuntimeBootstrap } from "./runtime.js";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root mount element");
}

createRoot(root).render(
  <React.StrictMode>
    <AppRuntimeBootstrap renderApp={() => <AppShell />} />
  </React.StrictMode>,
);
