import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyGlobalTheme } from "./lib/globalTheme";

// Apply persisted theme + sync <meta theme-color> before first paint.
try {
  const saved = window.localStorage.getItem("pacc.global.theme");
  applyGlobalTheme(saved === "light" ? "light" : "dark");
} catch {
  applyGlobalTheme("dark");
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
