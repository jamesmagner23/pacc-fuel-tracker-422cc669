import { useState } from "react";
import { Truck, Users, Route, Gauge, Mail, FileText } from "lucide-react";
import Reconciliation from "./Reconciliation";
import Trucks from "./Trucks";
import Customers from "./Customers";
import Dispatch from "./Dispatch";
import Outreach from "./Outreach";
import EmailTemplatesTab from "@/components/admin/EmailTemplatesTab";

type TabId = "trucks" | "customers" | "dispatch" | "reconciliation" | "outreach" | "email-templates";

export default function Admin() {
  const [activeTab, setActiveTab] = useState<TabId>("trucks");

  const tabs: { id: TabId; label: string; icon: JSX.Element }[] = [
    { id: "trucks", label: "Trucks", icon: <Truck className="w-3.5 h-3.5" /> },
    { id: "customers", label: "Customers", icon: <Users className="w-3.5 h-3.5" /> },
    { id: "dispatch", label: "Dispatch", icon: <Route className="w-3.5 h-3.5" /> },
    { id: "reconciliation", label: "Reconciliation", icon: <Gauge className="w-3.5 h-3.5" /> },
    { id: "outreach", label: "Outreach", icon: <Mail className="w-3.5 h-3.5" /> },
    { id: "email-templates", label: "Email Templates", icon: <FileText className="w-3.5 h-3.5" /> },
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

      {activeTab === "trucks" && <Trucks />}
      {activeTab === "customers" && <Customers />}
      {activeTab === "dispatch" && <Dispatch />}
      {activeTab === "reconciliation" && <Reconciliation />}
      {activeTab === "outreach" && <Outreach />}
      {activeTab === "email-templates" && <EmailTemplatesTab />}
    </div>
  );
}
