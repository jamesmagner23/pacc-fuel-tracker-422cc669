import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { DateRange } from "@/hooks/useTransactions";

interface DateRangeContextType {
  range: DateRange;
  setRange: (range: DateRange) => void;
}

// First-load default per route. Dispatch is a day-of operation so stays
// "today"; every other page is more useful at "this month".
const ROUTE_DEFAULTS: Record<string, DateRange> = {
  "/dispatch": "today",
};
const DEFAULT_RANGE: DateRange = "month";

function routeKey(pathname: string): string {
  // Bucket nested routes under their top-level segment so /customers/123
  // shares state + storage with /customers.
  const top = "/" + (pathname.split("/")[1] || "");
  return top === "/" ? "/" : top;
}

function storageKey(pathname: string): string {
  return `pacc.period.${routeKey(pathname)}`;
}

function readStored(pathname: string): DateRange | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(storageKey(pathname));
    if (v === "today" || v === "week" || v === "month" || v === "custom") return v;
  } catch { /* noop */ }
  return null;
}

function defaultFor(pathname: string): DateRange {
  return ROUTE_DEFAULTS[routeKey(pathname)] ?? DEFAULT_RANGE;
}

const DateRangeContext = createContext<DateRangeContextType>({
  range: DEFAULT_RANGE,
  setRange: () => {},
});

export const DateRangeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [range, setRangeState] = useState<DateRange>(() =>
    readStored(location.pathname) ?? defaultFor(location.pathname)
  );

  // When the route changes, hydrate from that route's stored value (or its
  // default) so each section remembers its own period choice.
  useEffect(() => {
    const next = readStored(location.pathname) ?? defaultFor(location.pathname);
    setRangeState(next);
  }, [location.pathname]);

  const setRange = (next: DateRange) => {
    setRangeState(next);
    try {
      window.localStorage.setItem(storageKey(location.pathname), next);
    } catch { /* noop */ }
  };

  return (
    <DateRangeContext.Provider value={{ range, setRange }}>
      {children}
    </DateRangeContext.Provider>
  );
};

export const useDateRange = () => useContext(DateRangeContext);
