import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { BrandingPanel } from "@/components/customer/BrandingPanel";

/**
 * Admin-only branding manager. Lists every client account so the admin can
 * upload logos and tune accent colors without leaving the admin area.
 */
export default function BrandingTab() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: accounts = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-branding-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id, company_name, logo_url, brand_accent, branding_enabled")
        .order("company_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a: any) => (a.company_name || "").toLowerCase().includes(q));
  }, [accounts, search]);

  const selected = useMemo(
    () => accounts.find((a: any) => a.id === selectedId) || null,
    [accounts, selectedId],
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers"
            className="pl-7 h-9 text-sm"
          />
        </div>
        <div className="rounded-md border border-border bg-surface max-h-[70vh] overflow-y-auto">
          {isLoading && <div className="p-3 text-xs text-muted-foreground">Loading…</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">No customers</div>
          )}
          {filtered.map((a: any) => {
            const active = a.id === selectedId;
            return (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-b border-border last:border-b-0 transition-colors"
                style={{
                  background: active ? "var(--accent-light)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-primary)",
                }}
              >
                <div
                  className="w-7 h-7 rounded shrink-0 flex items-center justify-center overflow-hidden border border-border"
                  style={{ background: "#fff" }}
                >
                  {a.logo_url ? (
                    <img src={a.logo_url} alt="" className="max-w-[85%] max-h-[85%] object-contain" />
                  ) : (
                    <span className="text-[9px] text-muted-foreground">—</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{a.company_name}</div>
                  <div className="text-[10px] text-muted-foreground flex gap-2 items-center">
                    {a.brand_accent && (
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ background: a.brand_accent }}
                        />
                        {a.brand_accent}
                      </span>
                    )}
                    {a.branding_enabled && <span>· ON</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {selected ? (
          <BrandingPanel
            account={{
              id: selected.id,
              company_name: selected.company_name,
              logo_url: selected.logo_url ?? null,
              brand_accent: selected.brand_accent ?? null,
              branding_enabled: selected.branding_enabled ?? false,
            }}
            onChange={() => refetch()}
          />
        ) : (
          <div className="rounded-md border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
            Select a customer on the left to manage their logo and brand color.
          </div>
        )}
      </div>
    </div>
  );
}