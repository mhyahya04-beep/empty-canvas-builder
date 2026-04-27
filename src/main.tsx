import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

import { bootUnifiedLifeVaultMigration } from "./lib/migration/runner";
import { startUrgentIndexer } from "./lib/urgent";

async function boot() {
  await bootUnifiedLifeVaultMigration();
  startUrgentIndexer();
  const router = getRouter();
  const rootElement = document.getElementById("app");

  if (rootElement && !rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <RouterProvider router={router} />
      </React.StrictMode>,
    );
  }
}

void boot();
