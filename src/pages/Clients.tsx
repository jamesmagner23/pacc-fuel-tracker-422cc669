import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Transactions from "./Transactions";
import ClientPricingTab from "@/components/finance/ClientPricingTab";
import PricingTab from "@/components/finance/PricingTab";

export default function Clients() {
  return (
    <div className="flex flex-col gap-5 max-w-[1100px]">
      <Tabs defaultValue="transactions">
        <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-0 overflow-x-auto flex-nowrap">
          {[
            { value: "transactions", label: "Transactions" },
            { value: "pricing", label: "Client Pricing" },
            { value: "quotes", label: "Quote Builder" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="px-2.5 sm:px-4 py-2 text-[12px] sm:text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none bg-transparent whitespace-nowrap shrink-0"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="transactions" className="mt-5">
          <Transactions embedded />
        </TabsContent>
        <TabsContent value="pricing" className="mt-5">
          <ClientPricingTab />
        </TabsContent>
        <TabsContent value="quotes" className="mt-5">
          <PricingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
