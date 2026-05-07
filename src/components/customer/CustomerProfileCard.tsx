import { useEffect, useState } from "react";
import { Pencil, Save, X, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useClientAccountByName,
  useEnsureClientAccount,
} from "@/hooks/useClientAccountByName";
import {
  useClientProfile,
  useUpsertClientProfile,
  type ClientProfile,
} from "@/hooks/useClientProfile";
import { useUserRole } from "@/hooks/useUserRole";

/** Fields admins can edit but ops/client cannot. */
const ADMIN_ONLY_KEYS = new Set<keyof ClientProfile>([
  "legal_business_name",
  "abn",
  "billing_address_line1",
  "billing_address_line2",
  "billing_suburb",
  "billing_state",
  "billing_postcode",
  "billing_country",
]);

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

/**
 * Customer Profile editor.
 *
 * Role rules:
 * - admin → can edit everything
 * - any other authenticated role (ops/driver/client) → can edit contact &
 *   website fields, but billing address + ABN + legal name are locked.
 *
 * Server-side, the `guard_client_profile_admin_fields` trigger enforces
 * the same rule for billing address regardless of what the UI sends.
 */
export function CustomerProfileCard({ customerName }: { customerName: string }) {
  const { data: role } = useUserRole();
  const isAdmin = role === "admin";

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
      } catch {
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
    // Strip admin-only fields when a non-admin saves so the trigger never
    // sees them as changed.
    const payload: Partial<ClientProfile> & { client_account_id: number } = {
      client_account_id: resolvedId,
    };
    Object.entries(draft).forEach(([k, v]) => {
      const key = k as keyof ClientProfile;
      if (!isAdmin && ADMIN_ONLY_KEYS.has(key)) return;
      (payload as any)[key] = v;
    });
    await upsert.mutateAsync(payload);
    setEditing(false);
  };

  const set = (k: keyof ClientProfile, v: string) =>
    setDraft((d) => ({ ...d, [k]: v || null }));

  const loading = loadingAccount || (resolvedId && loadingProfile);

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">Customer Profile</h2>
          {!isAdmin && (
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Billing address &amp; ABN are admin-only
            </p>
          )}
        </div>
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
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                {group.title}
                {!isAdmin &&
                  group.fields.every((f) => ADMIN_ONLY_KEYS.has(f.key)) && (
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {group.fields.map((f) => {
                  const value = (editing ? draft[f.key] : profile?.[f.key]) as
                    | string
                    | null
                    | undefined;
                  const locked = !isAdmin && ADMIN_ONLY_KEYS.has(f.key);
                  return (
                    <div key={f.key as string} className={f.colSpan || ""}>
                      <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                        {f.label}
                        {locked && editing && <Lock className="w-2.5 h-2.5" />}
                      </Label>
                      {editing && !locked ? (
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