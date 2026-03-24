import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PLOverview from "@/components/finance/PLOverview";
import BuyPriceTab from "@/components/finance/BuyPriceTab";
import ClientPricingTab from "@/components/finance/ClientPricingTab";
import PricingTab from "@/components/finance/PricingTab";
import ScheduledTab from "@/components/finance/ScheduledTab";

export default function Finance() {
  return (
    <div className="flex flex-col gap-5 max-w-[1100px]">
      <Tabs defaultValue="pnl">
        <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-1">
          {[
            { value: "pnl", label: "P&L Overview" },
            { value: "buy", label: "Buy Price" },
            { value: "clients", label: "Client Pricing" },
            { value: "quotes", label: "Quote Builder" },
            { value: "scheduled", label: "Scheduled" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="px-4 py-2 text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none bg-transparent"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="pnl" className="mt-5">
          <PLOverview />
        </TabsContent>
        <TabsContent value="buy" className="mt-5">
          <BuyPriceTab />
        </TabsContent>
        <TabsContent value="clients" className="mt-5">
          <ClientPricingTab />
        </TabsContent>
        <TabsContent value="quotes" className="mt-5">
          <PricingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
