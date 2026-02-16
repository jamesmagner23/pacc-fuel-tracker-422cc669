import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { PortalLayout, type PortalDateRange } from "@/components/PortalLayout";
import PortalOverview from "./PortalOverview";
import PortalSites from "./PortalSites";
import PortalEquipment from "./PortalEquipment";
import PortalHistory from "./PortalHistory";
import PortalNotifications from "./PortalNotifications";

export default function PortalRoot() {
  const [dateRange, setDateRange] = useState<PortalDateRange>("This Month");

  return (
    <PortalLayout dateRange={dateRange} onDateRangeChange={setDateRange}>
      <Routes>
        <Route index element={<PortalOverview dateRange={dateRange} />} />
        <Route path="sites" element={<PortalSites dateRange={dateRange} />} />
        <Route path="equipment" element={<PortalEquipment dateRange={dateRange} />} />
        <Route path="history" element={<PortalHistory dateRange={dateRange} />} />
        <Route path="notifications" element={<PortalNotifications />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    </PortalLayout>
  );
}
