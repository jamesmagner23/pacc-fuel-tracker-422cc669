import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Menu, ArrowUpRight, ArrowRight, Truck, RefreshCcw } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, ResponsiveContainer, LabelList, Cell } from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useRevenueCalc } from "@/hooks/useRevenueCalc";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { UserMenu } from "@/components/UserMenu";
import { PACCLogo } from "@/components/PACCLogo";
import { formatTime, formatDate } from "@/lib/format";
import { useSyncTransactions } from "@/hooks/useSyncTransactions";
import { TruckMap } from "@/components/TruckMap";

/* ---------- helpers ---------- */

function compactLitres(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return Math.round(n).toLocaleString();
}

function heroValueFormat(n: number): string {
  if (n >= 100000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

function eyebrowFor(range: string): string {
  if (range === "today") return "TODAY'S DELIVERIES";
  if (range === "week") return "THIS WEEK";
  // month / other
  return `${format(new Date(), "MMMM").toUpperCase()} DELIVERIES`;
}

const AVATAR_TINTS = ["#F4F0E6", "#E8EDE5", "#F4F5F1", "#EDEFE9"];
function avatarTintFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}
function initialsFor(name: string): string {
  const s = name.replace(/[^A-Za-z0-9]/g, "");
  return (s.slice(0, 2) || "??").toUpperCase();
}

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function useClientNameMap() {
  return useQuery({
    queryKey: ["client-account-name-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_accounts")
        .select("id, company_name")
        .eq("is_active", true);
      const map: Record<number, string> = {};
      (data || []).forEach((c: any) => { map[c.id] = c.company_name; });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/* ---------- header ---------- */

function MobileHeader() {
  return (
    <div className="h-14 flex items-center justify-between">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => window.dispatchEvent(new Event("pacc:open-nav"))}
        className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-card border border-border text-foreground active:scale-[0.95] transition-transform"
      >
        <Menu className="w-[18px] h-[18px]" />
      </button>
      <PACCLogo size="sm" tone="light" />
      <UserMenu />
    </div>
  );
}

/* ---------- bar chart ---------- */

function SevenDayBars({ data }: { data: { date: string; litres: number; iso: string }[] }) {
  if (data.length < 2) {
    return (
      <div className="h-[160px] flex items-center justify-center text-center text-[13px] text-muted-foreground">
        Trend appears with 2+ data points.
      </div>
    );
  }
  const todayKey = todayISO();
  return (
    <div className="h-[160px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 0, left: 0, bottom: 28 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Bar dataKey="litres" radius={[6, 6, 0, 0]} barSize={22} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.iso}
                fill={d.iso === todayKey ? "var(--border)" : "var(--foreground)"}
              />
            ))}
            <LabelList
              dataKey="litres"
              position="top"
              content={(props: any) => {
                const { x, y, width, value, index } = props;
                if (value == null) return null;
                const iso = data[index]?.iso;
                const isToday = iso === todayKey;
                return (
                  <text
                    x={x + width / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill={isToday ? "var(--muted-foreground)" : "var(--foreground)"}
                  >
                    {compactLitres(Number(value))}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- period chips ---------- */

const PERIOD_OPTIONS: { value: "today" | "week" | "month"; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function PeriodChips() {
  const { range, setRange } = useDateRange();
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
      {PERIOD_OPTIONS.map((opt) => {
        const active = range === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setRange(opt.value)}
            className={
              "px-3.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0 transition-colors active:scale-[0.98] " +
              (active
                ? "bg-foreground text-background"
                : "bg-card border border-border text-muted-foreground")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- KPI tile ---------- */

type TileProps = {
  amount: string;
  label: string;
  href: string;
  bg: string;
  amountColor?: string;
  labelColor?: string;
  labelWeight?: "semibold" | "bold";
  cornerBg?: string;
  cornerBorder?: string;
};

function KPITile({
  amount, label, href, bg,
  amountColor = "var(--muted-foreground)",
  labelColor = "var(--foreground)",
  labelWeight = "semibold",
  cornerBg = "rgba(255,255,255,0.8)",
  cornerBorder = "rgba(255,255,255,0.5)",
}: TileProps) {
  return (
    <Link
      to={href}
      className="relative block aspect-[3/2] rounded-[18px] p-4 active:scale-[0.98] transition-transform duration-100"
      style={{ background: bg }}
    >
      <div className="flex flex-col justify-between h-full">
        <div
          className="text-[13px] font-medium tabular-nums"
          style={{ color: amountColor }}
        >
          {amount}
        </div>
        <div
          className={"text-[18px] tracking-tight " + (labelWeight === "bold" ? "font-bold" : "font-semibold")}
          style={{ color: labelColor }}
        >
          {label}
        </div>
      </div>
      <span
        className="absolute top-3 right-3 inline-flex w-8 h-8 items-center justify-center rounded-full backdrop-blur-sm"
        style={{ background: cornerBg, border: `1px solid ${cornerBorder}` }}
      >
        <ArrowUpRight className="w-3.5 h-3.5 text-foreground" />
      </span>
    </Link>
  );
}

/* ---------- deliveries list ---------- */

function txTime(t: Transaction): number {
  return t.fecha ? new Date(t.fecha).getTime() : 0;
}

function TodaysDeliveriesMobile() {
  const today = todayISO();
  const { data: todayTx = [], isLoading: loadingToday } = useTransactions("today");
  const { data: weekTx = [], isLoading: loadingWeek } = useTransactions("week");
  const isLoading = loadingToday || loadingWeek;
  const { data: clientMap = {} } = useClientNameMap();
  const source = todayTx.length > 0 ? todayTx : weekTx;
  const usingFallback = todayTx.length === 0 && weekTx.length > 0;
  const sorted = useMemo(
    () => [...source].sort((a, b) => txTime(b) - txTime(a)),
    [source],
  );
  const rows = sorted.slice(0, 6);
  const hasMore = sorted.length > 6;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[22px] font-bold text-foreground tracking-tight">
          {usingFallback ? "Recent deliveries" : "Today's deliveries"}
        </h2>
        <Link
          to="/transactions"
          aria-label="Open transactions"
          className="w-7 h-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="border-t border-border" />

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-12 flex flex-col items-center text-center gap-3">
          <Truck className="w-8 h-8 text-muted-foreground" />
          <div className="text-base font-semibold text-foreground">No deliveries yet</div>
          <p className="text-sm text-muted-foreground">Recent SpeedSol fills will appear here as soon as they sync.</p>
        </div>
      ) : (
        <ul>
          {rows.map((t, i) => {
            const customer = t.nombre_cliente1 || t.estacion || "—";
            const litres = t.cantidad ?? 0;
            const addr = [t.ciudad, t.producto].filter(Boolean).join(" · ") || t.estacion || "—";
            const when = t.fecha
              ? sameDay(t.fecha, today) ? formatTime(t.fecha) : formatDate(t.fecha)
              : "";
            const tint = avatarTintFor(customer);
            return (
              <li
                key={t.id}
                className={"flex items-center gap-3 py-3.5 " + (i < rows.length - 1 ? "border-b border-border" : "")}
              >
                <Link
                  to={`/transactions?date=${t.date ?? ""}&q=${encodeURIComponent(customer)}`}
                  className="flex items-center gap-3 w-full active:scale-[0.99] transition-transform"
                >
                  <span
                    className="inline-flex w-10 h-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-foreground"
                    style={{ background: tint }}
                  >
                    {initialsFor(customer)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-foreground truncate">{customer}</div>
                    <div className="text-[12px] text-muted-foreground truncate">{`•••• ${addr}`}</div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <div className="text-[14px] font-semibold text-foreground tabular-nums">
                      {litres ? `−${litres.toLocaleString()} L` : "—"}
                    </div>
                    <div className="text-[12px] text-muted-foreground tabular-nums">{when}</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className="flex justify-center mt-4">
          <Link
            to="/transactions"
            className="inline-flex items-center rounded-full bg-card border border-border px-4 py-2 text-sm font-semibold text-foreground active:scale-[0.98] transition-transform"
          >
            View all
          </Link>
        </div>
      )}
    </section>
  );
}

function sameDay(iso: string, todayStr: string): boolean {
  const d = new Date(iso);
  return format(d, "yyyy-MM-dd") === todayStr;
}

/* ---------- page ---------- */

export function MobileOverview() {
  const { range } = useDateRange();
  const { filtered, totalRevenue } = useRevenueCalc(range);
  const { data: monthTxns = [] } = useTransactions("month");
  const { data: buyPrices = [] } = useBuyPrices(30);
  const { syncing, handleSync, lastSyncTime } = useSyncTransactions({ autoSync: true });

  const totalLitres = filtered.reduce((s, t) => s + (t.cantidad || 0), 0);
  const numDeliveries = filtered.length;
  const avgSize = numDeliveries > 0 ? totalLitres / numDeliveries : 0;
  const latestBuy = buyPrices[0]?.price_per_litre;

  // Last 7 days, always — independent of period selection.
  const sevenDay = useMemo(() => {
    const today = new Date();
    const days: { iso: string; date: string; litres: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const iso = format(d, "yyyy-MM-dd");
      days.push({ iso, date: format(d, "EEEEEE"), litres: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.iso, i]));
    monthTxns.forEach((t) => {
      if (!t.date) return;
      const i = idx.get(t.date);
      if (i != null) days[i].litres += t.cantidad || 0;
    });
    return days;
  }, [monthTxns]);

  const eyebrow = eyebrowFor(range);

  return (
    <div
      className="min-h-full bg-background"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="px-4">
        <div
          className="bg-background px-1 pb-3"
        >
          <MobileHeader />

          {/* hero */}
          <div className="mt-5">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: "#C8F26A", boxShadow: "0 0 0 3px rgba(200,242,106,0.25)" }}
              />
              <div className="text-[11px] font-bold uppercase text-muted-foreground" style={{ letterSpacing: "0.08em" }}>
              {eyebrow}
              </div>
            </div>
            <div className="mt-2 flex items-baseline">
              <span
                className="text-foreground font-bold tabular-nums"
                style={{ fontSize: 44, lineHeight: 1, letterSpacing: "-0.03em" }}
              >
                {heroValueFormat(totalLitres)}
              </span>
              <span
                className="ml-1.5 text-muted-foreground"
                style={{ fontSize: 22, fontWeight: 500 }}
              >
                L
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] border border-border bg-card px-3 py-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Daily sales data</div>
                <div className="mt-0.5 text-[12px] font-semibold text-foreground truncate">
                  {lastSyncTime ? `Last refreshed ${lastSyncTime}` : "Never refreshed"}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-[12px] font-bold text-background disabled:opacity-60"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing" : "Refresh"}
              </button>
            </div>
          </div>

          {/* bar chart */}
          <div className="mt-5">
            <SevenDayBars data={sevenDay} />
          </div>

          {/* period chips */}
          <div className="mt-3 mb-1">
            <PeriodChips />
          </div>

          {/* tile grid */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <KPITile
              amount={`$${Math.round(totalRevenue).toLocaleString()}`}
              label="Revenue"
              href="/finance"
              bg="#F4F0E6"
            />
            <KPITile
              amount={numDeliveries.toLocaleString()}
              label="Deliveries"
              href="/dispatch"
              bg="#C8F26A"
              amountColor="var(--foreground)"
              labelWeight="bold"
              cornerBg="#FFFFFF"
              cornerBorder="#FFFFFF"
            />
            <KPITile
              amount={`${Math.round(avgSize).toLocaleString()}L`}
              label="Avg size"
              href="/dispatch?view=avg-size"
              bg="#F4F5F1"
            />
            <KPITile
              amount={latestBuy ? `$${latestBuy.toFixed(2)}/L` : "—"}
              label="Buy price"
              href="/suppliers"
              bg="#E8EDE5"
            />
          </div>

          <TodaysDeliveriesMobile />

          <div className="h-3" />
        </div>
      </div>
    </div>
  );
}

// silence unused import warning in some builds
void parseISO;