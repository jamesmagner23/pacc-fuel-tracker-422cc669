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

createRoot(document.getElementById("root")!).render(<App />);
