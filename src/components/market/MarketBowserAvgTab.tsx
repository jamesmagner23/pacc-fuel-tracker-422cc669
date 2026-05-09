import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { useRetailBowserPrices, useDriverIntakeAvg, useTriggerRetailBowser } from "@/hooks/useRetailBowserPrices";
import { useToast } from "@/hooks/use-toast";

const COLORS = {
  AIP_Retail: "hsl(var(--primary))",
  Driver: "hsl(45 95% 60%)",
};

export function MarketBowserAvgTab() {
  const [days, setDays] = useState(30);
  const [showInc, setShowInc] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const { data: bowser = [], isLoading } = useRetailBowserPrices(days);
  const { data: driver = [] } = useDriverIntakeAvg(days);
  const trigger = useTriggerRetailBowser();

  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; AIP_Retail?: number; Driver?: number }>();
    const conv = (p: number) => (showInc ? p : p / 1.1);
    for (const r of bowser) {
      const d = r.price_date;
      const cur = map.get(d) || { date: d };
      if (r.source === "AIP_Retail") cur.AIP_Retail = +conv(r.price_inc_gst).toFixed(2);
      map.set(d, cur);
    }
    for (const r of driver) {
      const cur = map.get(r.date) || { date: r.date };
      cur.Driver = +conv(r.avg).toFixed(2);
      map.set(r.date, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [bowser, driver, showInc]);

  const last = chartData[chartData.length - 1];
  const aip7 = chartData.slice(-7).map(d => d.AIP_Retail).filter((n): n is number => n != null);
  const drv7 = chartData.slice(-7).map(d => d.Driver).filter((n): n is number => n != null);
  const aipAvg7 = aip7.length ? aip7.reduce((s, n) => s + n, 0) / aip7.length : null;
  const drvAvg7 = drv7.length ? drv7.reduce((s, n) => s + n, 0) / drv7.length : null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const r = await trigger();
      toast({ title: "Bowser data refreshed", description: `${(r as { upserted?: number })?.upserted ?? 0} records` });
    } catch (e) {
      toast({ title: "Refresh failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-surface border border-surface-border rounded-md p-0.5">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-[12px] rounded ${days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {d}d
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-surface border border-surface-border rounded-md p-0.5">
          <button
            onClick={() => setShowInc(true)}
            className={`px-3 py-1.5 text-[12px] rounded ${showInc ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >Inc GST</button>
          <button
            onClick={() => setShowInc(false)}
            className={`px-3 py-1.5 text-[12px] rounded ${!showInc ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >Ex GST</button>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-auto px-3 py-1.5 text-[12px] rounded-md bg-surface border border-surface-border text-foreground hover:bg-surface-elevated disabled:opacity-50"
        >
          {refreshing ? "Fetching…" : "Refresh now"}
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-surface border border-surface-border rounded-[10px] p-4">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">AIP Retail (latest)</div>
          <div className="text-xl font-semibold text-foreground tabular-nums mt-1">
            {last?.AIP_Retail != null ? `${last.AIP_Retail.toFixed(1)}¢` : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">7d avg {aipAvg7 != null ? `${aipAvg7.toFixed(1)}¢` : "—"}</div>
        </div>
        <div className="bg-surface border border-surface-border rounded-[10px] p-4">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Our drivers (avg)</div>
          <div className="text-xl font-semibold text-foreground tabular-nums mt-1">
            {last?.Driver != null ? `${last.Driver.toFixed(1)}¢` : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">7d avg {drvAvg7 != null ? `${drvAvg7.toFixed(1)}¢` : "—"}</div>
        </div>
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 col-span-2 sm:col-span-1">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Spread (driver − AIP)</div>
          <div className="text-xl font-semibold text-foreground tabular-nums mt-1">
            {drvAvg7 != null && aipAvg7 != null ? `${(drvAvg7 - aipAvg7).toFixed(1)}¢` : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">positive = paying above market</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4">
        <div className="text-[12px] text-muted-foreground mb-2">
          Melbourne retail diesel — {showInc ? "Inc GST" : "Ex GST"}
        </div>
        <div className="h-[280px]">
          {isLoading ? (
            <div className="text-[12px] text-muted-foreground">Loading…</div>
          ) : chartData.length === 0 ? (
            <div className="text-[12px] text-muted-foreground">No data yet — click "Refresh now" to fetch the latest AIP weekly retail diesel price.</div>
          ) : (
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid stroke="hsl(var(--surface-border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} domain={["auto", "auto"]} unit="¢" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--surface-border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                  formatter={(v: number) => `${v.toFixed(1)}¢`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="AIP_Retail" name="AIP weekly" stroke={COLORS.AIP_Retail} strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="Driver" name="Our drivers" stroke={COLORS.Driver} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        AIP publishes the Melbourne metro retail diesel average weekly. Our driver line averages the bowser_retail_price recorded by drivers when they fill up, grouped by day.
      </p>
    </div>
  );
}