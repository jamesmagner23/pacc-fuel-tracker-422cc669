import { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  useClientProfile,
  useUpsertClientProfile,
  type ClientProfile,
} from "@/hooks/useClientProfile";
import { abnError, formatAbn, stripAbn } from "@/lib/abn";

// Light "showcase email" palette — matches CustomerPortal root.
const T = {
  bg: "#FAF6EF",
  card: "#FFFFFF",
  border: "#EDE3D2",
  text: "#3D2B1A",
  muted: "#8B7355",
  subtle: "#6B5240",
  accent: "#E8461E",
  sansHead: "Inter, system-ui, sans-serif",
  sansBody: "Inter, system-ui, sans-serif",
};

const label: React.CSSProperties = {
  fontSize: 10,
  fontFamily: T.sansHead,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: T.subtle,
  display: "block",
  marginBottom: 4,
};

const input: React.CSSProperties = {
  width: "100%",
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  padding: "10px 12px",
  color: T.text,
  fontSize: 13,
  fontFamily: T.sansBody,
  outline: "none",
};

const inputDisabled: React.CSSProperties = {
  ...input,
  background: "#F1E8D8",
  color: T.subtle,
  opacity: 1,
  cursor: "not-allowed",
};

interface Props {
  open: boolean;
  onClose: () => void;
  clientAccountId: number | null;
  companyName: string;
  userEmail: string;
}

type Form = Partial<ClientProfile>;

const EMPTY: Form = {};

