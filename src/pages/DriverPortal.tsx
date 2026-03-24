import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { LogOut, Droplets, MapPin, Clock, TrendingUp } from "lucide-react";
import { PACCLogo } from "@/components/PACCLogo";

const BG = "#110B06";
const SURFACE = "#1A1009";
const BORDER = "#2E1C0C";
const ACCENT = "#FF4D1C";
const TEXT = "#F2EDE6";
const TEXT_DIM = "#4A3520";
const TEXT_MID = "#8B7355";

function useDriverTransactions() {
  const today = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const lastWeekStart = format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const todayQuery = useQuery({
    queryKey: ["driver-today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("date", today)
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const weekQuery = useQuery({
    queryKey: ["driver-week", weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("date", weekStart)
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const lastWeekQuery = useQuery({
    queryKey: ["driver-lastweek", lastWeekStart, weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("date", lastWeekStart)
        .lt("date", weekStart);
      if (error) throw error;
      return data || [];
    },
  });

  return { todayQuery, weekQuery, lastWeekQuery };
}

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: "20px 20px",
  ...extra,
});

export default function DriverPortal() {
  const { todayQuery, weekQuery, lastWeekQuery } = useDriverTransactions();

  const today = todayQuery.data || [];
  const week = weekQuery.data || [];
  const lastWeek = lastWeekQuery.data || [];

  const todayLitres = today.reduce((s, t) => s + (t.cantidad || 0), 0);
  const todayDeliveries = today.length;
  const weekLitres = week.reduce((s, t) => s + (t.cantidad || 0), 0);
  const lastWeekLitres = lastWeek.reduce((s, t) => s + (t.cantidad || 0), 0);
  const weekChange = lastWeekLitres > 0 ? ((weekLitres - lastWeekLitres) / lastWeekLitres) * 100 : 0;

  const todaySites = useMemo(() => {
    const seen = new Set<string>();
    return today
      .filter((t) => t.nombre_cliente1 && !seen.has(t.nombre_cliente1) && seen.add(t.nombre_cliente1))
      .map((t) => t.nombre_cliente1);
  }, [today]);

  const firstDelivery = today.length > 0 ? today[today.length - 1] : null;
  const lastDelivery = today.length > 0 ? today[0] : null;

  const allTimeBest = useQuery({
    queryKey: ["driver-best"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("date, cantidad")
        .order("date");
      if (error) throw error;
      const byDay: Record<string, number> = {};
      (data || []).forEach((t) => {
        if (t.date) byDay[t.date] = (byDay[t.date] || 0) + (t.cantidad || 0);
      });
      const best = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
      return best ? { date: best[0], litres: best[1] } : null;
    },
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const isToday = (date: string) => date === format(new Date(), "yyyy-MM-dd");

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
        <PACCLogo size="sm" />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_MID }}>Stephan</span>
          <button
            onClick={handleSignOut}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = TEXT_MID)}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}
          >
            <LogOut style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 16px", maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Date */}
        <div style={{ fontSize: 12, color: TEXT_MID, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {format(new Date(), "EEEE dd MMMM yyyy")}
        </div>

        {/* HERO — Today's litres */}
        <div style={card({ textAlign: "center", padding: "28px 20px" })}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 12 }}>
            <Droplets style={{ width: 14, height: 14, color: ACCENT }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: TEXT_MID, textTransform: "uppercase", letterSpacing: "0.06em" }}>Litres Delivered Today</span>
          </div>

          <div style={{
            fontSize: 56,
            fontWeight: 700,
            color: todayLitres > 0 ? TEXT : TEXT_DIM,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}>
            {todayLitres > 0
              ? todayLitres >= 1000
                ? `${(todayLitres / 1000).toFixed(2)}k`
                : todayLitres.toFixed(0)
              : "—"
            }
            <span style={{ fontSize: 24, fontWeight: 400, color: TEXT_MID, marginLeft: 4 }}>L</span>
          </div>

          {todayLitres > 0 && (
            <div style={{ fontSize: 12, color: TEXT_MID, marginTop: 8 }}>
              {todayDeliveries} {todayDeliveries === 1 ? "delivery" : "deliveries"} today
            </div>
          )}
          {todayLitres === 0 && (
            <p style={{ fontSize: 12, color: TEXT_DIM, marginTop: 8, margin: 0 }}>No deliveries recorded yet today</p>
          )}
        </div>

        {/* Quick stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* This week */}
          <div style={card()}>
            <p style={{ fontSize: 11, color: TEXT_MID, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>This Week</p>
            <div style={{ fontSize: 24, fontWeight: 700, color: TEXT, letterSpacing: "-0.03em" }}>
              {weekLitres >= 1000 ? `${(weekLitres / 1000).toFixed(1)}k` : weekLitres.toFixed(0)}
              <span style={{ fontSize: 13, fontWeight: 400, color: TEXT_MID, marginLeft: 2 }}> L</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
              <TrendingUp style={{ width: 12, height: 12, color: weekChange >= 0 ? "#10B981" : "#EF4444" }} />
              <span style={{ fontSize: 11, color: weekChange >= 0 ? "#10B981" : "#EF4444" }}>
                {weekChange >= 0 ? "+" : ""}{weekChange.toFixed(1)}% vs last week
              </span>
            </div>
          </div>

          {/* Personal best */}
          <div style={card()}>
            <p style={{ fontSize: 11, color: TEXT_MID, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Best Day</p>
            <div style={{ fontSize: 24, fontWeight: 700, color: TEXT, letterSpacing: "-0.03em" }}>
              {allTimeBest.data
                ? allTimeBest.data.litres >= 1000
                  ? `${(allTimeBest.data.litres / 1000).toFixed(1)}k`
                  : allTimeBest.data.litres.toFixed(0)
                : "—"
              }
              <span style={{ fontSize: 13, fontWeight: 400, color: TEXT_MID, marginLeft: 2 }}> L</span>
            </div>
            {allTimeBest.data && (
              <div style={{ fontSize: 11, color: TEXT_MID, marginTop: 6 }}>
                {format(parseISO(allTimeBest.data.date), "dd MMM yyyy")}
                {isToday(allTimeBest.data.date) && (
                  <span style={{ color: ACCENT, marginLeft: 4 }}>today! 🔥</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Shift times */}
        {(firstDelivery || lastDelivery) && (
          <div style={card({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Clock style={{ width: 14, height: 14, color: ACCENT }} />
              <div>
                <p style={{ fontSize: 11, color: TEXT_MID, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>Shift</p>
                <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, fontVariantNumeric: "tabular-nums" }}>
                  {firstDelivery?.fecha ? format(new Date(firstDelivery.fecha), "HH:mm") : "—"}
                  <span style={{ color: TEXT_DIM, margin: "0 4px" }}>→</span>
                  {lastDelivery?.fecha ? format(new Date(lastDelivery.fecha), "HH:mm") : "—"}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: TEXT_MID, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>Sites</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: TEXT, margin: 0 }}>{todaySites.length}</p>
            </div>
          </div>
        )}

        {/* Today's delivery log */}
        {today.length > 0 && (
          <div style={card({ padding: 0 })}>
            <div style={{ padding: "14px 20px 10px", borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, letterSpacing: "-0.01em" }}>Today's Deliveries</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {today.map((t, i) => (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 20px",
                    borderBottom: i < today.length - 1 ? `1px solid ${BORDER}` : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <MapPin style={{ width: 12, height: 12, color: TEXT_DIM, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>
                        {t.nombre_cliente1 || "Unknown"}
                      </div>
                      <div style={{ fontSize: 11, color: TEXT_MID }}>
                        {t.fecha ? format(new Date(t.fecha), "HH:mm") : "—"}
                        {t.factura ? ` · #${t.factura}` : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
                    {(t.cantidad || 0).toLocaleString()}L
                  </div>
                </div>
              ))}
            </div>

            {/* Today total */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", borderTop: `1px solid ${BORDER}`, background: "rgba(255,77,28,0.04)" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_MID }}>Total</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: TEXT, fontVariantNumeric: "tabular-nums" }}>
                {todayLitres.toLocaleString()}L
              </span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {today.length === 0 && !todayQuery.isLoading && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <Droplets style={{ width: 32, height: 32, color: TEXT_DIM, margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, color: TEXT_MID, margin: 0 }}>No deliveries yet today</p>
            <p style={{ fontSize: 12, color: TEXT_DIM, margin: "6px 0 0" }}>Data updates every minute</p>
          </div>
        )}

        {todayQuery.isLoading && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 13, color: TEXT_MID }}>Loading…</p>
          </div>
        )}
      </div>
    </div>
  );
}
