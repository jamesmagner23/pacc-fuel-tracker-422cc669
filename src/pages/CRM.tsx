import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Search } from "lucide-react";
import { useCrmCustomers, type CrmCustomer } from "@/hooks/useCrm";
import PipelineBoard from "@/components/crm/PipelineBoard";
import CustomerDrawer from "@/components/crm/CustomerDrawer";
import CustomerEditor from "@/components/crm/CustomerEditor";
import CrmInsights from "@/components/crm/CrmInsights";

export default function CRM() {
  const { data, loading, refresh } = useCrmCustomers();
  const [selected, setSelected] = useState<CrmCustomer | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.industry ?? "").toLowerCase().includes(q) ||
      (c.source ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">CRM</h1>
          <p className="text-xs text-muted-foreground">Acquisition + retention pipeline. All comms logged. Templates avoid double-contact.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)" }} className="h-10">
          <Plus className="w-4 h-4 mr-1.5" /> New customer / lead
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search customers, industry, source…"
          className="pl-9 bg-surface border-surface-border h-10"
        />
      </div>

      <Tabs defaultValue="acquisition">
        <TabsList className="bg-surface border border-surface-border">
          <TabsTrigger value="acquisition">Acquisition</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="acquisition" className="mt-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
          ) : (
            <PipelineBoard mode="acquisition" customers={filtered} onSelect={setSelected} onChanged={refresh} />
          )}
        </TabsContent>

        <TabsContent value="retention" className="mt-4">
          <PipelineBoard mode="retention" customers={filtered} onSelect={setSelected} onChanged={refresh} />
        </TabsContent>

        <TabsContent value="insights" className="mt-4">
          <CrmInsights />
        </TabsContent>
      </Tabs>

      <CustomerDrawer customer={selected} onClose={() => setSelected(null)} onChanged={refresh} />
      <CustomerEditor open={createOpen} onClose={() => setCreateOpen(false)} onSaved={refresh} />

      <p className="text-xs text-muted-foreground">
        Email templates are managed under <a href="/admin" className="text-accent hover:underline">Admin → Email Templates</a>.
      </p>
    </div>
  );
}