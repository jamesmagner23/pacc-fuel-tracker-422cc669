import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MousePointerClick, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

const CTA_LABELS: Record<string, string> = {
  tour: "60-second tour",
  "walkthrough-phone": "Walkthrough — phone",
  "walkthrough-email": "Walkthrough — email",
  "footer-phone": "Footer — phone",
  "footer-email": "Footer — email",
};

export default function EmailClicksTab() {
  const { data: clicks = [], isLoading } = useQuery({
    queryKey: ["email-cta-clicks"],
    queryFn: async () => {
      const since = subDays(new Date(), 90).toISOString();
      const { data, error } = await supabase
        .from("email_cta_clicks")
        .select("id, cta_id, campaign, destination, user_agent, clicked_at")
        .gte("clicked_at", since)
        .order("clicked_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { byCta, byCampaign, total, uniqueDays } = useMemo(() => {
    const byCta = new Map<string, number>();
    const byCampaign = new Map<string, number>();
    const days = new Set<string>();
    for (const c of clicks) {
      byCta.set(c.cta_id, (byCta.get(c.cta_id) ?? 0) + 1);
      byCampaign.set(c.campaign, (byCampaign.get(c.campaign) ?? 0) + 1);
      days.add(c.clicked_at.slice(0, 10));
    }
    return {
      byCta: [...byCta.entries()].sort((a, b) => b[1] - a[1]),
      byCampaign: [...byCampaign.entries()].sort((a, b) => b[1] - a[1]),
      total: clicks.length,
      uniqueDays: days.size,
    };
  }, [clicks]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-text-secondary text-xs uppercase tracking-wider">
        <Mail className="w-3.5 h-3.5" />
        Email CTA clicks · last 90 days
      </div>

      {/* Headline tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Total clicks" value={total} />
        <Stat label="Active days" value={uniqueDays} />
        <Stat
          label="Top CTA"
          value={byCta[0] ? CTA_LABELS[byCta[0][0]] ?? byCta[0][0] : "—"}
          sub={byCta[0] ? `${byCta[0][1]} clicks` : undefined}
        />
      </div>

      {/* By CTA */}
      <Section title="By call-to-action">
        {isLoading ? (
          <p className="text-text-muted text-sm">Loading…</p>
        ) : byCta.length === 0 ? (
          <p className="text-text-muted text-sm">No clicks recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-secondary text-xs uppercase tracking-wider">
                <th className="text-left font-medium py-2">CTA</th>
                <th className="text-right font-medium py-2">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {byCta.map(([cta, count]) => (
                <tr key={cta} className="border-t border-surface-border">
                  <td className="py-2 text-text-primary">{CTA_LABELS[cta] ?? cta}</td>
                  <td className="py-2 text-right text-text-primary font-semibold">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* By campaign */}
      <Section title="By campaign">
        {byCampaign.length === 0 ? (
          <p className="text-text-muted text-sm">No clicks recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-secondary text-xs uppercase tracking-wider">
                <th className="text-left font-medium py-2">Campaign</th>
                <th className="text-right font-medium py-2">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {byCampaign.map(([camp, count]) => (
                <tr key={camp} className="border-t border-surface-border">
                  <td className="py-2 text-text-primary">{camp}</td>
                  <td className="py-2 text-right text-text-primary font-semibold">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Recent clicks */}
      <Section title="Recent clicks (latest 20)">
        {clicks.length === 0 ? (
          <p className="text-text-muted text-sm">Nothing yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-secondary text-xs uppercase tracking-wider">
                  <th className="text-left font-medium py-2 pr-3">When</th>
                  <th className="text-left font-medium py-2 pr-3">CTA</th>
                  <th className="text-left font-medium py-2 pr-3">Campaign</th>
                  <th className="text-left font-medium py-2">Destination</th>
                </tr>
              </thead>
              <tbody>
                {clicks.slice(0, 20).map((c) => (
                  <tr key={c.id} className="border-t border-surface-border align-top">
                    <td className="py-2 pr-3 text-text-secondary whitespace-nowrap">
                      {format(new Date(c.clicked_at), "d MMM HH:mm")}
                    </td>
                    <td className="py-2 pr-3 text-text-primary">{CTA_LABELS[c.cta_id] ?? c.cta_id}</td>
                    <td className="py-2 pr-3 text-text-secondary">{c.campaign}</td>
                    <td className="py-2 text-text-secondary truncate max-w-[280px]" title={c.destination ?? ""}>
                      {c.destination ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-surface border border-surface-border rounded-lg p-4">
      <div className="text-text-secondary text-xs uppercase tracking-wider">{label}</div>
      <div className="text-text-primary text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-text-muted text-xs mt-1">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-surface-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <MousePointerClick className="w-3.5 h-3.5 text-text-secondary" />
        <h3 className="text-text-primary text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}