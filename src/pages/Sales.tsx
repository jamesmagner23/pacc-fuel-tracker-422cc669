import { useState } from "react";
import { Calculator, FileText, UserMinus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import PricingTab from "@/components/finance/PricingTab";
import LiveDropCalculator from "@/components/admin/LiveDropCalculator";
import WinBackTab from "@/components/admin/WinBackTab";
import ApprovalsTab from "@/components/sales/ApprovalsTab";
import { useUserRole } from "@/hooks/useUserRole";
import { usePendingApprovalCount } from "@/hooks/useQuoteApprovals";

type TabId = "quotes" | "drop" | "winback" | "approvals";

export default function Sales() {
  const { data: role } = useUserRole();
  const isAdmin = role === "admin";
  const { data: pendingCount = 0 } = usePendingApprovalCount();
  const [activeTab, setActiveTab] = useState<TabId>(isAdmin && pendingCount > 0 ? "approvals" : "quotes");

  const tabs: { id: TabId; label: string; icon: JSX.Element; badge?: number }[] = [
    { id: "quotes", label: "Quote Builder", icon: <FileText className="w-3.5 h-3.5" /> },
    { id: "drop", label: "Price a Drop", icon: <Calculator className="w-3.5 h-3.5" /> },
    { id: "winback", label: "Win Back", icon: <UserMinus className="w-3.5 h-3.5" /> },
    ...(isAdmin ? [{ id: "approvals" as TabId, label: "Approvals", icon: <ShieldCheck className="w-3.5 h-3.5" />, badge: pendingCount }] : []),
  ];

  return (
    <div className="flex flex-col gap-5 max-w-[1200px] w-full">
      <PageHeader
        title="Sales"
        subtitle="Quotes, live drop pricing, and win-back outreach"
        showPeriod={false}
      />

      <div className="flex gap-1 bg-surface border border-surface-border rounded-[10px] p-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer min-h-[44px] sm:min-h-0 whitespace-nowrap shrink-0"
            style={{
              background: activeTab === tab.id ? "var(--accent-light)" : "transparent",
              color: activeTab === tab.id ? "var(--primary)" : "var(--text-secondary)",
              border: "none",
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.badge && tab.badge > 0 ? (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500/25 text-amber-300 text-[10px] font-bold">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === "quotes" && <PricingTab />}
      {activeTab === "drop" && <LiveDropCalculator />}
      {activeTab === "winback" && <WinBackTab />}
      {activeTab === "approvals" && isAdmin && <ApprovalsTab />}
    </div>
  );
}