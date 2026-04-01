import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PACCLogo } from "./PACCLogo";
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

    // Persist so they don't see the gate again this session
    sessionStorage.setItem("demo_unlocked", "true");
    onUnlock();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#3D2B1A" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 space-y-6"
        style={{
          background: "rgba(86,64,46,0.5)",
          border: "1px solid rgba(107,82,64,0.6)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="text-center space-y-2">
          <PACCLogo size="lg" />
          <h1
            className="text-xl font-bold mt-4"
            style={{ color: "#F5E6D0" }}
          >
            {brand ? `${brand} Demo` : "Try the Demo"}
          </h1>
          <p className="text-sm" style={{ color: "#C4A882" }}>
            Enter your details to explore the full platform with sample data.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "#C4A882" }}
            >
              Full Name <span style={{ color: "#E8461E" }}>*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              required
              maxLength={100}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: "rgba(61,43,26,0.8)",
                border: "1px solid rgba(107,82,64,0.5)",
                color: "#F5E6D0",
              }}
            />
          </div>

          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "#C4A882" }}
            >
              Email <span style={{ color: "#E8461E" }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              required
              maxLength={255}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: "rgba(61,43,26,0.8)",
                border: "1px solid rgba(107,82,64,0.5)",
                color: "#F5E6D0",
              }}
            />
          </div>

          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "#C4A882" }}
            >
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="04XX XXX XXX"
              maxLength={20}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: "rgba(61,43,26,0.8)",
                border: "1px solid rgba(107,82,64,0.5)",
                color: "#F5E6D0",
              }}
            />
          </div>

          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "#C4A882" }}
            >
              Company <span style={{ color: "#E8461E" }}>*</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Logistics"
              required
              maxLength={100}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: "rgba(61,43,26,0.8)",
                border: "1px solid rgba(107,82,64,0.5)",
                color: "#F5E6D0",
              }}
            />
          </div>

          {error && (
            <p className="text-xs text-center" style={{ color: "#E8461E" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!isValid || submitting}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              background: "#E8461E",
              color: "#fff",
            }}
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
          style={{ color: "rgba(196,168,130,0.5)" }}
        >
          Your details are stored securely and used only for follow-up.
        </p>
      </div>
    </div>
  );
}
