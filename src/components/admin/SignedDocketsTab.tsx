import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { FileSignature, X, Search, Download } from "lucide-react";

interface SignedStop {
  id: string;
  site_name: string;
  scheduled_date: string;
  signed_at: string;
  completed_at: string | null;
  customer_name: string | null;
  customer_role: string | null;
  customer_signature: string | null;
  driver_signature: string | null;
  signature_notes: string | null;
  delivered_litres: number | null;
  client_account_id: number;
  driver_user_id: string | null;
  truck_id: string | null;
  products: any;
}

export default function SignedDocketsTab() {
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<SignedStop | null>(null);

  const { data: stops = [], isLoading } = useQuery({
    queryKey: ["admin-signed-dockets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_stops" as any)
        .select("*")
        .not("signed_at", "is", null)
        .order("signed_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as SignedStop[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["signed-dockets-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("client_accounts").select("id, company_name");
      return data || [];
    },
  });
  const clientNameById = useMemo(() => {
    const m: Record<number, string> = {};
    clients.forEach((c: any) => (m[c.id] = c.company_name));
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stops;
    return stops.filter((s) => {
      const cn = clientNameById[s.client_account_id] || "";
      return (
        s.site_name?.toLowerCase().includes(q) ||
        s.customer_name?.toLowerCase().includes(q) ||
        cn.toLowerCase().includes(q)
      );
    });
  }, [stops, search, clientNameById]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <FileSignature className="w-4 h-4" /> Signed Dockets
          </h2>
          <p className="text-xs text-muted-foreground">All driver/customer signed delivery dockets</p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search site, customer, client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface border border-surface-border rounded-lg pl-8 pr-3 py-2 text-xs w-64 text-foreground"
          />
        </div>
      </div>

      <div className="bg-surface border border-surface-border rounded-[10px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-raised/40 text-muted-foreground uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left px-3 py-2.5">Signed</th>
                <th className="text-left px-3 py-2.5">Site</th>
                <th className="text-left px-3 py-2.5">Client</th>
                <th className="text-left px-3 py-2.5">Customer</th>
                <th className="text-right px-3 py-2.5">Litres</th>
                <th className="text-center px-3 py-2.5">Signatures</th>
                <th className="text-right px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No signed dockets yet</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-surface-border hover:bg-surface-raised/40">
                  <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                    {format(parseISO(s.signed_at), "dd MMM yy HH:mm")}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{s.site_name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{clientNameById[s.client_account_id] || "—"}</td>
                  <td className="px-3 py-2.5">
                    {s.customer_name || "—"}
                    {s.customer_role && <span className="text-muted-foreground"> · {s.customer_role}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {s.delivered_litres != null ? `${Number(s.delivered_litres).toLocaleString()}L` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px]">
                      <span className={s.customer_signature ? "text-primary" : "text-muted-foreground/50"}>● Cust</span>
                      <span className={s.driver_signature ? "text-primary" : "text-muted-foreground/50"}>● Drv</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => setViewing(s)}
                      className="text-xs px-2.5 py-1 rounded-md bg-surface-raised hover:bg-surface-raised/80 text-foreground border border-surface-border"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <DocketViewer stop={viewing} clientName={clientNameById[viewing.client_account_id]} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

function DocketViewer({ stop, clientName, onClose }: { stop: SignedStop; clientName?: string; onClose: () => void }) {
  const products = stop.products as any;
  const lines = Array.isArray(products?.lines) ? products.lines : [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-surface border border-surface-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border sticky top-0 bg-surface">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Signed Docket</div>
            <div className="text-base font-semibold">{stop.site_name}</div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/docket/${stop.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground inline-flex items-center gap-1.5"
            >
              <Download className="w-3 h-3" /> Open / Print
            </a>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-surface-raised"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Info label="Client" value={clientName || "—"} />
            <Info label="Date" value={format(parseISO(stop.scheduled_date), "dd MMM yyyy")} />
            <Info label="Signed at" value={format(parseISO(stop.signed_at), "dd MMM yy HH:mm")} />
            <Info label="Delivered" value={stop.delivered_litres != null ? `${Number(stop.delivered_litres).toLocaleString()} L` : "—"} />
            <Info label="Customer" value={stop.customer_name || "—"} />
            <Info label="Role" value={stop.customer_role || "—"} />
          </div>

          {lines.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Fills ({lines.length})</div>
              <div className="border border-surface-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-surface-raised/40 text-muted-foreground text-[10px]">
                    <tr>
                      <th className="text-left px-2 py-1.5">Time</th>
                      <th className="text-left px-2 py-1.5">Plant / Rego</th>
                      <th className="text-left px-2 py-1.5">Product</th>
                      <th className="text-right px-2 py-1.5">Litres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l: any, i: number) => (
                      <tr key={i} className="border-t border-surface-border">
                        <td className="px-2 py-1.5 tabular-nums">{l.at ? format(parseISO(l.at), "HH:mm") : "—"}</td>
                        <td className="px-2 py-1.5">{l.placa || l.fleet || "—"}</td>
                        <td className="px-2 py-1.5">{l.product || "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{Number(l.litres || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <SignatureBlock label="Customer" name={stop.customer_name} img={stop.customer_signature} />
            <SignatureBlock label="Driver" name={null} img={stop.driver_signature} />
          </div>

          {stop.signature_notes && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
              <div className="text-xs bg-surface-raised/40 border border-surface-border rounded-lg p-2.5">{stop.signature_notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function SignatureBlock({ label, name, img }: { label: string; name: string | null; img: string | null }) {
  return (
    <div className="border border-surface-border rounded-lg p-2.5 bg-white">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      {img ? (
        <img src={img} alt={`${label} signature`} className="w-full h-24 object-contain bg-white" />
      ) : (
        <div className="h-24 flex items-center justify-center text-[10px] text-gray-400">No signature</div>
      )}
      {name && <div className="text-[11px] text-gray-700 mt-1 border-t border-gray-200 pt-1">{name}</div>}
    </div>
  );
}