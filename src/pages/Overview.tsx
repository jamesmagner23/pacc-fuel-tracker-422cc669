import { useMemo } from "react";
import { TruckMap } from "@/components/TruckMap";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine,
} from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useRevenueCalc } from "@/hooks/useRevenueCalc";
import { format, parseISO } from "date-fns";
import { Droplets } from "lucide-react";
import { formatTime } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { KPISparklineCard } from "@/components/KPISparklineCard";
import { TodaysDeliveriesPanel } from "@/components/TodaysDeliveriesPanel";
import { useSyncLog } from "@/hooks/useTransactions";
import { MobileOverview } from "@/components/mobile/MobileOverview";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Overview() {
  const isMobile = useIsMobile();
  const { range } = useDateRange();
  const {
    filtered,
    previous,
    isLoading,
    totalRevenue,
    prevRevenue,
  } = useRevenueCalc(range);
  const { data: lastSync } = useSyncLog();

  const totalLitres = filtered.reduce((s, t) => s + (t.cantidad || 0), 0);
  const numDeliveries = filtered.length;
  const avgSize = numDeliveries > 0 ? totalLitres / numDeliveries : 0;

  const prevLitres = previous.reduce((s, t) => s + (t.cantidad || 0), 0);
  const prevDeliveries = previous.length;
  const prevAvgSize = prevDeliveries > 0 ? prevLitres / prevDeliveries : 0;

  // Return null when there's no prior baseline to compare to. Otherwise we'd
  // show "+100%" on every metric the first time a customer loads data, which
  // trains users to ignore the delta chip entirely.
  const pct = (curr: number, prev: number): number | null =>
    prev === 0 ? null : ((curr - prev) / prev) * 100;

  const litresPct = pct(totalLitres, prevLitres);
  const revPct = pct(totalRevenue, prevRevenue);
  const delPct = pct(numDeliveries, prevDeliveries);
  const avgPct = pct(avgSize, prevAvgSize);

  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => { if (t.date) map[t.date] = (map[t.date] || 0) + (t.cantidad || 0); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, litres]) => ({ date: format(parseISO(date), "d MMM"), litres }));
  }, [filtered]);

  const trendForTile = useMemo(() => dailyData.map((d) => ({ v: d.litres })), [dailyData]);

  const lastSyncTime = lastSync?.synced_at ? formatTime(lastSync.synced_at) : null;

  const litresFallback = (() => {
    if (range === "today" && totalLitres === 0) return "No deliveries yet today";
    if (lastSyncTime && filtered.length > 0) return `Live · most recent at ${lastSyncTime}`;
    return "Comparison resumes with previous period data";
  })();
  const revenueFallback = (() => {
    if (range === "today" && totalRevenue === 0) return "No revenue today yet";
    return "Comparison resumes with previous period data";
  })();
  const deliveryFallback = (() => {
    if (range === "today" && numDeliveries === 0) return "No deliveries yet today";
    return "Comparison resumes with previous period data";
  })();
  const avgFallback = "Comparison resumes with previous period data";

  const periodLabel = range === "today" ? "Today" : range === "week" ? "This Week" : "This Month";

  // Inline page wrapper bg uses --muted so cards pop.
  const pageBg = "bg-muted/60";

  if (isMobile) return <MobileOverview />;

  if (isLoading) {
    return (
      <div className={`-mx-3 sm:-mx-6 md:-mx-8 -my-4 sm:-my-6 md:-my-8 px-3 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8 ${pageBg} min-h-full`}>
        <PageHeader title="Overview" subtitle="Real-time fuel delivery performance and insights" />
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className={`-mx-3 sm:-mx-6 md:-mx-8 -my-4 sm:-my-6 md:-my-8 px-3 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8 ${pageBg} min-h-full`}>
        <PageHeader title="Overview" subtitle="Real-time fuel delivery performance and insights" />
        <div className="flex flex-col items-center justify-center text-muted-foreground gap-3 py-12">
          <Droplets className="w-6 h-6" />
          <p className="text-sm">No transactions. Use <strong className="text-foreground">Sync now</strong> in the sidebar to pull data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`-mx-3 sm:-mx-6 md:-mx-8 -my-4 sm:-my-6 md:-my-8 px-3 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8 ${pageBg} min-h-full`}>
      <PageHeader title="Overview" subtitle="Real-time fuel delivery performance and insights" />

      {/* KPI grid — 4 across at xl */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPISparklineCard
          label="Total Litres Delivered"
          value={totalLitres >= 1000 ? `${(totalLitres / 1000).toFixed(2)}k L` : `${totalLitres.toFixed(1)} L`}
          deltaPct={litresPct}
          trend={trendForTile}
          fallbackContext={litresFallback}
          href="/finance"
        />
        <KPISparklineCard
          label="Revenue"
          value={"$" + totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          deltaPct={revPct}
          trend={trendForTile}
          fallbackContext={revenueFallback}
          href="/finance"
        />
        <KPISparklineCard
          label="Deliveries"
          value={numDeliveries.toLocaleString()}
          deltaPct={delPct}
          trend={trendForTile}
          fallbackContext={deliveryFallback}
          href="/dispatch"
        />
        <KPISparklineCard
          label="Avg Size"
          value={Math.round(avgSize).toLocaleString() + " L"}
          deltaPct={avgPct}
          trend={trendForTile}
          fallbackContext={avgFallback}
          href="/dispatch"
        />
      </div>

      {/* Today's operations: deliveries + map */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4">
        <div className="lg:col-span-3">
          <TodaysDeliveriesPanel />
        </div>
        <div className="lg:col-span-2">
          <LiveTruckPanel lastSyncTime={lastSyncTime} />
        </div>
      </div>

      {/* Bottom trend chart */}
      <div className="mt-4 bg-card border border-border rounded-xl p-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Litres delivered</h2>
          <span className="text-sm text-muted-foreground">{periodLabel}</span>
        </div>
        <div style={{ height: 200 }}>
          {dailyData.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={32}
                />
                <YAxis hide />
                <ReferenceLine
                  y={median(dailyData.map((d) => d.litres))}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />
                <Tooltip
                  contentStyle={{ background: "var(--card, #fff)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
                  labelStyle={{ color: "var(--foreground)" }}
                  itemStyle={{ color: "var(--foreground)" }}
                  formatter={(v: number) => [`${v.toLocaleString()} L`, "Litres"]}
                  cursor={{ stroke: "rgba(0,0,0,0.06)", strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="litres"
                  stroke="var(--foreground)"
                  strokeWidth={1.5}
                  dot={(props: any) => {
                    if (props.index !== dailyData.length - 1) return null as any;
                    return <circle key="last" cx={props.cx} cy={props.cy} r={4} fill="var(--accent)" stroke="none" />;
                  }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-center px-6 text-muted-foreground text-sm">
              Trend appears with 2+ data points. Switch to This Week or This Month to see history.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function LiveTruckPanel({ lastSyncTime }: { lastSyncTime: string | null }) {
  return (
    <div className="bg-card border border-border rounded-xl flex flex-col h-[440px]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <h2 className="text-base font-semibold text-foreground">Live truck location</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Live{lastSyncTime ? ` · ${lastSyncTime}` : ""}
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <TruckMap bare showStops />
      </div>
    </div>
  );
}
