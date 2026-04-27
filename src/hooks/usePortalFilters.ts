import { useCallback, useEffect, useMemo, useState } from "react";

const KEY = "pacc-portal-filters-v1";

export interface PortalFilters {
  /** Plant equipment_type values to include. Empty = all types. */
  types: string[];
  /** Project IDs to include. Empty = all projects. Special value "__none__" = unassigned. */
  projects: string[];
  /** Plant tag IDs to include. Empty = all tags. Special value "__none__" = untagged. */
  tags: string[];
  /** Show only deliveries whose placa has no matching plant_item. */
  unmappedOnly: boolean;
}

const EMPTY: PortalFilters = { types: [], projects: [], tags: [], unmappedOnly: false };

function read(): PortalFilters {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw);
    return {
      types: Array.isArray(v.types) ? v.types : [],
      projects: Array.isArray(v.projects) ? v.projects : [],
      tags: Array.isArray(v.tags) ? v.tags : [],
      unmappedOnly: !!v.unmappedOnly,
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Session-persisted client-portal filters. State is shared across tabs in
 * the same window via the `storage` event so flipping a filter on one tab
 * updates the other immediately.
 */
export function usePortalFilters() {
  const [filters, setFilters] = useState<PortalFilters>(read);

  // Persist on change
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(filters));
    } catch {
      /* quota exceeded — non-fatal */
    }
  }, [filters]);

  // Cross-tab sync (sessionStorage is per-tab, but BroadcastChannel works for
  // the same window's component tree across re-mounts).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try {
          setFilters(JSON.parse(e.newValue));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTypes = useCallback(
    (types: string[]) => setFilters((f) => ({ ...f, types })),
    []
  );
  const setProjects = useCallback(
    (projects: string[]) => setFilters((f) => ({ ...f, projects })),
    []
  );
  const setTags = useCallback(
    (tags: string[]) => setFilters((f) => ({ ...f, tags })),
    []
  );
  const setUnmappedOnly = useCallback(
    (unmappedOnly: boolean) => setFilters((f) => ({ ...f, unmappedOnly })),
    []
  );
  const reset = useCallback(() => setFilters(EMPTY), []);

  const isActive = useMemo(
    () =>
      filters.types.length > 0 ||
      filters.projects.length > 0 ||
      filters.tags.length > 0 ||
      filters.unmappedOnly,
    [filters]
  );

  return { filters, setTypes, setProjects, setTags, setUnmappedOnly, reset, isActive };
}

/**
 * Filter a transaction list by the active portal filters.
 *
 * - placaToType:    placa → equipment_type (from plant_items)
 * - placaToProject: placa → project_id (from active plant assignments)
 * - placaToPlant:   placa → plant_item id presence (used for "unmapped")
 *
 * A delivery whose placa is missing from `placaToPlant` is considered
 * unmapped. Type/project filters skip unmapped deliveries unless
 * `unmappedOnly` is the only active filter.
 */
export function filterTransactions<T extends { placa?: string | null }>(
  transactions: T[],
  filters: PortalFilters,
  lookups: {
    placaToType: Record<string, string | null | undefined>;
    placaToProject: Record<string, string>;
    placaToPlant: Record<string, unknown>;
    /** placa → list of tag ids attached to that plant_item. */
    placaToTags?: Record<string, string[]>;
  }
): T[] {
  const { types, projects, tags, unmappedOnly } = filters;
  if (!types.length && !projects.length && !tags.length && !unmappedOnly)
    return transactions;

  const typeSet = new Set(types);
  const projSet = new Set(projects);
  const tagSet = new Set(tags);
  const placaToTags = lookups.placaToTags || {};

  return transactions.filter((t) => {
    const placa = (t.placa || "").toString().trim();
    const isMapped = !!placa && !!lookups.placaToPlant[placa];

    if (unmappedOnly && isMapped) return false;
    // When unmappedOnly is the only active filter, skip downstream checks.
    if (unmappedOnly && !types.length && !projects.length && !tags.length) return true;

    // Unmapped rows can't satisfy type/project/tag filters
    if (!isMapped) return unmappedOnly ? true : false;

    if (typeSet.size > 0) {
      const t2 = lookups.placaToType[placa] || "";
      if (!typeSet.has(t2)) return false;
    }
    if (projSet.size > 0) {
      const pid = lookups.placaToProject[placa] || "__none__";
      if (!projSet.has(pid)) return false;
    }
    if (tagSet.size > 0) {
      const itemTags = placaToTags[placa] || [];
      if (itemTags.length === 0) {
        if (!tagSet.has("__none__")) return false;
      } else {
        const ok = itemTags.some((id) => tagSet.has(id)) ||
          (tagSet.has("__none__") && itemTags.length === 0);
        if (!ok) return false;
      }
    }
    return true;
  });
}
