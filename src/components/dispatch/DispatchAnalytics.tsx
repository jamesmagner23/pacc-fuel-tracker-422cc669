import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, Truck, MapPin, Route, Users, Fuel, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function cssVar(name: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

type AnalyticsDay = {
  date: string;
  routes: number;
  stops: number;
  completedStops: number;
  distanceKm: number;
  durationMin: number;
  drivers: number;
  driverNames: string[];
  totalLoad: number;
};

async function fetchAnalytics(dates: string[]): Promise<AnalyticsDay[]> {
  const { data, error } = await supabase.functions.invoke("dispatch", {
    body: { action: "get_analytics", payload: { dates } },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? "Analytics fetch failed");
  return data.data;
}

type Period = "week" | "month";

export function DispatchAnalytics({ selectedDate }: { selectedDate: Date }) {
  const [period, setPeriod] = useState<Period>("week");

  const surface = cssVar("--surface", "#4A3525");
  const border = cssVar("--surface-border", "#6B5240");
  const textPrimary = cssVar("--text-primary", "#F5E6D0");
  const textSecondary = cssVar("--text-secondary", "#C4A882");
  const textMuted = cssVar("--text-muted", "#8B7355");
  const accent = cssVar("--accent", "#E8461E");

  const dates = useMemo(() => {
    let start: Date, end: Date;
    if (period === "week") {
      start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    }
    // Don't go past today
    const today = new Date();
    if (end > today) end = today;
    if (start > end) return [];
    return eachDayOfInterval({ start, end }).map((d) => format(d, "yyyy-MM-dd"));
  }, [selectedDate, period]);

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["dispatch-analytics", dates],
    queryFn: () => fetchAnalytics(dates),
    enabled: dates.length > 0,
    staleTime: 300000,
  });

  const totals = useMemo(() => {
    if (!analytics?.length) return { stops: 0, completed: 0, distanceKm: 0, durationHrs: 0, routes: 0, drivers: 0, load: 0 };
    const allDrivers = new Set<string>();
    return analytics.reduce(
      (acc, d) => {
        d.driverNames?.forEach((n) => allDrivers.add(n));
        return {
          stops: acc.stops + d.stops,
          completed: acc.completed + d.completedStops,
          distanceKm: acc.distanceKm + d.distanceKm,
          durationHrs: acc.durationHrs + d.durationMin / 60,
          routes: acc.routes + d.routes,
          drivers: allDrivers.size,
          load: acc.load + d.totalLoad,
        };
      },
      { stops: 0, completed: 0, distanceKm: 0, durationHrs: 0, routes: 0, drivers: 0, load: 0 }
    );
  }, [analytics]);

  const chartData = useMemo(() => {
    if (!analytics?.length) return [];
    return analytics.map((d) => ({
      date: format(new Date(d.date + "T00:00:00"), "dd MMM"),
      stops: d.stops,
      km: d.distanceKm,
    }));
  }, [analytics]);

  const kpis = [
    { label: "Total Stops", value: totals.stops, icon: <MapPin className="w-3.5 h-3.5" /> },
    { label: "Completed", value: totals.completed, icon: <TrendingUp className="w-3.5 h-3.5" style={{ color: "#10B981" }} /> },
    { label: "KMs Driven", value: `${Math.round(totals.distanceKm).toLocaleString()}`, icon: <Route className="w-3.5 h-3.5" /> },
    { label: "Drive Hours", value: `${totals.durationHrs.toFixed(1)}`, icon: <Truck className="w-3.5 h-3.5" /> },
    { label: "Routes", value: totals.routes, icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { label: "Drivers", value: totals.drivers, icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="p-4 sm:p-5"
      style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: accent }} />
          <span className="text-sm font-semibold" style={{ color: textPrimary }}>
            Route Analytics
          </span>
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: `${border}` }}>
          {(["week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider transition-colors"
              style={{
                background: period === p ? accent : "transparent",
                color: period === p ? "#fff" : textSecondary,
                border: "none",
                cursor: "pointer",
              }}
            >
              {p === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs py-6 text-center" style={{ color: textSecondary }}>
          Loading analytics…
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="p-3 rounded-lg text-center"
                style={{ background: `${border}40` }}
              >
                <div className="flex items-center justify-center mb-1.5" style={{ color: textMuted }}>
                  {kpi.icon}
                </div>
                <div className="text-lg sm:text-xl font-bold" style={{ color: textPrimary }}>
                  {kpi.value}
                </div>
                <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: textSecondary }}>
                  {kpi.label}
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          {chartData.length > 1 && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: textSecondary }}>
                Daily Stops & Distance
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={`${border}`} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: textMuted }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: textMuted }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: surface,
                      border: `1px solid ${border}`,
                      borderRadius: 8,
                      fontSize: 11,
                      color: textPrimary,
                    }}
                    labelStyle={{ color: textSecondary, fontSize: 10 }}
                  />
                  <Bar dataKey="stops" name="Stops" fill={accent} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="km" name="KMs" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
