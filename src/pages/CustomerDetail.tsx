import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Save, X, Loader2 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions } from "@/hooks/useTransactions";
import { format, parseISO } from "date-fns";
import { useClientAccountByName, useEnsureClientAccount } from "@/hooks/useClientAccountByName";
import { useClientProfile, useUpsertClientProfile, type ClientProfile } from "@/hooks/useClientProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function cssVar(name: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export default function CustomerDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { range } = useDateRange();
  const customerName = decodeURIComponent(name || "");
  const { data: allFiltered = [], isLoading } = useTransactions(range);

  const filtered = useMemo(
    () => allFiltered.filter((t) => t.nombre_cliente1 === customerName),
    [allFiltered, customerName]
  );

  const locationData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => { const c = t.ciudad || "Unknown"; map[c] = (map[c] || 0) + (t.cantidad || 0); });
    return Object.entries(map).map(([name, litres]) => ({ name, litres })).sort((a, b) => b.litres - a.litres);
  }, [filtered]);

  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => { if (t.date) map[t.date] = (map[t.date] || 0) + (t.cantidad || 0); });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, litres]) => ({ date: format(parseISO(date), "dd MMM"), litres }));
  }, [filtered]);

  const avgSize = filtered.length > 0 ? Math.round(filtered.reduce((s, t) => s + (t.cantidad || 0), 0) / filtered.length) : 0;

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!customerName) return <div className="p-8 text-muted-foreground">Customer not found.</div>;

  const surface = cssVar("--surface", "#142A16");
  const border = cssVar("--surface-border", "#2A4A2E");
  const textPrimary = cssVar("--text-primary", "#ECE4D2");
  const textSecondary = cssVar("--text-secondary", "#C7BFAC");
  const accent = cssVar("--accent", "#C8F26A");

  const tooltipStyle = { backgroundColor: surface, border: `1px solid ${border}`, borderRadius: "8px", fontSize: 12 };
  const tooltipLabelStyle = { color: textPrimary };
  const tooltipItemStyle = { color: textPrimary };

  return (
    <div className="space-y-6 max-w-5xl">
      <button onClick={() => navigate("/customers")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </button>

      <div>
        <h1 className="text-xl font-bold">{customerName}</h1>
        <p className="text-sm text-muted-foreground mt-1">Avg delivery: {avgSize.toLocaleString()}L · {filtered.length} deliveries this period</p>
      </div>

      <ProfileCard customerName={customerName} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">Volume by Location</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locationData.slice(0, 8)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: textSecondary }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: textSecondary }} axisLine={false} tickLine={false} width={100} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]} />
                <Bar dataKey="litres" fill={accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">Volume Over Time</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: textSecondary }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: textSecondary }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]} />
                <Line type="monotone" dataKey="litres" stroke={accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">Recent Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Location</th>
                <th className="pb-2 pr-4">Truck</th>
                <th className="pb-2 pr-4 text-right">Litres</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 20).map((t) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2.5 pr-4 whitespace-nowrap">{format(parseISO(t.fecha), "dd MMM HH:mm")}</td>
                  <td className="py-2.5 pr-4">{t.ciudad}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">{t.estacion}</td>
                  <td className="py-2.5 pr-4 text-right font-medium">{(t.cantidad || 0).toLocaleString()}L</td>
                  <td className="py-2.5 text-right font-medium">${(t.dinero_total || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profile card — ABN, address, contacts                              */
/* ------------------------------------------------------------------ */

const FIELD_GROUPS: Array<{
  title: string;
  fields: Array<{ key: keyof ClientProfile; label: string; type?: string; colSpan?: string }>;
}> = [
  {
    title: "Business",
    fields: [
      { key: "legal_business_name", label: "Legal business name", colSpan: "sm:col-span-2" },
      { key: "abn", label: "ABN" },
      { key: "website", label: "Website" },
    ],
  },
  {
    title: "Billing address",
    fields: [
      { key: "billing_address_line1", label: "Address line 1", colSpan: "sm:col-span-2" },
      { key: "billing_address_line2", label: "Address line 2", colSpan: "sm:col-span-2" },
      { key: "billing_suburb", label: "Suburb" },
      { key: "billing_state", label: "State" },
      { key: "billing_postcode", label: "Postcode" },
      { key: "billing_country", label: "Country" },
    ],
  },
  {
    title: "Primary contact",
    fields: [
      { key: "primary_contact_name", label: "Name" },
      { key: "primary_contact_email", label: "Email", type: "email" },
      { key: "primary_contact_phone", label: "Phone", type: "tel" },
    ],
  },
  {
    title: "Operations contact",
    fields: [
      { key: "ops_contact_name", label: "Name" },
      { key: "ops_contact_email", label: "Email", type: "email" },
      { key: "ops_contact_phone", label: "Phone", type: "tel" },
    ],
  },
  {
    title: "Accounts contact",
    fields: [
      { key: "accounts_contact_name", label: "Name" },
      { key: "accounts_contact_email", label: "Email", type: "email" },
      { key: "accounts_contact_phone", label: "Phone", type: "tel" },
    ],
  },
  {
    title: "Site contact",
    fields: [
      { key: "site_contact_name", label: "Name" },
      { key: "site_contact_email", label: "Email", type: "email" },
      { key: "site_contact_phone", label: "Phone", type: "tel" },
    ],
  },
];

function ProfileCard({ customerName }: { customerName: string }) {
  const { data: account, isLoading: loadingAccount } = useClientAccountByName(customerName);
  const ensure = useEnsureClientAccount();
  const [resolvedId, setResolvedId] = useState<number | null>(null);

  useEffect(() => {
    if (account?.id) setResolvedId(account.id);
  }, [account?.id]);

  const { data: profile, isLoading: loadingProfile } = useClientProfile(resolvedId);
  const upsert = useUpsertClientProfile();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<ClientProfile>>({});

  useEffect(() => {
    if (profile) setDraft(profile);
  }, [profile?.id]);

  const startEdit = async () => {
    let id = resolvedId;
    if (!id) {
      try {
        id = await ensure.mutateAsync(customerName);
        setResolvedId(id);
      } catch (e) {
        return;
      }
    }
    setDraft(profile || { client_account_id: id });
    setEditing(true);
  };

  const cancel = () => {
    setDraft(profile || {});
    setEditing(false);
  };

  const save = async () => {
    if (!resolvedId) return;
    await upsert.mutateAsync({ ...draft, client_account_id: resolvedId });
    setEditing(false);
  };

  const set = (k: keyof ClientProfile, v: string) =>
    setDraft((d) => ({ ...d, [k]: v || null }));

  const loading = loadingAccount || (resolvedId && loadingProfile);

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Customer Profile</h2>
        {!editing ? (
          <Button
            size="sm"
            variant="outline"
            onClick={startEdit}
            disabled={ensure.isPending}
            className="h-8"
          >
            {ensure.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Pencil className="w-3.5 h-3.5" />
            )}
            <span className="ml-1.5">Edit</span>
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={cancel} className="h-8">
              <X className="w-3.5 h-3.5" />
              <span className="ml-1.5">Cancel</span>
            </Button>
            <Button size="sm" onClick={save} disabled={upsert.isPending} className="h-8">
              {upsert.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span className="ml-1.5">Save</span>
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-4">Loading profile…</div>
      ) : (
        <div className="space-y-5">
          {FIELD_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                {group.title}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {group.fields.map((f) => {
                  const value = (editing ? draft[f.key] : profile?.[f.key]) as string | null | undefined;
                  return (
                    <div key={f.key as string} className={f.colSpan || ""}>
                      <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
                      {editing ? (
                        <Input
                          type={f.type || "text"}
                          value={(value as string) || ""}
                          onChange={(e) => set(f.key, e.target.value)}
                          className="mt-1 h-9 text-sm"
                        />
                      ) : (
                        <div className="mt-1 text-sm text-foreground min-h-[36px] py-1.5 px-0.5 break-words">
                          {value || <span className="text-muted-foreground">—</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
