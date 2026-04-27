import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Truck, FolderKanban, Download, Printer, FileText, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllTransactions } from "@/hooks/useTransactions";
import { usePlantItems, useDeletePlantItem, type PlantItem } from "@/hooks/usePlantItems";
import { useProjects, useProjectAssignments, useDeleteProject, useToggleAssignment, type Project } from "@/hooks/useProjects";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PlantItemModal } from "@/components/customer/PlantItemModal";
import { ProjectModal } from "@/components/customer/ProjectModal";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { toast } from "@/hooks/use-toast";

export default function CustomerHub() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const customerName = decodeURIComponent(name || "");

  // Resolve client_account_id by matching speedsol name or company name
  const { data: account } = useQuery({
    queryKey: ["client-account-by-name", customerName],
    enabled: !!customerName,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("*")
        .or(`company_name.eq.${customerName},speedsol_names.cs.{${customerName}}`)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const clientAccountId = account?.id ?? null;

  const { data: allTxns = [], isLoading: loadingTx } = useAllTransactions();
  const { data: plantItems = [] } = usePlantItems(clientAccountId);
  const { data: projects = [] } = useProjects(clientAccountId);
  const { data: assignments = [] } = useProjectAssignments(clientAccountId);

  const customerTxns = useMemo(
    () => allTxns.filter((t) => t.nombre_cliente1 === customerName),
    [allTxns, customerName]
  );

  // Auto-detect placas from transactions, merge with enriched items
  const equipmentList = useMemo(() => {
    const placaMap: Record<string, { placa: string; litres: number; deliveries: number; lastSeen: string }> = {};
    customerTxns.forEach((t) => {
      const p = t.placa?.trim();
      if (!p) return;
      if (!placaMap[p]) placaMap[p] = { placa: p, litres: 0, deliveries: 0, lastSeen: t.fecha };
      placaMap[p].litres += t.cantidad || 0;
      placaMap[p].deliveries += 1;
      if (t.fecha > placaMap[p].lastSeen) placaMap[p].lastSeen = t.fecha;
    });

    const enrichedByPlaca: Record<string, PlantItem> = {};
    plantItems.forEach((p) => {
      if (p.placa) enrichedByPlaca[p.placa] = p;
    });

    // Merge: every detected placa + every enriched item without a placa
    const merged = Object.values(placaMap).map((auto) => ({
      ...auto,
      enriched: enrichedByPlaca[auto.placa] || null,
    }));

    plantItems
      .filter((p) => !p.placa || !placaMap[p.placa])
      .forEach((p) =>
        merged.push({
          placa: p.placa || "",
          litres: 0,
          deliveries: 0,
          lastSeen: p.created_at,
          enriched: p,
        })
      );

    return merged.sort((a, b) => b.litres - a.litres);
  }, [customerTxns, plantItems]);

  if (loadingTx) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-5 max-w-[1200px]">
      <button
        onClick={() => navigate("/customers")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </button>

      <div>
        <h1 className="text-2xl font-bold">{customerName}</h1>
        {account && (
          <p className="text-xs text-muted-foreground mt-1">
            {account.contact_name && <>{account.contact_name} · </>}
            {account.contact_email}
            {account.contact_phone && <> · {account.contact_phone}</>}
          </p>
        )}
        {!account && (
          <p className="text-xs text-amber-500 mt-1">
            No client account linked yet. Link this Speedsol name in Customers → Client Pricing to enable equipment & projects.
          </p>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-0 overflow-x-auto flex-nowrap w-full no-scrollbar">
          {[
            { v: "overview", l: "Overview" },
            { v: "equipment", l: "Plant & Equipment" },
            { v: "projects", l: "Projects" },
            { v: "analytics", l: "Analytics" },
            { v: "transactions", l: "Transactions" },
          ].map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="px-3 sm:px-4 py-2.5 text-[12px] sm:text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none bg-transparent whitespace-nowrap shrink-0"
            >
              {t.l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <OverviewTab txns={customerTxns} equipment={equipmentList} projects={projects} />
        </TabsContent>
        <TabsContent value="equipment" className="mt-5">
          <EquipmentTab equipment={equipmentList} clientAccountId={clientAccountId} txns={customerTxns} />
        </TabsContent>
        <TabsContent value="projects" className="mt-5">
          <ProjectsTab projects={projects} assignments={assignments} equipment={equipmentList} txns={customerTxns} clientAccountId={clientAccountId} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-5">
          <AnalyticsTab txns={customerTxns} equipment={equipmentList} projects={projects} assignments={assignments} />
        </TabsContent>
        <TabsContent value="transactions" className="mt-5">
          <TransactionsTab txns={customerTxns} customerName={customerName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- OVERVIEW ---------------- */
function OverviewTab({ txns, equipment, projects }: { txns: any[]; equipment: any[]; projects: Project[] }) {
  const totalLitres = txns.reduce((s, t) => s + (t.cantidad || 0), 0);
  const totalRevenue = txns.reduce((s, t) => s + (t.dinero_total || 0), 0);
  const activeProjects = projects.filter((p) => p.status === "active").length;

  const kpis = [
    { label: "Total Litres", value: `${totalLitres.toLocaleString()}L` },
    { label: "Deliveries", value: txns.length.toLocaleString() },
    { label: "Revenue", value: `$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
    { label: "Equipment", value: equipment.length.toString() },
    { label: "Active Projects", value: activeProjects.toString() },
  ];

  const topEquipment = equipment.slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="glass-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className="text-lg sm:text-xl font-bold mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-3">Top Equipment by Fuel</h2>
          {topEquipment.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No equipment fuel usage in transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {topEquipment.map((e) => (
                <div key={e.placa} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                  <div>
                    <div className="font-medium">{e.enriched?.name || e.placa}</div>
                    <div className="text-[10px] text-muted-foreground">{e.placa} · {e.deliveries} fills</div>
                  </div>
                  <div className="font-bold">{e.litres.toLocaleString()}L</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-3">Recent Activity</h2>
          {txns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No transactions for this customer.</p>
          ) : (
            <div className="space-y-2">
              {txns.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                  <div>
                    <div className="font-medium">{t.placa || t.estacion || "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{format(parseISO(t.fecha), "dd MMM HH:mm")} · {t.ciudad}</div>
                  </div>
                  <div className="font-bold">{(t.cantidad || 0).toLocaleString()}L</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- EQUIPMENT ---------------- */
function EquipmentTab({
  equipment,
  clientAccountId,
  txns,
}: {
  equipment: any[];
  clientAccountId: number | null;
  txns: any[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<PlantItem> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const del = useDeletePlantItem();

  const selectedItem = equipment.find((e) => e.placa === selected);
  const selectedTxns = useMemo(
    () => (selected ? txns.filter((t) => t.placa === selected) : []),
    [txns, selected]
  );

  const handleEdit = (item: any) => {
    setEditing(item.enriched || { placa: item.placa, name: item.placa });
    setModalOpen(true);
  };

  if (!clientAccountId) {
    return <div className="glass-card p-6 text-sm text-muted-foreground">Link a client account first to manage equipment.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{equipment.length} item{equipment.length !== 1 ? "s" : ""} (auto-detected from deliveries)</p>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Equipment
        </Button>
      </div>

      {equipment.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          No equipment yet. Plates appear here automatically as fuel is delivered, or add one manually.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {equipment.map((e) => (
            <button
              key={e.placa || e.enriched?.id}
              onClick={() => setSelected(e.placa)}
              className="glass-card p-4 text-left hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{e.enriched?.name || e.placa || "Unnamed"}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {e.placa}{e.enriched?.equipment_type && <> · {e.enriched.equipment_type}</>}
                  </div>
                </div>
                <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-base font-bold">{e.litres.toLocaleString()}L</div>
                  <div className="text-[9px] text-muted-foreground uppercase">{e.deliveries} fills</div>
                </div>
                {!e.enriched && <Badge variant="outline" className="text-[9px]">Auto</Badge>}
              </div>
            </button>
          ))}
        </div>
      )}

      <PlantItemModal open={modalOpen} onOpenChange={setModalOpen} clientAccountId={clientAccountId} initial={editing} />

      {/* Detail panel */}
      {selected && selectedItem && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-bold">{selectedItem.enriched?.name || selectedItem.placa}</div>
              <div className="text-xs text-muted-foreground">
                {selectedItem.placa} {selectedItem.enriched?.equipment_type && <>· {selectedItem.enriched.equipment_type}</>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleEdit(selectedItem)}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> {selectedItem.enriched ? "Edit" : "Enrich"}
              </Button>
              {selectedItem.enriched && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Remove this equipment record? Transaction data is unaffected.")) {
                      del.mutate({ id: selectedItem.enriched.id, client_account_id: clientAccountId });
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>

          {selectedItem.enriched?.photo_url && (
            <img src={selectedItem.enriched.photo_url} alt="" className="rounded-lg max-h-48 object-cover" />
          )}
          {selectedItem.enriched?.description && (
            <p className="text-sm text-muted-foreground">{selectedItem.enriched.description}</p>
          )}
          {selectedItem.enriched?.serial_number && (
            <p className="text-xs"><span className="text-muted-foreground">Serial:</span> {selectedItem.enriched.serial_number}</p>
          )}
          {selectedItem.enriched?.service_notes && (
            <div className="text-xs bg-secondary/40 p-3 rounded-lg whitespace-pre-wrap">{selectedItem.enriched.service_notes}</div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent Fills ({selectedTxns.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3">Location</th>
                    <th className="pb-2 pr-3 text-right">Litres</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTxns.slice(0, 15).map((t) => (
                    <tr key={t.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 whitespace-nowrap">{format(parseISO(t.fecha), "dd MMM HH:mm")}</td>
                      <td className="py-2 pr-3">{t.ciudad}</td>
                      <td className="py-2 pr-3 text-right">{(t.cantidad || 0).toLocaleString()}L</td>
                      <td className="py-2 text-right">${(t.dinero_total || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- PROJECTS ---------------- */
function ProjectsTab({
  projects,
  assignments,
  equipment,
  txns,
  clientAccountId,
}: {
  projects: Project[];
  assignments: any[];
  equipment: any[];
  txns: any[];
  clientAccountId: number | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Project> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const del = useDeleteProject();
  const toggle = useToggleAssignment();

  if (!clientAccountId) {
    return <div className="glass-card p-6 text-sm text-muted-foreground">Link a client account first to manage projects.</div>;
  }

  const projectStats = (projectId: string) => {
    const assignedItemIds = assignments.filter((a) => a.project_id === projectId).map((a) => a.plant_item_id);
    const assignedPlacas = equipment
      .filter((e) => e.enriched && assignedItemIds.includes(e.enriched.id))
      .map((e) => e.placa);
    const projectTxns = txns.filter((t) => assignedPlacas.includes(t.placa));
    return {
      itemCount: assignedItemIds.length,
      litres: projectTxns.reduce((s, t) => s + (t.cantidad || 0), 0),
      deliveries: projectTxns.length,
    };
  };

  const selectedProject = projects.find((p) => p.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          No projects yet. Create one to group equipment and track fuel usage per site.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => {
            const s = projectStats(p.id);
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className="glass-card p-4 text-left hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{p.name}</div>
                    {p.site_address && <div className="text-[10px] text-muted-foreground truncate">{p.site_address}</div>}
                  </div>
                  <Badge variant="outline" className="text-[9px] capitalize shrink-0">{p.status}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm font-bold">{s.itemCount}</div>
                    <div className="text-[9px] text-muted-foreground uppercase">Equip</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold">{s.litres.toLocaleString()}L</div>
                    <div className="text-[9px] text-muted-foreground uppercase">Fuel</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold">{s.deliveries}</div>
                    <div className="text-[9px] text-muted-foreground uppercase">Drops</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <ProjectModal open={modalOpen} onOpenChange={setModalOpen} clientAccountId={clientAccountId} initial={editing} />

      {selected && selectedProject && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-bold">{selectedProject.name}</div>
              {selectedProject.site_address && <div className="text-xs text-muted-foreground">{selectedProject.site_address}</div>}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(selectedProject); setModalOpen(true); }}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Delete project "${selectedProject.name}"?`)) {
                    del.mutate({ id: selectedProject.id, client_account_id: clientAccountId });
                    setSelected(null);
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>

          {selectedProject.notes && <p className="text-sm text-muted-foreground">{selectedProject.notes}</p>}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Assigned Equipment</h3>
            {equipment.filter((e) => e.enriched).length === 0 ? (
              <p className="text-xs text-muted-foreground">Add & enrich equipment first to assign it.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {equipment.filter((e) => e.enriched).map((e) => {
                  const isAssigned = assignments.some((a) => a.project_id === selectedProject.id && a.plant_item_id === e.enriched.id);
                  return (
                    <label key={e.enriched.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/60 hover:border-primary/30 cursor-pointer">
                      <Checkbox
                        checked={isAssigned}
                        onCheckedChange={(checked) =>
                          toggle.mutate({
                            project_id: selectedProject.id,
                            plant_item_id: e.enriched.id,
                            assign: !!checked,
                            client_account_id: clientAccountId,
                          })
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{e.enriched.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{e.placa} · {e.litres.toLocaleString()}L total</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- ANALYTICS ---------------- */
function AnalyticsTab({
  txns,
  equipment,
  projects,
  assignments,
}: {
  txns: any[];
  equipment: any[];
  projects: Project[];
  assignments: any[];
}) {
  const accent = "hsl(var(--primary))";
  const muted = "hsl(var(--muted-foreground))";

  const equipmentChart = equipment.slice(0, 10).map((e) => ({
    name: e.enriched?.name || e.placa || "—",
    litres: e.litres,
  }));

  const projectChart = useMemo(
    () =>
      projects.map((p) => {
        const ids = assignments.filter((a) => a.project_id === p.id).map((a) => a.plant_item_id);
        const placas = equipment.filter((e) => e.enriched && ids.includes(e.enriched.id)).map((e) => e.placa);
        const litres = txns.filter((t) => placas.includes(t.placa)).reduce((s, t) => s + (t.cantidad || 0), 0);
        return { name: p.name, litres };
      }),
    [projects, assignments, equipment, txns]
  );

  const dailyChart = useMemo(() => {
    const map: Record<string, number> = {};
    txns.forEach((t) => { if (t.date) map[t.date] = (map[t.date] || 0) + (t.cantidad || 0); });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, l]) => ({ date: format(parseISO(d), "dd MMM"), litres: l }));
  }, [txns]);

  const typeChart = useMemo(() => {
    const map: Record<string, number> = {};
    equipment.forEach((e) => {
      const type = e.enriched?.equipment_type || "Untyped";
      map[type] = (map[type] || 0) + e.litres;
    });
    return Object.entries(map).map(([type, litres]) => ({ type, litres })).sort((a, b) => b.litres - a.litres);
  }, [equipment]);

  const tt = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-3">Plant vs Plant — Top 10 by Fuel</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={equipmentChart} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={tt} formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]} />
                <Bar dataKey="litres" fill={accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-3">Project vs Project</h2>
          {projectChart.length === 0 ? (
            <p className="text-xs text-muted-foreground py-12 text-center">Create projects and assign equipment to see comparisons.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={projectChart}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tt} formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]} />
                  <Bar dataKey="litres" fill={accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-3">Fuel Volume Over Time</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={dailyChart}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tt} formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]} />
                <Line type="monotone" dataKey="litres" stroke={accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-3">Fuel by Equipment Type</h2>
          {typeChart.length === 0 ? (
            <p className="text-xs text-muted-foreground py-12 text-center">Tag equipment with a type to compare here.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={typeChart}>
                  <XAxis dataKey="type" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tt} formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]} />
                  <Bar dataKey="litres" fill={accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- TRANSACTIONS ---------------- */
function TransactionsTab({ txns, customerName }: { txns: any[]; customerName: string }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return txns;
    return txns.filter((t) =>
      [t.placa, t.ciudad, t.estacion, t.factura?.toString(), t.producto]
        .filter(Boolean)
        .some((v) => v.toString().toLowerCase().includes(q))
    );
  }, [txns, search]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((t) => t.id)));
  };

  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const downloadCSV = () => {
    const rows = selected.size > 0 ? filtered.filter((t) => selected.has(t.id)) : filtered;
    if (rows.length === 0) {
      toast({ title: "No rows to export", variant: "destructive" });
      return;
    }
    const headers = ["Date", "Invoice", "Plate", "Location", "Station", "Product", "Litres", "Price/L", "Total"];
    const body = rows.map((t) => [
      format(parseISO(t.fecha), "yyyy-MM-dd HH:mm"),
      t.factura ?? "",
      t.placa ?? "",
      t.ciudad ?? "",
      t.estacion ?? "",
      t.producto ?? "",
      t.cantidad ?? "",
      t.ppu ?? "",
      t.dinero_total ?? "",
    ]);
    const csv = [headers, ...body]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${customerName.replace(/[^a-z0-9]+/gi, "_")}_transactions_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${rows.length} transaction${rows.length !== 1 ? "s" : ""}` });
  };

  const printDocket = (id: number) => window.open(`/docket/${id}`, "_blank");

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plate, location, invoice…" className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {selected.size > 0 ? `${selected.size} selected` : `${filtered.length} rows`}
          </span>
          <Button size="sm" onClick={downloadCSV}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="p-3 w-8">
                <Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
              </th>
              <th className="p-3">Date</th>
              <th className="p-3">Invoice</th>
              <th className="p-3">Plate</th>
              <th className="p-3">Location</th>
              <th className="p-3 text-right">Litres</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">No transactions found.</td>
              </tr>
            ) : (
              filtered.slice(0, 200).map((t) => (
                <tr key={t.id} className="border-b border-border/40 hover:bg-secondary/20">
                  <td className="p-3">
                    <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggleOne(t.id)} />
                  </td>
                  <td className="p-3 whitespace-nowrap">{format(parseISO(t.fecha), "dd MMM yy HH:mm")}</td>
                  <td className="p-3">{t.factura ?? "—"}</td>
                  <td className="p-3">{t.placa ?? "—"}</td>
                  <td className="p-3">{t.ciudad ?? "—"}</td>
                  <td className="p-3 text-right font-medium">{(t.cantidad || 0).toLocaleString()}L</td>
                  <td className="p-3 text-right font-medium">${(t.dinero_total || 0).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1">
                      <Link to={`/docket/${t.id}`} target="_blank" className="p-1.5 rounded hover:bg-secondary" title="View docket">
                        <FileText className="w-3.5 h-3.5" />
                      </Link>
                      <button onClick={() => printDocket(t.id)} className="p-1.5 rounded hover:bg-secondary" title="Print">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filtered.length > 200 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t border-border">
            Showing first 200 of {filtered.length} — refine search or export CSV for full list.
          </div>
        )}
      </div>
    </div>
  );
}