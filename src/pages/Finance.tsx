import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PLOverview from "@/components/finance/PLOverview";
import BuyPriceTab from "@/components/finance/BuyPriceTab";

export default function Finance() {
  return (
    <div className="flex flex-col gap-5 max-w-[1100px]">
      <Tabs defaultValue="pnl">
        <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-0 overflow-x-auto flex-nowrap">
          {[
            { value: "pnl", label: "P&L Overview" },
            { value: "buy", label: "Buy Price" },
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

        <TabsContent value="pnl" className="mt-5">
          <PLOverview />
        </TabsContent>
        <TabsContent value="buy" className="mt-5">
          <BuyPriceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