export function AccountModal({ open, onClose, clientAccountId, companyName, userEmail }: Props) {
  const { data: profile, isLoading } = useClientProfile(clientAccountId);
  const upsert = useUpsertClientProfile();
  const [form, setForm] = useState<Form>(EMPTY);

  useEffect(() => {
    if (profile) setForm(profile);
    else setForm(EMPTY);
  }, [profile, open]);

  if (!open) return null;

  const set = (k: keyof ClientProfile, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // ABN: stored as digits-only in DB; displayed/edited as "XX XXX XXX XXX"
  const abnDigits = stripAbn((form.abn as string) || "");
  const abnDisplay = formatAbn(abnDigits);
  const abnIssue = abnError(abnDigits);
  const abnValid = abnDigits.length === 11 && !abnIssue;

  const handleSave = () => {
    if (!clientAccountId) return;
    if (abnIssue) return; // blocked by validation
    // Only send client-editable fields. Admin fields stay untouched.
    const payload = {
      client_account_id: clientAccountId,
      legal_business_name: form.legal_business_name?.trim() || null,
      abn: abnDigits || null,
      website: form.website ?? null,
      primary_contact_name: form.primary_contact_name ?? null,
      primary_contact_email: form.primary_contact_email ?? null,
      primary_contact_phone: form.primary_contact_phone ?? null,
      ops_contact_name: form.ops_contact_name ?? null,
      ops_contact_email: form.ops_contact_email ?? null,
      ops_contact_phone: form.ops_contact_phone ?? null,
      accounts_contact_name: form.accounts_contact_name ?? null,
      accounts_contact_email: form.accounts_contact_email ?? null,
      accounts_contact_phone: form.accounts_contact_phone ?? null,
      site_contact_name: form.site_contact_name ?? null,
      site_contact_email: form.site_contact_email ?? null,
      site_contact_phone: form.site_contact_phone ?? null,
    };
    upsert.mutate(payload, { onSuccess: () => onClose() });
  };

  const billingLine = [
    profile?.billing_address_line1,
    profile?.billing_address_line2,
    [profile?.billing_suburb, profile?.billing_state, profile?.billing_postcode]
      .filter(Boolean)
      .join(" "),
    profile?.billing_country,
  ]
    .filter(Boolean)
    .join(", ");

  const ContactBlock = ({
    title,
    nameKey,
    emailKey,
    phoneKey,
  }: {
    title: string;
    nameKey: keyof ClientProfile;
    emailKey: keyof ClientProfile;
    phoneKey: keyof ClientProfile;
  }) => (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontFamily: T.sansHead,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: T.text,
          marginBottom: 12,
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        <div>
          <label style={label}>Name</label>
          <input
            style={input}
            value={(form[nameKey] as string) || ""}
            onChange={(e) => set(nameKey, e.target.value)}
            placeholder="Full name"
          />
        </div>
        <div>
          <label style={label}>Email</label>
          <input
            style={input}
            type="email"
            value={(form[emailKey] as string) || ""}
            onChange={(e) => set(emailKey, e.target.value)}
            placeholder="name@company.com"
          />
        </div>
        <div>
          <label style={label}>Phone</label>
          <input
            style={input}
            value={(form[phoneKey] as string) || ""}
            onChange={(e) => set(phoneKey, e.target.value)}
            placeholder="04xx xxx xxx"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(61,43,26,0.45)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 12px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          width: "100%",
          maxWidth: 760,
          color: T.text,
          fontFamily: T.sansBody,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontFamily: T.sansHead,
                fontWeight: 700,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              My Account
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              {companyName} · {userEmail}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: T.muted,
              cursor: "pointer",
              padding: 4,
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          {isLoading ? (
            <p style={{ color: T.muted, fontSize: 13 }}>Loading...</p>
          ) : (
            <>
              {/* Business details — ABN & legal name client-editable, billing admin-only */}
              <div
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: T.sansHead,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    Business Details
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                  }}
                >
                  <div>
                    <label style={label}>Legal Business Name</label>
                    <input
                      style={input}
                      value={form.legal_business_name || ""}
                      onChange={(e) => set("legal_business_name", e.target.value)}
                      placeholder={companyName}
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <label style={label}>
                      ABN{" "}
                      <span style={{ color: T.muted, textTransform: "none", letterSpacing: 0 }}>
                        (11 digits)
                      </span>
                    </label>
                    <input
                      style={{
                        ...input,
                        borderColor: abnIssue
                          ? "#e0593c"
                          : abnValid
                          ? "#3a7d4a"
                          : T.border,
                        fontVariantNumeric: "tabular-nums",
                        letterSpacing: "0.05em",
                      }}
                      value={abnDisplay}
                      onChange={(e) => set("abn", stripAbn(e.target.value))}
                      onBlur={() =>
                        // normalise display on blur (also re-runs format)
                        set("abn", stripAbn((form.abn as string) || ""))
                      }
                      placeholder="XX XXX XXX XXX"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={14}
                      aria-invalid={!!abnIssue}
                      aria-describedby="abn-help"
                    />
                    <div
                      id="abn-help"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        marginTop: 4,
                        color: abnIssue
                          ? "#e0593c"
                          : abnValid
                          ? "#7bbf8b"
                          : T.muted,
                      }}
                    >
                      {abnIssue ? (
                        <>
                          <AlertCircle size={12} />
                          <span>{abnIssue}</span>
                        </>
                      ) : abnValid ? (
                        <>
                          <CheckCircle2 size={12} />
                          <span>Valid ABN</span>
                        </>
                      ) : (
                        <span>Enter your 11-digit ABN — we'll format it automatically.</span>
                      )}
                    </div>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={label}>Billing Address</label>
                    <input
                      style={inputDisabled}
                      value={billingLine || "Not set"}
                      disabled
                    />
                    <p style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
                      Billing address is admin-managed — contact your account manager to update it.
                    </p>
                  </div>
                </div>
              </div>

              {/* Client-editable: website */}
              <div
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <label style={label}>Website</label>
                <input
                  style={input}
                  type="url"
                  value={form.website || ""}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder="https://..."
                />
              </div>

              {/* Contacts */}
              <ContactBlock
                title="Primary Contact"
                nameKey="primary_contact_name"
                emailKey="primary_contact_email"
                phoneKey="primary_contact_phone"
              />
              <ContactBlock
                title="Operations Contact"
                nameKey="ops_contact_name"
                emailKey="ops_contact_email"
                phoneKey="ops_contact_phone"
              />
              <ContactBlock
                title="Accounts Contact"
                nameKey="accounts_contact_name"
                emailKey="accounts_contact_email"
                phoneKey="accounts_contact_phone"
              />
              <ContactBlock
                title="Site Contact"
                nameKey="site_contact_name"
                emailKey="site_contact_email"
                phoneKey="site_contact_phone"
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: `1px solid ${T.border}`,
              color: T.muted,
              padding: "9px 16px",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: T.sansHead,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={upsert.isPending || !clientAccountId || !!abnIssue}
            style={{
              background: T.accent,
              border: "none",
              color: "#fff",
              padding: "9px 18px",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: T.sansHead,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: upsert.isPending ? "wait" : abnIssue ? "not-allowed" : "pointer",
              opacity: upsert.isPending || abnIssue ? 0.6 : 1,
            }}
            title={abnIssue || undefined}
          >
            {upsert.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
