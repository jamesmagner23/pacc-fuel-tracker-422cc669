import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Reset window + main scroll on every pathname change so users always
 * land at the top of a new dashboard page.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
      const main = document.getElementById("main-content");
      if (main) main.scrollTop = 0;
    } catch { /* noop */ }
  }, [pathname]);
  return null;
}