import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Truck, FolderKanban, Download, Printer, FileText, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllTransactions } from "@/hooks/useTransactions";
import { usePlantItems, useDeletePlantItem, type PlantItem } from "@/hooks/usePlantItems";
import { useProjects, useProjectAssignments, useDeleteProject, type Project } from "@/hooks/useProjects";
import { useFtcRates, type FtcRate } from "@/hooks/useFtcRates";
import { useTransactionOverrides } from "@/hooks/useTransactionOverrides";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PlantItemModal } from "@/components/customer/PlantItemModal";
import { ProjectModal } from "@/components/customer/ProjectModal";
import { PlantBoard } from "@/components/customer/PlantBoard";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO, subDays, startOfMonth, startOfYear } from "date-fns";
import { SpeedSolValue } from "@/components/SpeedSolValue";
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
  const { data: ftcRates = [] } = useFtcRates();

  const customerTxns = useMemo(
    () => allTxns.filter((t) => t.nombre_cliente1 === customerName),
    [allTxns, customerName]
  );

  const customerTxnIds = useMemo(
    () => customerTxns.map((t: any) => t.id).filter((n: any) => Number.isFinite(n)),
    [customerTxns]
  );
  const { data: overrides = {} } = useTransactionOverrides(customerTxnIds);

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
          <p className="text-xs text-primary mt-1">
            No client account linked yet. Link this Fuel System name in Customers → Client Pricing to enable equipment & projects.
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
              className="px-3 sm:px-4 py-2.5 text-[12px] sm:text-[13px] rounded-none border-b-2 border-transparent bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:!text-foreground data-[state=active]:shadow-none whitespace-nowrap shrink-0"
            >
              {t.l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <OverviewTab txns={customerTxns} equipment={equipmentList} projects={projects} ftcRates={ftcRates} />
        </TabsContent>
        <TabsContent value="equipment" className="mt-5">
          <EquipmentTab equipment={equipmentList} clientAccountId={clientAccountId} txns={customerTxns} ftcRates={ftcRates} />
        </TabsContent>
        <TabsContent value="projects" className="mt-5">
          <ProjectsTab projects={projects} assignments={assignments} equipment={equipmentList} txns={customerTxns} clientAccountId={clientAccountId} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-5">
          <AnalyticsTab txns={customerTxns} equipment={equipmentList} projects={projects} assignments={assignments} overrides={overrides} />
        </TabsContent>
        <TabsContent value="transactions" className="mt-5">
          <TransactionsTab txns={customerTxns} customerName={customerName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- OVERVIEW ---------------- */
function OverviewTab({ txns, equipment, projects, ftcRates }: { txns: any[]; equipment: any[]; projects: Project[]; ftcRates: FtcRate[] }) {
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

  // FTC rollup: per-category claimable based on plant_items.ftc_rate_id and matching txn litres by placa
  const ftcRollup = useMemo(() => {
    const rateById: Record<string, FtcRate> = {};
    ftcRates.forEach((r) => { rateById[r.id] = r; });
    const byCategory: Record<string, { name: string; rate: number; litres: number; claim: number; items: number }> = {};
    let unclassifiedLitres = 0;
    let unclassifiedItems = 0;
    equipment.forEach((e: any) => {
      const rateId = e.enriched?.ftc_rate_id;
      const rate = rateId ? rateById[rateId] : null;
      if (!rate) {
        if (e.litres > 0) { unclassifiedLitres += e.litres; unclassifiedItems += 1; }
        return;
      }
      if (!byCategory[rate.id]) {
        byCategory[rate.id] = { name: rate.equipment_type, rate: Number(rate.rate_per_litre), litres: 0, claim: 0, items: 0 };
      }
      byCategory[rate.id].litres += e.litres;
      byCategory[rate.id].claim += e.litres * Number(rate.rate_per_litre);
      byCategory[rate.id].items += 1;
    });
    const rows = Object.values(byCategory).sort((a, b) => b.claim - a.claim);
    const totalClaim = rows.reduce((s, r) => s + r.claim, 0);
    return { rows, totalClaim, unclassifiedLitres, unclassifiedItems };
  }, [equipment, ftcRates]);

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

      <div className="glass-card p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold">Fuel Tax Credit Estimate</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Based on delivered litres × ATO rate per FTC category. Indicative only.</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Claimable</div>
            <div className="text-xl font-bold text-primary">${ftcRollup.totalClaim.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
        {ftcRollup.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">
            No equipment has an FTC category assigned yet. Open a plant item under <strong>Plant &amp; Equipment</strong> and pick a Fuel Tax Credit Category.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3 text-right">Items</th>
                  <th className="pb-2 pr-3 text-right">Litres</th>
                  <th className="pb-2 pr-3 text-right">Rate (c/L)</th>
                  <th className="pb-2 text-right">Claim</th>
                </tr>
              </thead>
              <tbody>
                {ftcRollup.rows.map((r) => (
                  <tr key={r.name} className="border-b border-border/50">
                    <td className="py-2 pr-3">{r.name}</td>
                    <td className="py-2 pr-3 text-right">{r.items}</td>
                    <td className="py-2 pr-3 text-right">{r.litres.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right">{(r.rate * 100).toFixed(1)}</td>
                    <td className="py-2 text-right font-semibold">${r.claim.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ftcRollup.unclassifiedLitres > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3">
            {ftcRollup.unclassifiedItems} item{ftcRollup.unclassifiedItems !== 1 ? "s" : ""} with {ftcRollup.unclassifiedLitres.toLocaleString()}L delivered have no FTC category assigned and are excluded.
          </p>
        )}
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
  ftcRates,
}: {
  equipment: any[];
  clientAccountId: number | null;
  txns: any[];
  ftcRates: FtcRate[];
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
  const selectedRate = useMemo(() => {
    const id = selectedItem?.enriched?.ftc_rate_id;
    return id ? ftcRates.find((r) => r.id === id) : null;
  }, [selectedItem, ftcRates]);
  const selectedClaim = selectedRate ? (selectedItem?.litres || 0) * Number(selectedRate.rate_per_litre) : 0;

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
              onClick={() => {
                if (!e.enriched) {
                  handleEdit(e);
                } else {
                  setSelected(e.placa);
                }
              }}
              className="glass-card p-4 text-left hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{e.enriched?.name || e.placa || "Unnamed"}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {e.enriched?.display_asset_id || e.placa}
                    {e.enriched?.display_asset_id && e.placa && e.enriched.display_asset_id !== e.placa && (
                      <> · <span className="opacity-60">{e.placa}</span></>
                    )}
                    {e.enriched?.equipment_type && <> · {e.enriched.equipment_type}</>}
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
                {selectedItem.enriched?.display_asset_id && (
                  <><span className="font-semibold text-foreground">{selectedItem.enriched.display_asset_id}</span> · </>
                )}
                <span className="opacity-70">SpeedSol: {selectedItem.placa}</span>
                {selectedItem.enriched?.equipment_type && <> · {selectedItem.enriched.equipment_type}</>}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg border border-border bg-secondary/30">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">FTC Category</div>
              <div className="text-sm font-medium mt-0.5">{selectedRate?.equipment_type || "— Not set —"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rate</div>
              <div className="text-sm font-medium mt-0.5">{selectedRate ? `${(Number(selectedRate.rate_per_litre) * 100).toFixed(1)}c/L` : "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Claimable (all-time)</div>
              <div className="text-sm font-bold text-primary mt-0.5">${selectedClaim.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            </div>
          </div>

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

  // Pull transaction-level overrides (from the Tag Deliveries page) so a
  // delivery tagged directly to a project counts even if its placa isn't on
  // the plant board.
  const txnIds = useMemo(() => txns.map((t: any) => t.id), [txns]);
  const { data: overrides = [] } = useQuery({
    queryKey: ["customer-tx-overrides", clientAccountId, txnIds.length],
    enabled: txnIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_overrides")
        .select("transaction_id, project_id, plant_item_id")
        .in("transaction_id", txnIds);
      if (error) throw error;
      return data || [];
    },
  });

  if (!clientAccountId) {
    return <div className="glass-card p-6 text-sm text-muted-foreground">Link a client account first to manage projects.</div>;
  }

  // Date range for the selected project drill-down
  const [rangeKey, setRangeKey] = useState<"7d" | "30d" | "month" | "ytd" | "all">("all");
  const rangeStart = useMemo(() => {
    const now = new Date();
    if (rangeKey === "7d") return subDays(now, 7);
    if (rangeKey === "30d") return subDays(now, 30);
    if (rangeKey === "month") return startOfMonth(now);
    if (rangeKey === "ytd") return startOfYear(now);
    return null;
  }, [rangeKey]);

  // Build a map: project_id → { itemIds, placas } from BOTH assignments and overrides
  const projectMembership = useMemo(() => {
    const map: Record<string, { itemIds: Set<string>; placas: Set<string> }> = {};
    const ensure = (pid: string) => {
      if (!map[pid]) map[pid] = { itemIds: new Set(), placas: new Set() };
      return map[pid];
    };
    assignments.forEach((a: any) => {
      const m = ensure(a.project_id);
      m.itemIds.add(a.plant_item_id);
      const eq = equipment.find((e: any) => e.enriched?.id === a.plant_item_id);
      if (eq?.placa) m.placas.add(eq.placa);
    });
    // Overrides that pin a plant_item to a project also imply membership
    overrides.forEach((o: any) => {
      if (!o.project_id) return;
      const m = ensure(o.project_id);
      if (o.plant_item_id) {
        m.itemIds.add(o.plant_item_id);
        const eq = equipment.find((e: any) => e.enriched?.id === o.plant_item_id);
        if (eq?.placa) m.placas.add(eq.placa);
      }
    });
    return map;
  }, [assignments, overrides, equipment]);

  const filterByRange = (list: any[]) =>
    rangeStart ? list.filter((t) => t.fecha && parseISO(t.fecha) >= rangeStart) : list;

  const ovById: Record<number, any> = useMemo(() => {
    const o: Record<number, any> = {};
    overrides.forEach((x: any) => { o[x.transaction_id] = x; });
    return o;
  }, [overrides]);

  const getProjectTxns = (projectId: string) => {
    const m = projectMembership[projectId] || { itemIds: new Set(), placas: new Set() };
    return filterByRange(
      txns.filter((t: any) => {
        const ov = ovById[t.id];
        if (ov) {
          if (ov.project_id) return ov.project_id === projectId;
          if (ov.plant_item_id) return m.itemIds.has(ov.plant_item_id);
          return false;
        }
        return t.placa && m.placas.has(t.placa);
      })
    );
  };

  const projectStats = (projectId: string) => {
    const m = projectMembership[projectId] || { itemIds: new Set(), placas: new Set() };
    const projectTxns = getProjectTxns(projectId);
    return {
      itemCount: m.itemIds.size,
      litres: projectTxns.reduce((s, t) => s + (t.cantidad || 0), 0),
      deliveries: projectTxns.length,
    };
  };

  const selectedProject = projects.find((p) => p.id === selected);
  const selectedTxns = selected ? getProjectTxns(selected) : [];
  const selectedMembership = selected ? projectMembership[selected] : null;
  const selectedItems = selected
    ? equipment.filter((e: any) => e.enriched && selectedMembership?.itemIds.has(e.enriched.id))
    : [];
  const selectedRevenue = selectedTxns.reduce((s, t) => s + (t.dinero_total || 0), 0);

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

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Plant Assignment Board
        </h3>
        <PlantBoard
          projects={projects}
          equipment={equipment}
          assignments={assignments}
          clientAccountId={clientAccountId}
        />
      </div>

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

          {/* Date range pills */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { k: "7d", l: "7 days" },
              { k: "30d", l: "30 days" },
              { k: "month", l: "This month" },
              { k: "ytd", l: "YTD" },
              { k: "all", l: "All time" },
            ] as const).map((opt) => (
              <button
                key={opt.k}
                onClick={() => setRangeKey(opt.k)}
                className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                  rangeKey === opt.k
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Equipment</div>
              <div className="text-lg font-bold mt-0.5">{selectedItems.length}</div>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Deliveries</div>
              <div className="text-lg font-bold mt-0.5">{selectedTxns.length}</div>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Litres</div>
              <div className="text-lg font-bold mt-0.5">{selectedTxns.reduce((s, t) => s + (t.cantidad || 0), 0).toLocaleString()}L</div>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</div>
              <div className="text-lg font-bold mt-0.5">${selectedRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
          </div>

          {/* Equipment on project */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Equipment on this project ({selectedItems.length})
            </h3>
            {selectedItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No equipment assigned yet. Assign items in the Plant Assignment Board above, or tag deliveries directly to this project.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {selectedItems.map((e: any) => {
                  const itemTxns = selectedTxns.filter((t: any) => {
                    const ov = ovById[t.id];
                    if (ov?.plant_item_id) return ov.plant_item_id === e.enriched.id;
                    return t.placa === e.placa;
                  });
                  const itemLitres = itemTxns.reduce((s: number, t: any) => s + (t.cantidad || 0), 0);
                  return (
                    <div key={e.enriched.id} className="rounded-lg border border-border bg-secondary/20 p-3">
                      <div className="font-medium text-sm truncate">{e.enriched.name || e.placa}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {e.enriched.display_asset_id || e.placa}
                        {e.enriched.equipment_type && <> · {e.enriched.equipment_type}</>}
                      </div>
                      <div className="mt-2 flex items-end justify-between">
                        <div className="text-base font-bold">{itemLitres.toLocaleString()}L</div>
                        <div className="text-[10px] text-muted-foreground">{itemTxns.length} fills</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent deliveries on project */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Deliveries ({selectedTxns.length})
              </h3>
              <span
                title="Every litre, price and plate shown here comes directly from SpeedSol. Project/equipment tagging is metadata only — it never modifies the source delivery."
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/30"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Source: SpeedSol (source of truth)
              </span>
            </div>
            {selectedTxns.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No deliveries in this period. Tag deliveries to this project from Tag Deliveries, or assign equipment in the Plant Assignment Board.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="pb-2 pr-3">Date</th>
                      <th className="pb-2 pr-3">Equipment</th>
                      <th className="pb-2 pr-3">Location</th>
                      <th className="pb-2 pr-3">Why counted?</th>
                      <th className="pb-2 pr-3 text-right">Litres</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTxns
                      .slice()
                      .sort((a: any, b: any) => (b.fecha || "").localeCompare(a.fecha || ""))
                      .slice(0, 25)
                      .map((t: any) => {
                        const ov = ovById[t.id];
                        let reasonLabel = "Equipment match";
                        let reasonDetail = `Plate ${t.placa || "—"} is assigned to this project on the Plant Assignment Board.`;
                        let tone: "primary" | "accent" | "muted" = "muted";
                        if (ov?.project_id === selected) {
                          reasonLabel = "Tagged to project";
                          reasonDetail = `Manually tagged to this project from Tag Deliveries${ov.notes ? ` — “${ov.notes}”` : ""}.`;
                          tone = "primary";
                        } else if (ov?.plant_item_id) {
                          const item = equipment.find((e: any) => e.enriched?.id === ov.plant_item_id);
                          const itemName = item?.enriched?.name || item?.placa || "an item";
                          reasonLabel = "Tagged to equipment";
                          reasonDetail = `Manually tagged to ${itemName}, which is assigned to this project.`;
                          tone = "accent";
                        }
                        const toneClass =
                          tone === "primary"
                            ? "bg-primary/15 text-primary border-primary/30"
                            : tone === "accent"
                            ? "bg-accent/15 text-accent border-accent/30"
                            : "bg-secondary/40 text-foreground border-border";
                        return (
                          <tr key={t.id} className="border-b border-border/50">
                            <td className="py-2 pr-3 whitespace-nowrap">{format(parseISO(t.fecha), "dd MMM HH:mm")}</td>
                            <td className="py-2 pr-3">{t.placa || "—"}</td>
                            <td className="py-2 pr-3">{t.ciudad || t.estacion || "—"}</td>
                            <td className="py-2 pr-3">
                              <span
                                title={reasonDetail}
                                className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${toneClass}`}
                              >
                                {reasonLabel}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-right">{(t.cantidad || 0).toLocaleString()}L</td>
                            <td className="py-2 text-right">${(t.dinero_total || 0).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
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
  overrides,
}: {
  txns: any[];
  equipment: any[];
  projects: Project[];
  assignments: any[];
  overrides: Record<number, { project_id: string | null; plant_item_id: string | null }>;
}) {
  const accent = "var(--accent)";
  const muted = "var(--text-secondary)";

  const equipmentChart = equipment.slice(0, 10).map((e) => ({
    name: e.enriched?.name || e.placa || "—",
    litres: e.litres,
  }));

  const projectChart = useMemo(
    () =>
      projects.map((p) => {
        const ids = assignments.filter((a) => a.project_id === p.id).map((a) => a.plant_item_id);
        const placas = equipment.filter((e) => e.enriched && ids.includes(e.enriched.id)).map((e) => e.placa);
        const litres = txns.reduce((s, t) => {
          const ov = overrides[t.id];
          // Manual override wins
          if (ov) {
            if (ov.project_id === p.id) return s + (t.cantidad || 0);
            if (ov.plant_item_id && ids.includes(ov.plant_item_id)) return s + (t.cantidad || 0);
            return s;
          }
          // Fall back to placa-based inheritance
          if (placas.includes(t.placa)) return s + (t.cantidad || 0);
          return s;
        }, 0);
        return { name: p.name, litres };
      }),
    [projects, assignments, equipment, txns, overrides]
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

  const tt = { backgroundColor: "var(--surface)", border: "1px solid var(--surface-border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" };

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