import { createContext, useContext, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

const DemoContext = createContext(false);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [params] = useSearchParams();
  const isDemo = params.get("demo") === "true";
  return <DemoContext.Provider value={isDemo}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  return useContext(DemoContext);
}
