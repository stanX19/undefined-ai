import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { registerAllComponents } from "./features/surfaces/catalog.ts";
import "./index.css";

registerAllComponents();

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__loadDemo = async () => {
    const { loadDemoSurface } = await import("./features/a2ui/mockDemo.ts");
    loadDemoSurface();
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
