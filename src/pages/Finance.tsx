import { useUrlTab } from "@/hooks/useUrlTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PLOverview from "@/components/finance/PLOverview";
import BuyPriceTab from "@/components/finance/BuyPriceTab";
import CompetitorAnalyserTab from "@/components/finance/CompetitorAnalyserTab";

export default function Finance() {
  const [tab, setTab] = useUrlTab(["pnl", "buy", "competitor"] as const, "pnl");
  return (
    <div className="flex flex-col gap-5 max-w-[1100px] w-full min-w-0">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Finance</h1>
        <p className="text-xs text-muted-foreground mt-0.5">P&L overview and fuel buy-price tracking</p>
      </div>

      <Tabs value={tab} onValueChange={value => setTab(value as typeof tab)}>
        <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-0 overflow-x-auto flex-nowrap w-full justify-start snap-x">
          {[
            { value: "pnl", label: "P&L Overview" },
            { value: "buy", label: "Buy Price" },
            { value: "competitor", label: "Competitor Analyser" },
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
        <TabsContent value="competitor" className="mt-5">
          <CompetitorAnalyserTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
