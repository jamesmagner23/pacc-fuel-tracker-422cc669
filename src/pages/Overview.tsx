import { useCallback, useMemo, useState } from "react";
import { TruckMap } from "@/components/TruckMap";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Area, Line,
  PieChart, Pie, Cell,
} from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useRevenueCalc } from "@/hooks/useRevenueCalc";
import { useAllTransactions } from "@/hooks/useTransactions";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { format, parseISO, subDays } from "date-fns";
import { Droplet, DollarSign, Truck, Gauge, Droplets, Fuel, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { KPISparklineCard } from "@/components/KPISparklineCard";
import { TodaysDeliveriesPanel } from "@/components/TodaysDeliveriesPanel";
import { MobileOverview } from "@/components/mobile/MobileOverview";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSyncTransactions } from "@/hooks/useSyncTransactions";
import { useTrucks } from "@/hooks/useTrucks";
import { PACCLogo } from "@/components/PACCLogo";

const TILE_THEMES = {
  litres:    { icon: Droplet,     bg: "#E8EDE5", fg: "#2A6A2E" },
  revenue:   { icon: DollarSign,  bg: "#F4F0E6", fg: "#7A5300" },
  delivery:  { icon: Truck,       bg: "#EAEEFC", fg: "#2B3D8E" },
  avg:       { icon: Gauge,       bg: "#F4F5F1", fg: "#5F6B61" },
  buy:       { icon: Fuel,        bg: "#FBE7E1", fg: "#B43A2E" },
} as const;

const DONUT_COLORS = ["#2A6A2E", "#7A5300", "#2B3D8E", "#5F6B61", "#B43A2E", "#C7CCC1"];
const TRUCK_TINTS = ["var(--positive)", "var(--link)", "var(--warning)", "var(--destructive)", "var(--muted-foreground)"];

