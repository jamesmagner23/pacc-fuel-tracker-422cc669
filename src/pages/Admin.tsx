import { useState } from "react";
import { LayoutDashboard, Gauge, Users, Shield, TrendingUp, UserMinus } from "lucide-react";
import Reconciliation from "./Reconciliation";
import SOPManager from "@/components/admin/SOPManager";
import AdminOverview from "@/components/admin/AdminOverview";
import UsersActivityTab from "@/components/admin/UsersActivityTab";
import EBITDATab from "@/components/admin/EBITDATab";
import WinBackTab from "@/components/admin/WinBackTab";

type TabId = "overview" | "reconciliation" | "users" | "sops" | "ebitda" | "winback";

export default function Admin() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const tabs: { id: TabId; label: string; icon: JSX.Element }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: "reconciliation", label: "Reconciliation", icon: <Gauge className="w-3.5 h-3.5" /> },
    { id: "users", label: "Users & Activity", icon: <Users className="w-3.5 h-3.5" /> },
    { id: "sops", label: "SOPs", icon: <Shield className="w-3.5 h-3.5" /> },
    { id: "ebitda", label: "EBITDA", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: "winback", label: "Win Back", icon: <UserMinus className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-[1200px]">
      <div className="flex gap-1 bg-surface border border-surface-border rounded-[10px] p-1 mt-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer min-h-[44px] sm:min-h-0 whitespace-nowrap shrink-0"
            style={{
              background: activeTab === tab.id ? "var(--accent-light)" : "transparent",
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
              border: "none",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <AdminOverview />}
      {activeTab === "reconciliation" && <Reconciliation />}
      {activeTab === "users" && <UsersActivityTab />}
      {activeTab === "sops" && <SOPManager />}
      {activeTab === "ebitda" && <EBITDATab />}
      {activeTab === "winback" && <WinBackTab />}
    </div>
  );
}
