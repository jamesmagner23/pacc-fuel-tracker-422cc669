import { useState } from "react";
import { DollarSign, Droplets, Truck, TrendingUp, Tag, FileText, CalendarDays } from "lucide-react";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions, usePreviousTransactions } from "@/hooks/useTransactions";

const tabs = [
  { id: "overview", label: "Overview", icon: DollarSign },
  { id: "daily-cost", label: "Daily Cost", icon: CalendarDays },
  { id: "pricing", label: "Pricing", icon: Tag },
  { id: "invoicing", label: "Invoicing", icon: FileText },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function Finance() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="flex flex-col gap-5 max-w-[1100px]">
      {/* Sub-tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-positive text-white"
                : "bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <FinanceOverview />}
      {activeTab === "daily-cost" && <ComingSoon label="Daily Cost" />}
      {activeTab === "pricing" && <ComingSoon label="Pricing" />}
      {activeTab === "invoicing" && <ComingSoon label="Invoicing" />}
    </div>
  );
}

function FinanceOverview() {
  const { range } = useDateRange();
  const { data: filtered = [], isLoading } = useTransactions(range);
  const { data: previous = [] } = usePreviousTransactions(range);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const totalLitres = filtered.reduce((s, t) => s + (t.cantidad || 0), 0);
  const numDeliveries = filtered.length;
  const totalRevenue = filtered.reduce((s, t) => s + (t.dinero_total || 0), 0);

  // Derive average buy price from ppu field
  const ppuValues = filtered.filter((t) => t.ppu && t.ppu > 0);
  const avgBuyPrice = ppuValues.length > 0
    ? ppuValues.reduce((s, t) => s + (t.ppu || 0), 0) / ppuValues.length
    : 0;

  // Estimate cost & profit
  const totalCost = totalLitres * avgBuyPrice;
  const profit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const rangeLabel = range === "today" ? "Today" : range === "week" ? "This Week" : "This Month";

  return (
    <>
      <h1 className="text-lg font-semibold tracking-tight">Financial Overview</h1>
      <p className="text-xs font-medium text-positive uppercase tracking-wider -mt-3">
        {rangeLabel} — LIVE
      </p>

      <div className="grid grid-cols-2 gap-3">
        <FinanceCard
          label="Litres Delivered"
          value={totalLitres.toLocaleString() + "L"}
          sub={rangeLabel}
          icon={<Droplets className="w-4 h-4 text-muted-foreground" />}
        />
        <FinanceCard
          label="Deliveries"
          value={numDeliveries.toString()}
          sub={rangeLabel}
          icon={<Truck className="w-4 h-4 text-muted-foreground" />}
        />
      </div>

      <FinanceCard
        label="Buy Price Today"
        value={avgBuyPrice > 0 ? `$${avgBuyPrice.toFixed(4)}/L` : "—"}
        sub={avgBuyPrice > 0 ? "Avg from transactions" : "No data"}
        icon={<DollarSign className="w-4 h-4 text-muted-foreground" />}
      />

      <FinanceCard
        label="Revenue (Ex GST)"
        value={`$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        sub={`${rangeLabel} · sell price × litres`}
        icon={<DollarSign className="w-4 h-4 text-muted-foreground" />}
      />

      <FinanceCard
        label="Profit (Markup $)"
        value={`$${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        sub={`${rangeLabel} · revenue minus cost`}
        icon={<TrendingUp className="w-4 h-4 text-muted-foreground" />}
        valueClassName={profit >= 0 ? "text-positive" : "text-destructive"}
      />

      <FinanceCard
        label="Profit Margin"
        value={`${profitMargin.toFixed(1)}%`}
        sub={`${rangeLabel} · profit ÷ revenue`}
        icon={<TrendingUp className="w-4 h-4 text-muted-foreground" />}
        valueClassName={profitMargin >= 0 ? "text-positive" : "text-destructive"}
      />
    </>
  );
}

function FinanceCard({
  label,
  value,
  sub,
  icon,
  valueClassName = "",
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        {icon}
      </div>
      <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${valueClassName}`}>
        {value}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
      <FileText className="w-7 h-7" />
      <p className="text-sm">{label} — coming soon</p>
    </div>
  );
}
