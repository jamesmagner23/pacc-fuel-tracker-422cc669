import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import { useCrmCustomers, type CrmActivity } from "@/hooks/useCrm";

const STAGE_COLORS = ["#f04a1a", "#f59e0b", "#3b82f6", "#22c55e", "#94a3b8"];

export default function CrmInsights() {
  const { data: customers } = useCrmCustomers();
  const [activities, setActivities] = useState<CrmActivity[]>([]);

  useEffect(() => {
    void (async () => {
      const since = new Date(Date.now() - 14 * 86400_000).toISOString();
      const { data } = await supabase
        .from("crm_activities")
        .select("*")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false });
      setActivities((data ?? []) as CrmActivity[]);
    })();
  }, []);

  const acqStageData = useMemo(() => {
    const stages = ["new", "contacted", "quoted", "won", "lost"];
    return stages.map(s => ({
      stage: s,
      count: customers.filter(c => c.acquisition_stage === s).length,
      value: customers.filter(c => c.acquisition_stage === s).reduce((sum, c) => sum + Number(c.estimated_value || 0), 0),
    }));
  }, [customers]);

  const conversion = useMemo(() => {
    const since = Date.now() - 90 * 86400_000;
    const recent = customers.filter(c => new Date(c.created_at).getTime() >= since);
    const won = recent.filter(c => c.acquisition_stage === "won").length;
    return recent.length ? Math.round((won / recent.length) * 100) : 0;
  }, [customers]);

  const lossReasons = useMemo(() => {
    const counts: Record<string, number> = {};
    customers.filter(c => c.acquisition_stage === "lost" && c.lost_reason).forEach(c => {
      counts[c.lost_reason!] = (counts[c.lost_reason!] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [customers]);

  const activityVolume = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      days[d] = 0;
    }
    activities.forEach(a => {
      const d = a.occurred_at.slice(0, 10);
      if (d in days) days[d]++;
    });
    return Object.entries(days).map(([date, count]) => ({ date: date.slice(5), count }));
  }, [activities]);

  const quietCustomers = useMemo(() => {
    const lastByCustomer = new Map<string, string>();
    activities.forEach(a => {
      const cur = lastByCustomer.get(a.customer_id);
      if (!cur || cur < a.occurred_at) lastByCustomer.set(a.customer_id, a.occurred_at);
    });
    return customers
      .filter(c => c.kind === "client" && c.retention_stage !== "churned")
      .map(c => ({ name: c.name, last: lastByCustomer.get(c.id) ?? null }))
      .sort((a, b) => {
        const at = a.last ? new Date(a.last).getTime() : 0;
        const bt = b.last ? new Date(b.last).getTime() : 0;
        return at - bt;
      })
      .slice(0, 10);
  }, [customers, activities]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 bg-surface border-surface-border">
        <h3 className="text-sm font-medium text-foreground mb-2">Pipeline by stage</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={acqStageData}>
            <XAxis dataKey="stage" stroke="var(--text-secondary)" fontSize={11} />
            <YAxis stroke="var(--text-secondary)" fontSize={11} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <Bar dataKey="count" fill="#f04a1a" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4 bg-surface border-surface-border">
        <h3 className="text-sm font-medium text-foreground mb-2">Conversion (90d)</h3>
        <div className="text-4xl font-semibold text-accent">{conversion}%</div>
        <div className="text-xs text-muted-foreground mt-1">New → Won across last 90 days</div>
      </Card>

      <Card className="p-4 bg-surface border-surface-border">
        <h3 className="text-sm font-medium text-foreground mb-2">Activity volume (14d)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={activityVolume}>
            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={10} />
            <YAxis stroke="var(--text-secondary)" fontSize={11} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <Bar dataKey="count" fill="#f04a1a" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4 bg-surface border-surface-border">
        <h3 className="text-sm font-medium text-foreground mb-2">Top loss reasons</h3>
        {lossReasons.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No lost-reason data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={lossReasons} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80}>
                {lossReasons.map((_, i) => <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="p-4 bg-surface border-surface-border md:col-span-2">
        <h3 className="text-sm font-medium text-foreground mb-2">Quiet customers — longest gap since last contact</h3>
        {quietCustomers.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">No data yet.</div>
        ) : (
          <ul className="divide-y divide-surface-border text-sm">
            {quietCustomers.map(q => (
              <li key={q.name} className="flex justify-between py-2">
                <span className="text-foreground">{q.name}</span>
                <span className="text-muted-foreground">
                  {q.last ? `last ${new Date(q.last).toLocaleDateString()}` : "never contacted"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}