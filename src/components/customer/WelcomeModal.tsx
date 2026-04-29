import { useEffect, useState } from "react";
import { LayoutDashboard, Truck, Layers, Wrench, Leaf, X, ChevronRight, ChevronLeft } from "lucide-react";

// Light "showcase email" palette — matches CustomerPortal root.
const T = {
  bg: "#FAF6EF",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  border: "#EDE3D2",
  accent: "#E8461E",
  text: "#3D2B1A",
  textSecondary: "#6B5240",
  muted: "#8B7355",
  sansHead: "'Inter', system-ui, sans-serif",
};

const STORAGE_KEY = "pacc_portal_welcome_seen_v1";

const steps = [
  {
    icon: LayoutDashboard,
    title: "Welcome to your fuel dashboard",
    body:
      "Everything PACC Energy delivers to your sites lives here — updated automatically. No spreadsheets, no waiting for invoices to know what landed where.",
  },
  {
    icon: Truck,
    title: "01 · Overview & Deliveries",
    body:
      "The Overview gives you headline numbers (litres, spend, deliveries this period). Deliveries shows every drop in real time — click any row to download a branded PDF docket.",
  },
  {
    icon: Layers,
    title: "03 · Projects",
    body:
      "See fuel costs broken out per site or job. Perfect for site managers running multiple projects who need to bill fuel back to the right cost code.",
  },
  {
    icon: Wrench,
    title: "04 · Plant",
    body:
      "Fuel rolled up by machine (excavator, loader, genset). Spot a thirsty machine early. Your driver tags each drop on-site — you don't have to do anything.",
  },
  {
    icon: Leaf,
    title: "05 · Emissions & Exports",
    body:
      "Auto-calculated Scope 1 CO₂e for ESG reporting, plus CSV exports of any view for your accounts team. That's it — explore at your own pace.",
  },
];

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) {
      // small delay so the portal renders behind it first
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  const s = steps[step];
  const Icon = s.icon;
  const isLast = step === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(61,43,26,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          maxWidth: 480,
          width: "100%",
          padding: 28,
          position: "relative",
          boxShadow: "0 30px 80px rgba(61,43,26,0.18)",
        }}
      >
        <button
          onClick={close}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "transparent",
            border: "none",
            color: T.muted,
            cursor: "pointer",
            padding: 6,
            borderRadius: 6,
          }}
        >
          <X size={16} />
        </button>

        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: "rgba(232,70,30,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <Icon size={22} color={T.accent} />
        </div>

        <h2
          id="welcome-title"
          style={{
            fontSize: 18,
            fontFamily: T.sansHead,
            fontWeight: 700,
            color: T.text,
            margin: 0,
            marginBottom: 10,
            letterSpacing: "-0.01em",
          }}
        >
          {s.title}
        </h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: T.textSecondary, margin: 0 }}>{s.body}</p>

        {/* progress dots */}
        <div style={{ display: "flex", gap: 6, marginTop: 22 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 22 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step ? T.accent : T.border,
                transition: "all 0.2s",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 }}>
          <button
            onClick={close}
            style={{
              background: "transparent",
              border: "none",
              color: T.muted,
              fontSize: 12,
              fontFamily: T.sansHead,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              padding: "8px 4px",
            }}
          >
            Skip tour
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                style={{
                  background: "transparent",
                  border: `1px solid ${T.border}`,
                  color: T.text,
                  fontSize: 12,
                  fontFamily: T.sansHead,
                  fontWeight: 600,
                  padding: "9px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}
            <button
              onClick={() => (isLast ? close() : setStep((s) => s + 1))}
              style={{
                background: T.accent,
                border: "none",
                color: "#fff",
                fontSize: 12,
                fontFamily: T.sansHead,
                fontWeight: 700,
                padding: "9px 16px",
                borderRadius: 6,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                letterSpacing: "0.04em",
              }}
            >
              {isLast ? "Got it" : "Next"} {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}