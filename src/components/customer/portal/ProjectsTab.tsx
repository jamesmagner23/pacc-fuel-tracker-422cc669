import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { FolderKanban, Plus, Pencil, MapPin, CalendarDays } from "lucide-react";

import {
  T,
  card,
  inputStyle,
  labelStyle,
  muted,
  sectionTitle,
  fmtL,
  fmtNum,
  ghostBtn,
} from "./portalTheme";
import {
  useProjects,
  useProjectAssignments,
  useUpsertProject,
  type Project,
} from "@/hooks/useProjects";
import { usePlantItems } from "@/hooks/usePlantItems";

const PIE_COLORS = ["#E8461E", "#FF6B42", "#F5E6D0", "#C4A882", "#D88B5C", "#8B7355"];

interface Props {
  transactions: any[];
  clientAccountId: number | null;
}

export function ProjectsTab({ transactions, clientAccountId }: Props) {
  const { data: projects = [], isLoading } = useProjects(clientAccountId);
  const { data: assignments = [] } = useProjectAssignments(clientAccountId);
  const { data: plantItems = [] } = usePlantItems(clientAccountId);
  const upsertProject = useUpsertProject();

  const [editing, setEditing] = useState<Partial<Project> | null>(null);

  // Map placa -> project_id via plant_item assignment
  const projectByPlaca = useMemo(() => {
    const itemByPlaca = new Map<string, string>();
    plantItems.forEach((p) => {
      if (p.placa) itemByPlaca.set(p.placa.trim(), p.id);
    });
    const projectByItem = new Map<string, string>();
    assignments.forEach((a) => projectByItem.set(a.plant_item_id, a.project_id));
    const map = new Map<string, string>();
    itemByPlaca.forEach((itemId, placa) => {
      const pid = projectByItem.get(itemId);
      if (pid) map.set(placa, pid);
    });
    return map;
  }, [plantItems, assignments]);

  // Aggregate per project: total litres, deliveries, top equipment, monthly series
  const projectStats = useMemo(() => {
    const sixMonthsAgo = format(subMonths(startOfMonth(new Date()), 5), "yyyy-MM-dd");

    return projects.map((proj) => {
      const projTxns = transactions.filter((t) => {
        const placa = (t.placa || "").toString().trim();
        return projectByPlaca.get(placa) === proj.id;
      });

      const totalLitres = projTxns.reduce((s, t) => s + (t.cantidad || 0), 0);
      const deliveries = projTxns.length;

      // Top equipment by litres
      const byPlate = new Map<string, { name: string; litres: number; deliveries: number }>();
      projTxns.forEach((t) => {
        const placa = (t.placa || "Unknown").toString().trim() || "Unknown";
        const item = plantItems.find((p) => p.placa?.trim() === placa);
        const name = item?.name || placa;
        if (!byPlate.has(placa))
          byPlate.set(placa, { name, litres: 0, deliveries: 0 });
        const e = byPlate.get(placa)!;
        e.litres += t.cantidad || 0;
        e.deliveries += 1;
      });
      const topEquipment = Array.from(byPlate.values())
        .sort((a, b) => b.litres - a.litres)
        .slice(0, 5);

      // Monthly series (last 6 months)
      const byMonth: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = startOfMonth(subMonths(new Date(), i));
        byMonth[format(d, "yyyy-MM")] = 0;
      }
      projTxns.forEach((t) => {
        if (!t.date || t.date < sixMonthsAgo) return;
        const k = t.date.slice(0, 7);
        if (k in byMonth) byMonth[k] += t.cantidad || 0;
      });
      const monthly = Object.entries(byMonth).map(([k, litres]) => ({
        month: format(parseISO(k + "-01"), "MMM"),
        litres: Math.round(litres),
      }));

      return { project: proj, totalLitres, deliveries, topEquipment, monthly };
    });
  }, [projects, transactions, plantItems, projectByPlaca]);

  if (!clientAccountId) return <p style={muted(13)}>No account linked.</p>;
  if (isLoading) return <p style={muted(13)}>Loading projects…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={sectionTitle}>Projects</h2>
          <p style={{ ...muted(12), margin: "4px 0 0" }}>
            Per-project fuel usage, top consumers and 6-month trend.
          </p>
        </div>
        <button
          onClick={() => setEditing({})}
          style={{
            background: T.accent,
            border: "none",
            color: "#fff",
            padding: "9px 16px",
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus size={14} /> Add project
        </button>
      </div>

      {projects.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "32px 20px" }}>
          <FolderKanban size={32} color={T.muted} style={{ margin: "0 auto 8px" }} />
          <p style={{ ...muted(13), margin: 0 }}>
            No projects yet. Create one to start grouping deliveries by site or job.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {projectStats.map(({ project, totalLitres, deliveries, topEquipment, monthly }) => (
            <div key={project.id} style={card}>
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FolderKanban size={16} color={T.accent} />
                    <h3
                      style={{
                        fontSize: 16,
                        fontFamily: T.sansHead,
                        fontWeight: 700,
                        color: T.text,
                        margin: 0,
                      }}
                    >
                      {project.name}
                    </h3>
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: T.sansHead,
                        fontWeight: 600,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: T.text,
                        background: project.status === "active" ? T.positive : T.muted,
                        padding: "2px 8px",
                        borderRadius: 2,
                      }}
                    >
                      {project.status}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      marginTop: 4,
                      flexWrap: "wrap",
                      fontSize: 11,
                      color: T.muted,
                    }}
                  >
                    {project.site_address && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={11} /> {project.site_address}
                      </span>
                    )}
                    {(project.start_date || project.end_date) && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CalendarDays size={11} />
                        {project.start_date
                          ? format(parseISO(project.start_date), "d MMM yyyy")
                          : "—"}
                        {" → "}
                        {project.end_date
                          ? format(parseISO(project.end_date), "d MMM yyyy")
                          : "ongoing"}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setEditing(project)}
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
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Pencil size={11} /> Edit
                </button>
              </div>

              {/* KPIs */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <KPI label="Total fuel" value={fmtL(totalLitres)} />
                <KPI label="Deliveries" value={deliveries.toLocaleString()} />
                <KPI label="Plant assigned" value={topEquipment.length.toString()} />
                <KPI
                  label="Avg per delivery"
                  value={deliveries > 0 ? fmtL(totalLitres / deliveries) : "—"}
                />
              </div>

              {/* Charts row */}
              {totalLitres > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 16,
                  }}
                >
                  {/* Monthly trend */}
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 8 }}>6-month volume</div>
                    <div style={{ height: 160 }}>
                      <ResponsiveContainer>
                        <BarChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                          <CartesianGrid stroke={T.border} strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <Tooltip
                            contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 12 }}
                            labelStyle={{ color: T.text }}
                            itemStyle={{ color: T.text }}
                            formatter={(v: any) => [fmtL(Number(v)), "Litres"]}
                          />
                          <Bar dataKey="litres" fill={T.accent} radius={[3, 3, 0, 0]} maxBarSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Top equipment */}
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 8 }}>Top fuel users</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 110, height: 110, flexShrink: 0 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={topEquipment}
                              dataKey="litres"
                              nameKey="name"
                              innerRadius={32}
                              outerRadius={52}
                              strokeWidth={0}
                            >
                              {topEquipment.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 12 }}
                              formatter={(v: any) => fmtL(Number(v))}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                        {topEquipment.map((e, i) => (
                          <div
                            key={e.name + i}
                            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, minWidth: 0 }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 2,
                                background: PIE_COLORS[i % PIE_COLORS.length],
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ color: T.textSecondary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {e.name}
                            </span>
                            <span style={{ color: T.text, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                              {fmtL(e.litres)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {totalLitres === 0 && (
                <p style={{ ...muted(12), margin: 0 }}>
                  No fuel deliveries linked to this project yet. Assign plant to it from the Plant tab.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {editing !== null && clientAccountId && (
        <ProjectModal
          initial={editing}
          clientAccountId={clientAccountId}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            await upsertProject.mutateAsync({
              ...data,
              id: editing.id,
              client_account_id: clientAccountId,
            } as any);
            setEditing(null);
          }}
          saving={upsertProject.isPending}
        />
      )}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        padding: "10px 12px",
      }}
    >
      <div style={{ ...labelStyle, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 18,
          fontFamily: T.sansHead,
          fontWeight: 700,
          color: T.text,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ProjectModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial: Partial<Project>;
  clientAccountId: number;
  onClose: () => void;
  onSave: (data: Partial<Project> & { name: string }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial.name || "");
  const [siteAddress, setSiteAddress] = useState(initial.site_address || "");
  const [startDate, setStartDate] = useState(initial.start_date || "");
  const [endDate, setEndDate] = useState(initial.end_date || "");
  const [status, setStatus] = useState(initial.status || "active");
  const [notes, setNotes] = useState(initial.notes || "");

  const submit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim().slice(0, 200),
      site_address: siteAddress.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      status,
      notes: notes.trim() || null,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          padding: 20,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ ...sectionTitle, fontSize: 16, marginBottom: 16 }}>
          {initial.id ? "Edit Project" : "New Project"}
        </h3>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} maxLength={200} />
          </div>
          <div>
            <label style={labelStyle}>Site address</label>
            <input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", fontFamily: T.sansBody }}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={ghostBtn}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || saving}
            style={{
              background: T.accent,
              border: "none",
              color: "#fff",
              padding: "9px 16px",
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              borderRadius: 4,
              cursor: !name.trim() || saving ? "not-allowed" : "pointer",
              opacity: !name.trim() || saving ? 0.4 : 1,
              fontWeight: 600,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
