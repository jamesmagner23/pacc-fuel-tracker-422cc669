import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Loader2 } from "lucide-react";

interface DemoGateProps {
  brand: string | null;
  color: string | null;
  onUnlock: () => void;
}

export function DemoGate({ brand, color, onUnlock }: DemoGateProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isValid = fullName.trim() && email.trim() && companyName.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setSubmitting(true);
    setError("");

    const { error: insertError } = await supabase.from("demo_leads").insert({
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      company_name: companyName.trim(),
      brand_param: brand,
      color_param: color,
    });

    if (insertError) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    sessionStorage.setItem("demo_unlocked", "true");
    onUnlock();
  };

  const displayBrand = brand || "FuelTrack";
  const ACCENT = "#C8F26A"; // neutral blue

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#1a1f2e" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 space-y-6"
        style={{
          background: "rgba(35,40,56,0.7)",
          border: "1px solid rgba(61,68,89,0.6)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="text-center space-y-2">
          <div style={{ fontSize: 22, fontWeight: 800, color: "#e8eaf0", letterSpacing: "-0.02em", textTransform: "uppercase" }}>
            {displayBrand}
          </div>
          <h1
            className="text-xl font-bold mt-4"
            style={{ color: "#e8eaf0" }}
          >
            Try the Demo
          </h1>
          <p className="text-sm" style={{ color: "#9ca3b8" }}>
            Enter your details to explore the full platform with sample data.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Full Name", value: fullName, set: setFullName, type: "text", placeholder: "Jane Smith", required: true },
            { label: "Email", value: email, set: setEmail, type: "email", placeholder: "jane@company.com", required: true },
            { label: "Phone", value: phone, set: setPhone, type: "tel", placeholder: "04XX XXX XXX", required: false },
            { label: "Company", value: companyName, set: setCompanyName, type: "text", placeholder: "Acme Logistics", required: true },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#9ca3b8" }}>
                {f.label} {f.required && <span style={{ color: ACCENT }}>*</span>}
              </label>
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.placeholder}
                required={f.required}
                maxLength={f.type === "email" ? 255 : 100}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
                style={{
                  background: "rgba(26,31,46,0.8)",
                  border: "1px solid rgba(61,68,89,0.5)",
                  color: "#e8eaf0",
                }}
              />
            </div>
          ))}

          {error && (
            <p className="text-xs text-center" style={{ color: "#FF6B5E" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!isValid || submitting}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: ACCENT, color: "#fff" }}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Launch Demo <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p
          className="text-[10px] text-center"
          style={{ color: "rgba(156,163,184,0.5)" }}
        >
          Your details are stored securely and used only for follow-up.
        </p>
      </div>
    </div>
  );
}
