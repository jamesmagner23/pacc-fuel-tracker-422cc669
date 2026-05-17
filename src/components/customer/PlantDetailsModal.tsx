import { useEffect } from "react";
import { X } from "lucide-react";
import type { PlantItem } from "@/hooks/usePlantItems";
import { useFtcRates } from "@/hooks/useFtcRates";

interface Props {
  open: boolean;
  onClose: () => void;
  item: PlantItem | null;
  stats?: { litres: number; deliveries: number } | null;
  tags?: string[];
  projectName?: string | null;
  tokens: {
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    muted: string;
    accent: string;
    bg: string;
  };
}

/**
 * Read-only details drawer for a plant item. Shown in the portal when a
 * user clicks a card on the Plant board. Pure visual surface — no edits.
 */
export function PlantDetailsModal({ open, onClose, item, stats, tags = [], projectName, tokens }: Props) {
  const { data: rates = [] } = useFtcRates();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !item) return null;

  const rate = item.ftc_rate_id ? rates.find((r) => r.id === item.ftc_rate_id) : null;
  const litres = stats?.litres || 0;
  const credit = rate ? litres * Number(rate.rate_per_litre) : 0;

  const rows: Array<[string, string | null | undefined]> = [
    ["Asset ID", (item as any).display_asset_id || item.placa],
    ["Plate / Rego", item.placa],
    ["Type", item.equipment_type],
    ["Manufacturer", item.manufacturer],
    ["Model", item.model],
    ["Size", item.size],
    ["Tank capacity", item.tank_size_litres != null ? `${item.tank_size_litres.toLocaleString()} L` : null],
    ["Serial number", item.serial_number],
    ["Colour", item.colour],
    ["Current project", projectName || "Unassigned"],
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,12,14,0.55)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: tokens.surface,
          border: `1px solid ${tokens.border}`,
          borderRadius: 12,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflowY: "auto",
          color: tokens.text,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${tokens.border}` }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {item.colour ? (
              <span aria-hidden style={{ width: 14, height: 14, borderRadius: 4, background: item.colour, border: `1px solid ${tokens.border}` }} />
            ) : null}
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: tokens.muted, marginTop: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {item.equipment_type || "Equipment"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: "none", color: tokens.muted, cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {item.photo_url && (
          <img
            src={item.photo_url}
            alt={item.name}
            style={{ width: "100%", maxHeight: 240, objectFit: "cover", display: "block" }}
          />
        )}

        {/* Usage strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: tokens.border }}>
          <Stat label="Fuel used" value={`${Math.round(litres).toLocaleString()} L`} tokens={tokens} />
          <Stat label="Fills" value={`${stats?.deliveries || 0}`} tokens={tokens} />
          <Stat
            label="FTC est."
            value={rate ? `$${Math.round(credit).toLocaleString()}` : "—"}
            tokens={tokens}
            accent={!!rate}
          />
        </div>

        <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px" }}>
          {rows.map(([k, v]) =>
            v ? (
              <div key={k}>
                <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: tokens.muted, marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, color: tokens.text, fontFamily: k === "Plate / Rego" || k === "Serial number" ? "monospace" : undefined }}>
                  {v}
                </div>
              </div>
            ) : null,
          )}
        </div>

        {rate && (
          <div style={{ padding: "0 20px 14px" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: tokens.muted, marginBottom: 4 }}>FTC category</div>
            <div style={{ fontSize: 13 }}>{rate.equipment_type} — {(Number(rate.rate_per_litre) * 100).toFixed(1)}c/L</div>
          </div>
        )}

        {tags.length > 0 && (
          <div style={{ padding: "0 20px 14px" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: tokens.muted, marginBottom: 6 }}>Tags</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 11,
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: `${tokens.accent}22`,
                    color: tokens.accent,
                    border: `1px solid ${tokens.accent}44`,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {item.description && (
          <div style={{ padding: "0 20px 16px" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: tokens.muted, marginBottom: 4 }}>Description</div>
            <div style={{ fontSize: 13, color: tokens.textSecondary, lineHeight: 1.5 }}>{item.description}</div>
          </div>
        )}

        <div style={{ borderTop: `1px solid ${tokens.border}`, padding: "12px 20px", textAlign: "right" }}>
          <button
            onClick={onClose}
            style={{
              background: tokens.accent,
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tokens, accent }: { label: string; value: string; tokens: Props["tokens"]; accent?: boolean }) {
  return (
    <div style={{ background: tokens.surface, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: tokens.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent ? tokens.accent : tokens.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}