export default function Overview() {
  const isMobile = useIsMobile();
  const { range } = useDateRange();
  const {
    filtered: allFiltered,
    previous: allPrevious,
    isLoading,
    totalRevenue: totalRevenueAll,
    prevRevenue: prevRevenueAll,
    getTxPricing,
  } = useRevenueCalc(range);
  const { syncing, handleSync, lastSyncTime } = useSyncTransactions({ autoSync: true });
  const { data: allTxnsRaw = [] } = useAllTransactions();
  const { data: buyPrices = [] } = useBuyPrices(60);
  const { data: trucks = [] } = useTrucks();
  const [growthRange, setGrowthRange] = useState<"7d" | "30d" | "90d">("30d");
  const [selectedTruck, setSelectedTruck] = useState<string>("all");

  const truckNameLookup = useMemo(() => {
    const map = new Map<string, string>();
    trucks.forEach((truck) => {
      [truck.name, truck.speedsol_estacion].forEach((value) => {
        const key = value?.toString().trim().toLowerCase();
        if (key) map.set(key, truck.name);
      });
    });
    return map;
  }, [trucks]);

  const matchTxnTruck = useCallback(
    (t: any) => {
      const candidates = [t.estacion, t.nombre_flota, t.nombre_vendedor]
        .map((value) => value?.toString().trim())
        .filter(Boolean) as string[];
      return (
        candidates
          .map((value) => truckNameLookup.get(value.toLowerCase()))
          .find(Boolean) || null
      );
    },
    [truckNameLookup],
  );

  const filtered = useMemo(
    () =>
      selectedTruck === "all"
        ? allFiltered
        : allFiltered.filter((t) => matchTxnTruck(t) === selectedTruck),
    [allFiltered, selectedTruck, matchTxnTruck],
  );
  const previous = useMemo(
    () =>
      selectedTruck === "all"
        ? allPrevious
        : allPrevious.filter((t) => matchTxnTruck(t) === selectedTruck),
    [allPrevious, selectedTruck, matchTxnTruck],
  );
  const allTxns = useMemo(
    () =>
      selectedTruck === "all"
        ? allTxnsRaw
        : allTxnsRaw.filter((t: any) => matchTxnTruck(t) === selectedTruck),
    [allTxnsRaw, selectedTruck, matchTxnTruck],
  );

  const sumRevenueLocal = useCallback(
    (txs: any[]) => {
      let revenue = 0;
      txs.forEach((t) => {
        if (t.dinero_total && t.dinero_total > 0) {
          revenue += t.dinero_total;
        } else {
          const { hasPricing, sellPPL } = getTxPricing(t);
          if (hasPricing) revenue += (t.cantidad || 0) * sellPPL;
        }
      });
      return revenue;
    },
    [getTxPricing],
  );

  const totalRevenue =
    selectedTruck === "all" ? totalRevenueAll : sumRevenueLocal(filtered);
  const prevRevenue =
    selectedTruck === "all" ? prevRevenueAll : sumRevenueLocal(previous);

  const totalLitres = filtered.reduce((s, t) => s + (t.cantidad || 0), 0);
  const numDeliveries = filtered.length;
  const avgSize = numDeliveries > 0 ? totalLitres / numDeliveries : 0;

  const prevLitres = previous.reduce((s, t) => s + (t.cantidad || 0), 0);
  const prevDeliveries = previous.length;
  const prevAvgSize = prevDeliveries > 0 ? prevLitres / prevDeliveries : 0;

  const pct = (curr: number, prev: number): number | null =>
    prev === 0 ? null : ((curr - prev) / prev) * 100;

  const litresPct = pct(totalLitres, prevLitres);
  const revPct = pct(totalRevenue, prevRevenue);
  const delPct = pct(numDeliveries, prevDeliveries);
  const avgPct = pct(avgSize, prevAvgSize);

  // Per-truck breakdown for the current window — SpeedSol's `nombre_flota`
  // currently carries the client/fleet, so prefer estación to avoid hiding
  // Truck 1 / Truck 2 behind a single "PACC Civil" total.
  const truckBreakdown = useMemo(() => {
    const totals: Record<string, { litres: number; deliveries: number; revenue: number }> = {};
    trucks
      .filter((truck) => truck.is_active)
      .forEach((truck) => { totals[truck.name] = { litres: 0, deliveries: 0, revenue: 0 }; });

    allFiltered.forEach((t) => {
      const candidates = [t.estacion, t.nombre_flota, t.nombre_vendedor]
        .map((value) => value?.toString().trim())
        .filter(Boolean) as string[];
      const matched = candidates
        .map((value) => truckNameLookup.get(value.toLowerCase()))
        .find(Boolean);
      const k = matched || candidates[0] || "Unassigned truck";
      if (!totals[k]) totals[k] = { litres: 0, deliveries: 0, revenue: 0 };
      totals[k].litres += t.cantidad || 0;
      totals[k].deliveries += 1;
      totals[k].revenue += t.dinero_total || 0;
    });
    const allFilteredLitres = allFiltered.reduce((s, t) => s + (t.cantidad || 0), 0);
    const allFilteredRevenue = allFiltered.reduce((s, t) => s + (t.dinero_total || 0), 0);
    return Object.entries(totals)
      .map(([name, v]) => ({
        name,
        ...v,
        revenue: v.revenue > 0 ? v.revenue : allFilteredLitres > 0 ? (v.litres / allFilteredLitres) * allFilteredRevenue : 0,
      }))
      .sort((a, b) => b.litres - a.litres);
  }, [allFiltered, truckNameLookup, trucks]);

  const activeTruckCount = trucks.filter((truck) => truck.is_active).length || truckBreakdown.filter((truck) => truck.litres > 0).length;
  const formatLitresShort = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
  const truckSubline = (key: "litres" | "deliveries") => {
    const top = truckBreakdown.slice(0, 2);
    if (top.length === 0) return undefined;
    return top
      .map((t) =>
        key === "litres"
          ? `${t.name} ${formatLitresShort(t.litres)}L`
          : `${t.name} ${t.deliveries}`,
      )
      .join(" · ");
  };

  // Latest supply price for the Buy Price KPI tile.
  const sortedPrices = useMemo(
    () => [...buyPrices].sort((a, b) => b.price_date.localeCompare(a.price_date)),
    [buyPrices],
  );
  const latestPrice = sortedPrices[0];
  const priorPrice = sortedPrices.find(
    (p) => p.price_date < (latestPrice?.price_date || ""),
  );
  const buyPricePct =
    latestPrice && priorPrice && priorPrice.price_per_litre > 0
      ? ((latestPrice.price_per_litre - priorPrice.price_per_litre) /
          priorPrice.price_per_litre) *
        100
      : null;
  const buyTrend = useMemo(
    () =>
      sortedPrices
        .slice(0, 14)
        .reverse()
        .map((p) => ({ v: p.price_per_litre })),
    [sortedPrices],
  );

  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => { if (t.date) map[t.date] = (map[t.date] || 0) + (t.cantidad || 0); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, litres]) => ({ date: format(parseISO(date), "d MMM"), litres }));
  }, [filtered]);

  const trendForTile = useMemo(() => dailyData.map((d) => ({ v: d.litres })), [dailyData]);
  const trendForRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => { if (t.date) map[t.date] = (map[t.date] || 0) + (t.dinero_total || 0); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({ v }));
  }, [filtered]);
  const trendForDeliveries = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => { if (t.date) map[t.date] = (map[t.date] || 0) + 1; });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({ v }));
  }, [filtered]);
  const trendForAvg = useMemo(() => {
    const lMap: Record<string, number> = {};
    const cMap: Record<string, number> = {};
    filtered.forEach((t) => {
      if (!t.date) return;
      lMap[t.date] = (lMap[t.date] || 0) + (t.cantidad || 0);
      cMap[t.date] = (cMap[t.date] || 0) + 1;
    });
    return Object.entries(lMap).sort(([a], [b]) => a.localeCompare(b)).map(([d, l]) => ({ v: cMap[d] ? l / cMap[d] : 0 }));
  }, [filtered]);

  // Growth chart: trailing window
  const growthData = useMemo(() => {
    const days = growthRange === "7d" ? 7 : growthRange === "30d" ? 30 : 90;
    const cutoff = format(subDays(new Date(), days), "yyyy-MM-dd");
    const litres: Record<string, number> = {};
    const counts: Record<string, number> = {};
    allTxns.forEach((t) => {
      if (!t.date || t.date < cutoff) return;
      litres[t.date] = (litres[t.date] || 0) + (t.cantidad || 0);
      counts[t.date] = (counts[t.date] || 0) + 1;
    });
    return Object.keys(litres).sort().map((d) => ({
      date: format(parseISO(d), "d MMM"),
      litres: litres[d],
      deliveries: counts[d],
    }));
  }, [allTxns, growthRange]);

  // Volume-by-customer for the donut
  const donutData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => {
      const key = t.nombre_cliente1 || "Unknown";
      map[key] = (map[key] || 0) + (t.cantidad || 0);
    });
    const sorted = Object.entries(map).sort(([, a], [, b]) => b - a);
    const top5 = sorted.slice(0, 5);
    const other = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
    const rows = top5.map(([name, value]) => ({ name, value }));
    if (other > 0) rows.push({ name: "Other", value: other });
    const total = rows.reduce((s, r) => s + r.value, 0);
    return { rows, total };
  }, [filtered]);

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

  // Period note for tooltips
  const periodNote = range === "today" ? "Today vs Yesterday" : range === "week" ? "This week vs Last week" : "This month vs Last month";

  // Breakdown data for KPI tiles
  const litresBreakdown = truckBreakdown.map(t => ({ name: t.name, value: t.litres, displayValue: `${formatLitresShort(t.litres)}L` }));
  const revenueBreakdown = truckBreakdown.map(t => ({ name: t.name, value: t.revenue, displayValue: `$${Math.round(t.revenue).toLocaleString()}` }));
  const deliveriesBreakdown = truckBreakdown.map(t => ({ name: t.name, value: t.deliveries, displayValue: t.deliveries.toLocaleString() }));

  // Per-truck average drop size breakdown
  const avgBreakdown = useMemo(() => {
    const truckLitres: Record<string, number> = {};
    const truckCounts: Record<string, number> = {};
    filtered.forEach((t) => {
      const candidates = [t.estacion, t.nombre_flota, t.nombre_vendedor]
        .map((value) => value?.toString().trim())
        .filter(Boolean) as string[];
      const matched = candidates
        .map((value) => truckNameLookup.get(value.toLowerCase()))
        .find(Boolean);
      const k = matched || candidates[0] || "Unassigned truck";
      truckLitres[k] = (truckLitres[k] || 0) + (t.cantidad || 0);
      truckCounts[k] = (truckCounts[k] || 0) + 1;
    });
    return Object.entries(truckLitres)
      .map(([name, litres]) => ({
        name,
        value: truckCounts[name] ? litres / truckCounts[name] : 0,
        displayValue: `${Math.round(truckCounts[name] ? litres / truckCounts[name] : 0)}L`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, truckNameLookup]);

  // Buy price history breakdown (last 7 entries)
  const buyPriceBreakdown = useMemo(() =>
    sortedPrices.slice(0, 7).map(p => ({
      name: `${p.supplier} · ${format(parseISO(p.price_date), "d MMM")}`,
      value: p.price_per_litre,
      displayValue: `$${p.price_per_litre.toFixed(3)}/L`,
    })),
    [sortedPrices]
  );

  // Eyebrow prefix reflects period scope.
  const prefix = range === "today" ? "Daily" : range === "week" ? "Weekly" : "Monthly";
  const litresLabel    = `${prefix} Litres Delivered`;
  const revenueLabel   = `${prefix} Revenue`;
  const deliveriesLabel = range === "today" ? "Deliveries today" : range === "week" ? "Deliveries this week" : "Deliveries this month";
  const avgLabel        = "Avg Drop Size";

  const periodLabel = range === "today" ? "Today" : range === "week" ? "This Week" : "This Month";

  const pageBg = "bg-muted/60";
  const breadcrumb = [
    { label: "PACC Energy", href: "/" },
    { label: "Dashboard", href: "/" },
    { label: "Overview" },
  ];

  if (isMobile) return <MobileOverview />;

  if (isLoading) {
    return (
      <div className={`-mx-3 sm:-mx-6 md:-mx-8 -my-4 sm:-my-6 md:-my-8 px-3 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8 ${pageBg} min-h-full`}>
        <PageHeader title="PACC Energy" breadcrumb={breadcrumb} />
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className={`-mx-3 sm:-mx-6 md:-mx-8 -my-4 sm:-my-6 md:-my-8 px-3 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8 ${pageBg} min-h-full`}>
        <PageHeader title="PACC Energy" breadcrumb={breadcrumb} />
        <div className="flex flex-col items-center justify-center text-muted-foreground gap-3 py-12">
          <Droplets className="w-6 h-6" />
          <p className="text-sm">No transactions. Use <strong className="text-foreground">Sync now</strong> in the sidebar to pull data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`-mx-3 sm:-mx-6 md:-mx-8 -my-4 sm:-my-6 md:-my-8 px-3 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8 ${pageBg} min-h-full`}>
      <PageHeader title="PACC Energy" breadcrumb={breadcrumb} />

      <div className="relative overflow-hidden rounded-[18px] border border-border bg-foreground text-background mb-4 shadow-sm">
        <div className="relative grid lg:grid-cols-[0.95fr_1.35fr] min-h-[220px]">
          <div className="px-5 sm:px-6 py-5 sm:py-6 border-b lg:border-b-0 lg:border-r border-background/10">
            <PACCLogo tone="dark" />
            <div className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
              Live daily fuel sales
            </div>
            <div className="mt-2 flex items-end gap-2">
              <div className="font-display text-[38px] leading-none font-bold tabular-nums text-background">
                {formatLitresShort(totalLitres)}L
              </div>
              <div className="pb-1.5 text-sm font-bold text-accent">{periodLabel}</div>
            </div>
            <p className="mt-3 max-w-[360px] text-sm leading-5 text-background/75">
              {numDeliveries.toLocaleString()} {numDeliveries === 1 ? "drop" : "drops"} across {activeTruckCount || truckBreakdown.length || 0} active {activeTruckCount === 1 ? "truck" : "trucks"}{lastSyncTime ? ` · last refreshed ${lastSyncTime}` : ""}.
            </p>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-accent px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Refreshing sales…" : "Refresh daily data"}
            </button>
          </div>

          <div className="relative px-5 sm:px-6 py-5 sm:py-6 bg-background/5">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Truck split</div>
                <div className="mt-1 text-sm font-semibold text-background/85">
                  {selectedTruck === "all"
                    ? "Tap a truck to focus the KPIs and charts"
                    : `Showing ${selectedTruck} only — tap All to reset`}
                </div>
              </div>
              <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-background/15 bg-background/10 p-1">
                {(["all", ...truckBreakdown.map((t) => t.name)] as string[]).map((opt) => {
                  const active = selectedTruck === opt;
                  const label = opt === "all" ? "All trucks" : opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSelectedTruck(opt)}
                      className={
                        "h-7 px-3 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors " +
                        (active
                          ? "bg-accent text-accent-foreground"
                          : "text-background/80 hover:text-background")
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {truckBreakdown.slice(0, Math.max(2, Math.min(4, truckBreakdown.length))).map((t, i) => {
                const splitTotal = truckBreakdown.reduce((s, x) => s + x.litres, 0);
                const share = splitTotal > 0 ? Math.round((t.litres / splitTotal) * 100) : 0;
                const isActive = selectedTruck === t.name;
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setSelectedTruck(isActive ? "all" : t.name)}
                    className={
                      "text-left rounded-[14px] border p-4 transition-colors " +
                      (isActive
                        ? "border-accent bg-accent/15"
                        : "border-background/10 bg-background/10 hover:bg-background/15")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: TRUCK_TINTS[i % TRUCK_TINTS.length] }} />
                        <span className="truncate text-[12px] font-bold uppercase tracking-wider text-background">{t.name}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-background/70">{share}%</span>
                    </div>
                    <div className="mt-3 font-display text-2xl font-bold tabular-nums text-background">
                      {formatLitresShort(t.litres)}L
                    </div>
                    <div className="mt-1 text-[12px] font-medium text-background/70">
                      {t.deliveries} drop{t.deliveries === 1 ? "" : "s"} · ${Math.round(t.revenue).toLocaleString()} revenue
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/15">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* KPI grid — 5 tiles incl. buy price; wraps to 2/3 cols at smaller widths */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KPISparklineCard
          label={litresLabel}
          value={totalLitres >= 1000 ? `${(totalLitres / 1000).toFixed(2)}k L` : `${totalLitres.toFixed(1)} L`}
          deltaPct={litresPct}
          trend={trendForTile}
          fallbackContext={litresFallback}
          href="/finance"
          icon={TILE_THEMES.litres.icon}
          tintBg={TILE_THEMES.litres.bg}
          tintColor={TILE_THEMES.litres.fg}
          subLine={truckSubline("litres")}
          periodNote={periodNote}
          breakdown={litresBreakdown}
          breakdownTotal={totalLitres}
          breakdownTitle="Litres by truck"
        />
        <KPISparklineCard
          label={revenueLabel}
          value={"$" + totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          deltaPct={revPct}
          trend={trendForRevenue}
          fallbackContext={revenueFallback}
          href="/finance"
          icon={TILE_THEMES.revenue.icon}
          tintBg={TILE_THEMES.revenue.bg}
          tintColor={TILE_THEMES.revenue.fg}
          subLine={
            totalLitres > 0
              ? `${(totalRevenue / totalLitres).toFixed(2)} $/L avg`
              : undefined
          }
        />
        <KPISparklineCard
          label={deliveriesLabel}
          value={numDeliveries.toLocaleString()}
          deltaPct={delPct}
          trend={trendForDeliveries}
          fallbackContext={deliveryFallback}
          href="/dispatch"
          icon={TILE_THEMES.delivery.icon}
          tintBg={TILE_THEMES.delivery.bg}
          tintColor={TILE_THEMES.delivery.fg}
          subLine={truckSubline("deliveries")}
        />
        <KPISparklineCard
          label={avgLabel}
          value={Math.round(avgSize).toLocaleString() + " L"}
          deltaPct={avgPct}
          trend={trendForAvg}
          fallbackContext={avgFallback}
          href="/dispatch"
          icon={TILE_THEMES.avg.icon}
          tintBg={TILE_THEMES.avg.bg}
          tintColor={TILE_THEMES.avg.fg}
          subLine={
            numDeliveries > 0
              ? `${numDeliveries} drop${numDeliveries === 1 ? "" : "s"}`
              : undefined
          }
        />
        <KPISparklineCard
          label="Buy Price (Ex-GST)"
          value={
            latestPrice
              ? `$${latestPrice.price_per_litre.toFixed(3)}/L`
              : "—"
          }
          deltaPct={buyPricePct}
          trend={buyTrend}
          fallbackContext={
            latestPrice
              ? `Latest ${latestPrice.supplier} · ${format(parseISO(latestPrice.price_date), "d MMM")}`
              : "No supply price recorded yet"
          }
          href="/suppliers"
          icon={TILE_THEMES.buy.icon}
          tintBg={TILE_THEMES.buy.bg}
          tintColor={TILE_THEMES.buy.fg}
          subLine={
            latestPrice
              ? `${latestPrice.supplier} · ${format(parseISO(latestPrice.price_date), "d MMM")}`
              : undefined
          }
        />
      </div>

      {/* Litres growth + Volume by customer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-[14px] p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Litres growth</h2>
            <GrowthRangePills value={growthRange} onChange={setGrowthRange} />
          </div>
          <div className="mt-3 flex items-center gap-4 text-[11px] font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2A6A2E" }} />
              Litres delivered
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2B3D8E" }} />
              Deliveries (count)
            </span>
          </div>
          <div style={{ height: 320 }} className="mt-2">
            {growthData.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={growthData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="litres-growth-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2A6A2E" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#2A6A2E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} minTickGap={32} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, padding: "8px 12px" }}
                    labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                    formatter={(v: number, name: string) => name === "litres" ? [`${v.toLocaleString()} L`, "Litres"] : [v.toLocaleString(), "Deliveries"]}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="litres" stroke="#2A6A2E" strokeWidth={1.75} fill="url(#litres-growth-fill)" isAnimationActive={false}
                    dot={(props: any) => {
                      if (props.index !== growthData.length - 1) return null as any;
                      return <circle key="last" cx={props.cx} cy={props.cy} r={5} fill="var(--accent)" stroke="none" />;
                    }}
                  />
                  <Line yAxisId="right" type="monotone" dataKey="deliveries" stroke="#2B3D8E" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground">
                Trend appears with 2+ data points.
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-[14px] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Volume by customer</h2>
            <span className="text-[11px] font-medium text-muted-foreground">{periodLabel}</span>
          </div>
          <div style={{ height: 320 }} className="flex flex-col">
            <div className="relative flex-1 min-h-0">
              {donutData.rows.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData.rows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" stroke="none" isAnimationActive={false}>
                        {donutData.rows.map((_, i) => (
                          <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-[22px] font-semibold tabular-nums text-foreground leading-tight">
                      {donutData.total >= 1000 ? `${(donutData.total / 1000).toFixed(1)}k` : donutData.total.toFixed(0)}
                    </div>
                    <div className="text-[11px] font-medium text-muted-foreground">Total litres</div>
                  </div>
                </>
              )}
            </div>
          </div>
          {donutData.rows.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {donutData.rows.map((r, i) => (
                <li key={r.name} className="flex items-center gap-2 text-[13px] text-foreground">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="flex-1 font-medium truncate">{r.name}</span>
                  <span className="font-semibold tabular-nums">
                    {donutData.total ? `${((r.value / donutData.total) * 100).toFixed(0)}%` : "0%"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
    </div>
  );
}

function GrowthRangePills({ value, onChange }: { value: "7d" | "30d" | "90d"; onChange: (v: "7d" | "30d" | "90d") => void }) {
  const opts: Array<"7d" | "30d" | "90d"> = ["7d", "30d", "90d"];
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
      {opts.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={
              "h-7 px-3 rounded-full text-[12px] font-semibold transition-colors " +
              (active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
            }
          >
            {o}
          </button>
        );
      })}
    </div>
  );
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
