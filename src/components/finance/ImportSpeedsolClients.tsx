import { useState, useMemo } from "react";
import { Download, Check, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  existingSpeedsolNames: string[];
}

export default function ImportSpeedsolClients({ existingSpeedsolNames }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: txnCustomers = [] } = useQuery({
    queryKey: ["speedsol-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("nombre_cliente1")
        .not("nombre_cliente1", "is", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r) => {
        const name = r.nombre_cliente1!;
        counts[name] = (counts[name] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    },
    enabled: open,
  });

  const existingSet = useMemo(() => new Set(existingSpeedsolNames.map((n) => n?.toUpperCase())), [existingSpeedsolNames]);

  const unimported = useMemo(
    () => txnCustomers.filter((c) => !existingSet.has(c.name.toUpperCase())),
    [txnCustomers, existingSet]
  );

  const importMutation = useMutation({
    mutationFn: async (names: string[]) => {
      const rows = names.map((name) => ({
        company_name: name,
        contact_email: `${name.toLowerCase().replace(/\s+/g, ".")}@placeholder.com`,
        speedsol_name: name,
      }));
      const { error } = await supabase.from("client_accounts").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-accounts"] });
      toast.success(`Imported ${selected.size} client(s)`);
      setSelected(new Set());
    },
    onError: () => toast.error("Import failed"),
  });

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(unimported.map((c) => c.name)));

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-surface border border-surface-border rounded-[10px] p-4 w-full flex items-center justify-between cursor-pointer hover:border-primary/40 transition-colors"
      >
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Import from Transactions</div>
          <div className="text-[12px] text-muted-foreground">Auto-create client accounts from SpeedSol data</div>
        </div>
        <Download className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Import SpeedSol Customers ({unimported.length} new)
        </div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {unimported.length === 0 ? (
        <div className="text-[12px] text-muted-foreground">All transaction customers are already imported.</div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={selectAll}
              className="text-[11px] text-primary hover:underline cursor-pointer bg-transparent border-none"
            >
              Select all
            </button>
            <span className="text-[11px] text-muted-foreground">
              {selected.size} selected
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto flex flex-col gap-0.5">
            {unimported.map((c) => (
              <label
                key={c.name}
                className="flex items-center gap-2.5 py-2 px-2 rounded-lg cursor-pointer hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.name)}
                  onChange={() => toggle(c.name)}
                  className="accent-primary w-3.5 h-3.5"
                />
                <span className="text-[12px] text-foreground flex-1 truncate">{c.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{c.count} txns</span>
              </label>
            ))}
          </div>
          <button
            onClick={() => importMutation.mutate(Array.from(selected))}
            disabled={selected.size === 0 || importMutation.isPending}
            className="mt-3 bg-primary text-primary-foreground border-none rounded-full px-5 py-2 text-[11px] font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check className="w-3 h-3" />
            {importMutation.isPending ? "Importing…" : `Import ${selected.size} Client(s)`}
          </button>
        </>
      )}
    </div>
  );
}
