import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

export function useUrlTab<T extends string>(valid: readonly T[], fallback: T, pathBase?: string, key = "tab") {
  const [params] = useSearchParams();
  const route = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requested = pathBase ? route.tab ?? params.get(key) : params.get(key);
  const activeTab = valid.includes(requested as T) ? requested as T : fallback;
  const setActiveTab = (tab: T) => {
    const next = new URLSearchParams(params);
    if (pathBase) next.delete(key); else next.set(key, tab);
    const query = next.toString();
    navigate(`${pathBase ? `${pathBase}/${tab}` : location.pathname}${query ? `?${query}` : ""}`);
  };
  return [activeTab, setActiveTab] as const;
}