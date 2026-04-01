import { useState } from "react";
import { Truck, UserCheck } from "lucide-react";
import Trucks from "./Trucks";
import Drivers from "./Drivers";

const tabs = [
  { id: "trucks", label: "Trucks", icon: Truck },
  { id: "drivers", label: "Drivers", icon: UserCheck },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function Performance() {
  const [active, setActive] = useState<TabId>("trucks");

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold">Performance</h1>
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: active === tab.id ? "rgba(255,255,255,0.08)" : "transparent",
                color: active === tab.id ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {active === "trucks" ? <TrucksContent /> : <DriversContent />}
    </div>
  );
}

/* Render inner content without the duplicate h1 */
function TrucksContent() {
  return (
    <div className="[&>div>h1]:hidden">
      <Trucks />
    </div>
  );
}

function DriversContent() {
  return (
    <div className="[&>div>h1]:hidden">
      <Drivers />
    </div>
  );
}
