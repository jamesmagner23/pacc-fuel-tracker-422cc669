import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useTriggerBrandTGP } from "@/hooks/useRetailBowserPrices";
import { useToast } from "@/hooks/use-toast";

const BRAND_COLORS: Record<string, string> = {
  Ampol: "hsl(var(--primary))",
  Viva: "hsl(200 80% 60%)",
  BP: "hsl(140 60% 50%)",
  Mobil: "hsl(0 70% 60%)",
  "7-Eleven": "hsl(35 90% 55%)",
  AIP: "hsl(var(--muted-foreground))",
};

const ALL_BRANDS = ["Ampol", "Viva", "BP", "Mobil", "7-Eleven", "AIP"];

function useBrandTGP(days: number) {
  return useQuery({
    queryKey: ["brand-tgp", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data, error } = await supabase
        .from("terminal_gate_prices")
        .select("price_date, source, price_cpl")
        .eq("location", "Melbourne")
        .eq("product", "Diesel")
        .gte("price_date", since.toISOString().slice(0, 10))
        .order("price_date", { ascending: true });
      if (error) throw error;
      return data as Array<{ price_date: string; source: string; price_cpl: number }>;
    },
  });
}

export function MarketTGPCompareTab() {
  const [days, setDays] = useState(7);
  const [showInc, setShowInc] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const { data = [], isLoading, refetch } = useBrandTGP(days);
  const trigger = useTriggerBrandTGP();

  const chartData = useMemo(() => {
    const conv = (p: number) => (showInc ? p * 1.1 : p);
    const map = new Map<string, Record<string, number | string>>();
    for (const r of data) {
      const cur = map.get(r.price_date) || { date: r.price_date };
      cur[r.source] = +conv(r.price_cpl).toFixed(2);
      map.set(r.price_date, cur);
    }
    return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [data, showInc]);

  // Today snapshot per brand
  const today = chartData[chartData.length - 1] as Record<string, number | string> | undefined;
  const aipToday = typeof today?.AIP === "number" ? today.AIP : null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const r = await trigger() as { results?: Array<{ brand: string; price: number | null }> };
      const ok = r.results?.filter(x => x.price != null).length ?? 0;
      toast({ title: "Brand TGP refreshed", description: `${ok}/${r.results?.length ?? 0} brands captured` });
      await refetch();
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
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-[12px] rounded ${days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >{d}d</button>
          ))}
        </div>
        <div className="flex gap-1 bg-surface border border-surface-border rounded-md p-0.5">
          <button onClick={() => setShowInc(true)} className={`px-3 py-1.5 text-[12px] rounded ${showInc ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Inc GST</button>
          <button onClick={() => setShowInc(false)} className={`px-3 py-1.5 text-[12px] rounded ${!showInc ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Ex GST</button>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-auto px-3 py-1.5 text-[12px] rounded-md bg-surface border border-surface-border text-foreground hover:bg-surface-elevated disabled:opacity-50"
        >{refreshing ? "Fetching…" : "Refresh now"}</button>
      </div>

      {/* Brand snapshot tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {ALL_BRANDS.map(brand => {
          const v = typeof today?.[brand] === "number" ? (today![brand] as number) : null;
          const delta = v != null && aipToday != null ? v - aipToday : null;
          const cheapest = v != null && Math.min(...ALL_BRANDS.filter(b => b !== "AIP").map(b => typeof today?.[b] === "number" ? (today![b] as number) : Infinity)) === v;
          return (
            <div key={brand} className={`bg-surface border rounded-[10px] p-3 ${cheapest ? "border-positive/50" : "border-surface-border"}`}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: BRAND_COLORS[brand] }} />
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{brand}</span>
              </div>
              <div className="text-lg font-semibold text-foreground tabular-nums mt-1">
                {v != null ? `${v.toFixed(1)}¢` : "—"}
              </div>
              {delta != null && brand !== "AIP" && (
                <div className={`text-[10px] tabular-nums ${delta < 0 ? "text-positive" : "text-destructive"}`}>
                  {delta >= 0 ? "+" : ""}{delta.toFixed(1)} vs AIP
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4">
        <div className="text-[12px] text-muted-foreground mb-2">
          Melbourne diesel TGP — {showInc ? "Inc GST" : "Ex GST"}
        </div>
        <div className="h-[300px]">
          {isLoading ? (
            <div className="text-[12px] text-muted-foreground">Loading…</div>
          ) : chartData.length === 0 ? (
            <div className="text-[12px] text-muted-foreground">No brand TGP data yet. Click "Refresh now" to scrape today's prices.</div>
          ) : (
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid stroke="hsl(var(--surface-border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} domain={["auto", "auto"]} unit="¢" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--surface-border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                  formatter={(v: number) => `${v.toFixed(2)}¢`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {ALL_BRANDS.map(brand => (
                  <Line
                    key={brand}
                    type="monotone"
                    dataKey={brand}
                    stroke={BRAND_COLORS[brand]}
                    strokeWidth={brand === "AIP" ? 1.5 : 2}
                    strokeDasharray={brand === "AIP" ? "4 4" : undefined}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Each brand's published Melbourne diesel TGP is scraped daily. AIP shows the all-major city average as the dashed reference line.
      </p>
    </div>
  );
}