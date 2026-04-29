import { useMemo, useState, useRef, useEffect } from "react";
import { Filter, X, ChevronDown } from "lucide-react";
import type { PortalFilters } from "@/hooks/usePortalFilters";

// Light "showcase email" palette — matches CustomerPortal root.
const T = {
  surface: "#FFFFFF",
  border: "#EDE3D2",
  text: "#3D2B1A",
  textSecondary: "#6B5240",
  muted: "#8B7355",
  accent: "#E8461E",
  warn: "#B45309",
  sansHead: "'Inter', system-ui, sans-serif",
};

interface Props {
  filters: PortalFilters;
  onTypes: (v: string[]) => void;
  onProjects: (v: string[]) => void;
  onTags: (v: string[]) => void;
  onReset: () => void;
  /** Available equipment types from the client's plant_items. */
  availableTypes: string[];
  /** Available projects [{ id, name }]. */
  availableProjects: { id: string; name: string }[];
  /** Available tags [{ id, name }]. */
  availableTags: { id: string; name: string }[];
}

export function PortalFilterBar({
  filters,
  onTypes,
  onProjects,
  onTags,
  onReset,
  availableTypes,
  availableProjects,
  availableTags,
}: Props) {
  const isActive =
    filters.types.length > 0 ||
    filters.projects.length > 0 ||
    filters.tags.length > 0;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: T.textSecondary,
          fontSize: 11,
          fontFamily: T.sansHead,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          paddingRight: 4,
        }}
      >
        <Filter size={12} /> Filters
      </div>

      <MultiPicker
        label="Type"
        options={availableTypes.map((t) => ({ value: t, label: t }))}
        selected={filters.types}
        onChange={onTypes}
        emptyText="All types"
      />
      <MultiPicker
        label="Project"
        options={[
          { value: "__none__", label: "Unassigned" },
          ...availableProjects.map((p) => ({ value: p.id, label: p.name })),
        ]}
        selected={filters.projects}
        onChange={onProjects}
        emptyText="All projects"
      />
      <MultiPicker
        label="Tags"
        options={[
          { value: "__none__", label: "Untagged" },
          ...availableTags.map((t) => ({ value: t.id, label: t.name })),
        ]}
        selected={filters.tags}
        onChange={onTags}
        emptyText="All tags"
      />

      {isActive && (
        <button
          type="button"
          onClick={onReset}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: "none",
            color: T.muted,
            fontSize: 11,
            fontFamily: T.sansHead,
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          <X size={11} /> Clear
        </button>
      )}
    </div>
  );
}

function MultiPicker({
  label,
  options,
  selected,
  onChange,
  emptyText,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const summary = useMemo(() => {
    if (selected.length === 0) return emptyText;
    if (selected.length === 1) {
      const o = options.find((o) => o.value === selected[0]);
      return o?.label || selected[0];
    }
    return `${selected.length} selected`;
  }, [selected, options, emptyText]);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  const isActive = selected.length > 0;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: isActive ? `${T.accent}22` : "transparent",
          border: `1px solid ${isActive ? T.accent : T.border}`,
          color: isActive ? T.text : T.textSecondary,
          fontSize: 11,
          fontFamily: T.sansHead,
          fontWeight: 600,
          letterSpacing: "0.06em",
          padding: "6px 10px",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        <span style={{ color: T.muted, fontWeight: 500 }}>{label}:</span>
        {summary}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            padding: 6,
            minWidth: 200,
            maxHeight: 260,
            overflowY: "auto",
            zIndex: 20,
            boxShadow: "0 6px 20px rgba(61,43,26,0.12)",
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: 8, fontSize: 12, color: T.muted }}>
              No options yet
            </div>
          ) : (
            options.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <label
                  key={o.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    fontSize: 12,
                    color: T.text,
                    cursor: "pointer",
                    borderRadius: 4,
                    background: checked ? `${T.accent}11` : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(o.value)}
                    style={{ accentColor: T.accent }}
                  />
                  {o.label}
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
