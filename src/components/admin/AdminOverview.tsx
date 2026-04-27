import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, subDays } from "date-fns";
import { Users, Truck, Briefcase, AlertTriangle, Activity, Database } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAllTransactions, useSyncLog } from "@/hooks/useTransactions";

export default function AdminOverview() {
  const { data: txns = [] } = useAllTransactions();
  const { data: syncLog } = useSyncLog();

  const { data: users = [] } = useQuery({
    queryKey: ["admin-overview-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clientCount = 0 } = useQuery({
    queryKey: ["admin-overview-clients"],
    queryFn: async () => {
      const { count } = await supabase.from("client_accounts").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: alertsOpen = 0 } = useQuery({
    queryKey: ["admin-overview-alerts"],
    queryFn: async () => {
      const { count } = await supabase.from("reconciliation_alerts").select("*", { count: "exact", head: true }).eq("status", "new");
      return count || 0;
    },
  });

  const cutoff30 = subDays(new Date(), 30);
  const recent = txns.filter((t) => new Date(t.fecha) >= cutoff30);
  const totalLitres30 = recent.reduce((s, t) => s + (t.cantidad || 0), 0);
  const totalRevenue30 = recent.reduce((s, t) => s + (t.dinero_total || 0), 0);
  const activeCustomers = new Set(recent.map((t) => t.nombre_cliente1)).size;

  const dailyChart = useMemo(() => {
    const map: Record<string, number> = {};
    recent.forEach((t) => { if (t.date) map[t.date] = (map[t.date] || 0) + (t.cantidad || 0); });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, l]) => ({ date: format(parseISO(d), "dd MMM"), litres: l }));
  }, [recent]);

  const adminCount = users.filter((u) => u.role === "admin").length;
  const driverCount = users.filter((u) => u.role === "driver").length;
  const userClientCount = users.filter((u) => u.role === "client").length;

  const kpis = [
    { label: "Litres (30d)", value: `${totalLitres30.toLocaleString()}L`, icon: <Truck className="w-4 h-4" /> },
    { label: "Revenue (30d)", value: `$${totalRevenue30.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: <Briefcase className="w-4 h-4" /> },
    { label: "Active Customers", value: activeCustomers, icon: <Users className="w-4 h-4" /> },
    { label: "Open Alerts", value: alertsOpen, icon: <AlertTriangle className="w-4 h-4" /> },
    { label: "Total Users", value: users.length, icon: <Activity className="w-4 h-4" /> },
    { label: "Client Accounts", value: clientCount, icon: <Database className="w-4 h-4" /> },
  ];

  const accent = "hsl(var(--primary))";
  const muted = "hsl(var(--muted-foreground))";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-surface border border-surface-border rounded-[10px] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</span>
              <span className="text-muted-foreground">{k.icon}</span>
            </div>
            <div className="text-xl font-semibold text-foreground tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-surface border border-surface-border rounded-[10px] p-5">
          <h2 className="text-sm font-semibold mb-3">Daily Litres — Last 30 Days</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={dailyChart}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--primary) / 0.4)", strokeWidth: 1 }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--primary) / 0.4)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "hsl(var(--foreground))",
                    boxShadow: "0 8px 24px -8px hsl(0 0% 0% / 0.5)",
                    padding: "8px 10px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]}
                />
                <Line type="monotone" dataKey="litres" stroke={accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface border border-surface-border rounded-[10px] p-5 space-y-3">
          <h2 className="text-sm font-semibold">System Status</h2>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Last Sync</div>
            <div className="text-sm font-medium">
              {syncLog?.synced_at ? format(parseISO(syncLog.synced_at), "dd MMM yy HH:mm") : "Never"}
            </div>
            {syncLog && (
              <div className="text-[11px] text-muted-foreground">
                {syncLog.records_upserted ?? 0} records · {syncLog.status}
              </div>
            )}
          </div>
          <div className="border-t border-border pt-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">User Breakdown</div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span>Admins</span><span className="font-semibold">{adminCount}</span></div>
              <div className="flex justify-between"><span>Clients</span><span className="font-semibold">{userClientCount}</span></div>
              <div className="flex justify-between"><span>Drivers</span><span className="font-semibold">{driverCount}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}