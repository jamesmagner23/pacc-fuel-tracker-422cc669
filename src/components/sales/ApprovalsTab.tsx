import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useQuoteApprovals, useDecideApproval, type QuoteApprovalRequest } from "@/hooks/useQuoteApprovals";

export default function ApprovalsTab() {
  const { data: requests = [], isLoading } = useQuoteApprovals();
  const decide = useDecideApproval();
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const filtered = requests.filter((r) => (filter === "all" ? true : r.status === "pending"));

  const handleDecide = async (r: QuoteApprovalRequest, status: "approved" | "rejected") => {
    try {
      await decide.mutateAsync({ id: r.id, status, admin_note: noteById[r.id] });
      toast.success(status === "approved" ? "Approved" : "Rejected");
    } catch { toast.error("Failed to update"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Driver-submitted quotes that need admin sign-off.
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-[11px] px-3 py-1.5 rounded-md capitalize border-none cursor-pointer transition-colors"
              style={{
                background: filter === f ? "var(--card)" : "transparent",
                color: filter === f ? "var(--foreground)" : "var(--muted-foreground)",
                fontWeight: filter === f ? 600 : 500,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-xs text-muted-foreground">
          No {filter === "pending" ? "pending" : ""} approval requests.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{r.customer_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(parseISO(r.created_at), "dd MMM yyyy HH:mm")}
                    {r.customer_email ? ` · ${r.customer_email}` : ""}
                  </div>
                </div>
                <StatusPill status={r.status} />
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-[12px]">
                <Cell label="Litres" value={`${Number(r.litres).toLocaleString()} L`} />
                <Cell label="Sell inc-GST" value={`$${Number(r.sell_price_per_litre).toFixed(4)}`} />
                <Cell label="Buy" value={`$${Number(r.buy_price_per_litre).toFixed(4)}`} sub={r.supplier || undefined} />
                <Cell label="Margin" value={`${Number(r.margin_pct).toFixed(1)}%`} />
                <Cell label="Terms" value={r.payment_terms_days == null ? "—" : `${r.payment_terms_days}d`} />
              </div>

              {r.breach_reasons?.length > 0 && (
                <ul className="mt-3 text-[11px] text-amber-500 list-disc list-inside space-y-0.5">
                  {r.breach_reasons.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}

              {r.driver_note && (
                <div className="mt-2 text-[12px] text-muted-foreground italic">
                  Driver: "{r.driver_note}"
                </div>
              )}

              {r.status === "pending" ? (
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input
                    value={noteById[r.id] || ""}
                    onChange={(e) => setNoteById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Reply / reason (optional)"
                    className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-[12px] outline-none"
                  />
                  <button
                    onClick={() => handleDecide(r, "approved")}
                    disabled={decide.isPending}
                    className="text-[12px] px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => handleDecide(r, "rejected")}
                    disabled={decide.isPending}
                    className="text-[12px] px-3 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 cursor-pointer flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              ) : (
                r.admin_note && (
                  <div className="mt-3 text-[11px] text-muted-foreground border-t border-border pt-2">
                    Admin note: {r.admin_note}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: QuoteApprovalRequest["status"] }) {
  const map = {
    pending: { bg: "bg-amber-500/15", text: "text-amber-300", icon: <Clock className="w-3 h-3" />, label: "Pending" },
    approved: { bg: "bg-emerald-500/15", text: "text-emerald-300", icon: <CheckCircle2 className="w-3 h-3" />, label: "Approved" },
    rejected: { bg: "bg-red-500/15", text: "text-red-300", icon: <XCircle className="w-3 h-3" />, label: "Rejected" },
  } as const;
  const c = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${c.bg} ${c.text}`}>
      {c.icon} {c.label}
    </span>
  );
}