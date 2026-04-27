import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Download, FileText, Filter } from "lucide-react";

import {
  T,
  card,
  inputStyle,
  labelStyle,
  muted,
  fmtL,
  fmtNum,
  downloadCSV,
} from "./portalTheme";
import { logActivity } from "@/hooks/useActivityLog";
import { useProjects, useProjectAssignments } from "@/hooks/useProjects";
import { usePlantItems } from "@/hooks/usePlantItems";

interface Props {
  transactions: any[];
  clientAccountId: number | null;
  demoSuffix: string;
}

export function DeliveriesTab({ transactions, clientAccountId, demoSuffix }: Props) {
  const { data: projects = [] } = useProjects(clientAccountId);
  const { data: assignments = [] } = useProjectAssignments(clientAccountId);
  const { data: plantItems = [] } = usePlantItems(clientAccountId);

  const [siteFilter, setSiteFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const sites = useMemo(
    () =>
      Array.from(new Set(transactions.map((t) => t.nombre_cliente1).filter(Boolean))) as string[],
    [transactions],
  );

  // Map each transaction's plant (via placa) to its assigned project, if any
  const projectByPlaca = useMemo(() => {
    const itemByPlaca = new Map<string, string>(); // placa -> plant_item_id
    plantItems.forEach((p) => {
      if (p.placa) itemByPlaca.set(p.placa.trim(), p.id);
    });
    const projectByItem = new Map<string, string>(); // plant_item_id -> project_id
    assignments.forEach((a) => projectByItem.set(a.plant_item_id, a.project_id));
    const map = new Map<string, string>();
    itemByPlaca.forEach((itemId, placa) => {
      const pid = projectByItem.get(itemId);
      if (pid) map.set(placa, pid);
    });
    return map;
  }, [plantItems, assignments]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (siteFilter !== "all" && t.nombre_cliente1 !== siteFilter) return false;
      if (projectFilter !== "all") {
        const placa = (t.placa || "").toString().trim();
        const pid = projectByPlaca.get(placa);
        if (projectFilter === "__unassigned__") {
          if (pid) return false;
        } else if (pid !== projectFilter) {
          return false;
        }
      }
      if (from && (t.date || "") < from) return false;
      if (to && (t.date || "") > to) return false;
      return true;
    });
  }, [transactions, siteFilter, projectFilter, from, to, projectByPlaca]);

  const totalLitres = filtered.reduce((s, t) => s + (t.cantidad || 0), 0);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || "";

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      [
        "Date",
        "Site",
        "Project",
        "Plate",
        "Product",
        "Litres",
        "Invoice",
        "Driver",
        "Station",
      ],
    ];
    filtered.forEach((t) => {
      const placa = (t.placa || "").toString().trim();
      const pid = projectByPlaca.get(placa);
      rows.push([
        t.date || "",
        t.nombre_cliente1 || "",
        pid ? projectName(pid) : "",
        placa,
        t.producto || "Diesel",
        (t.cantidad || 0).toFixed(2),
        t.factura || "",
        t.nombre_vendedor || "",
        t.estacion || "",
      ]);
    });
    const stamp = format(new Date(), "yyyy-MM-dd");
    downloadCSV(rows, `PACC-Deliveries-${stamp}.csv`);
    logActivity("export", { type: "deliveries-csv", rows: filtered.length });
  };

  const clearFilters = () => {
    setSiteFilter("all");
    setProjectFilter("all");
    setFrom("");
    setTo("");
  };

  const hasFilters =
    siteFilter !== "all" || projectFilter !== "all" || !!from || !!to;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filter strip */}
      <div style={card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 12,
            color: T.textSecondary,
            fontSize: 12,
          }}
        >
          <Filter size={14} />
          <span style={{ letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
            Filters
          </span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                color: T.muted,
                fontSize: 11,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Clear all
            </button>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          <div>
            <label style={labelStyle}>Site</label>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">All sites</option>
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Project</label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">All projects</option>
              <option value="__unassigned__">— Unassigned plant —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>From</label>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>To</label>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Summary + export */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 13, color: T.textSecondary }}>
          <span style={{ color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {filtered.length.toLocaleString()}
          </span>{" "}
          deliveries ·{" "}
          <span style={{ color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {fmtL(totalLitres)}
          </span>{" "}
          total
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          style={{
            background: T.accent,
            border: "none",
            color: "#fff",
            padding: "9px 16px",
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            borderRadius: 4,
            cursor: filtered.length === 0 ? "not-allowed" : "pointer",
            opacity: filtered.length === 0 ? 0.4 : 1,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        {filtered.length === 0 ? (
          <p style={{ ...muted(13), padding: 16 }}>No deliveries match the current filters.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: T.sansBody }}>
            <thead>
              <tr>
                {["Date", "Site", "Project", "Plate", "Litres", "Invoice", ""].map((h, i) => (
                  <th
                    key={h + i}
                    style={{
                      textAlign: i === 4 ? "right" : "left",
                      padding: "10px 14px",
                      fontSize: 10,
                      fontFamily: T.sansHead,
                      fontWeight: 500,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: T.muted,
                      borderBottom: `1px solid ${T.border}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const placa = (t.placa || "").toString().trim();
                const pid = projectByPlaca.get(placa);
                return (
                  <tr
                    key={t.id || i}
                    style={{
                      borderBottom:
                        i < filtered.length - 1 ? `1px solid ${T.border}` : "none",
                    }}
                  >
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.textSecondary, whiteSpace: "nowrap" }}>
                      {t.date ? format(parseISO(t.date), "dd MMM yy") : "—"}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: T.text }}>
                      {t.nombre_cliente1 || "—"}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: pid ? T.text : T.muted }}>
                      {pid ? projectName(pid) : "—"}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.textSecondary, fontVariantNumeric: "tabular-nums" }}>
                      {placa || "—"}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: T.text, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {fmtNum(t.cantidad || 0, 0)}L
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.textSecondary, fontVariantNumeric: "tabular-nums" }}>
                      {t.factura || "—"}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <button
                        onClick={() => window.open(`/docket/${t.id}${demoSuffix}`, "_blank")}
                        title="Open delivery docket"
                        style={{
                          background: "transparent",
                          border: `1px solid ${T.border}`,
                          color: T.textSecondary,
                          padding: "6px 10px",
                          fontSize: 10,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontWeight: 500,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <FileText size={11} /> Docket
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
