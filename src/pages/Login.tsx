import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/hooks/useActivityLog";
import { Droplets, Truck, Shield } from "lucide-react";

function PACCLogoLarge() {
  return (
    <div style={{ lineHeight: 1 }}>
      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          color: "#F5E6D0",
          letterSpacing: "-0.03em",
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        PACC<span style={{ color: "#E8461E", fontSize: 28 }}>®</span>
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "#C4A882",
          letterSpacing: "0.2em",
          marginTop: 4,
          textTransform: "uppercase",
        }}
      >
        ENERGY
      </div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showForm, setShowForm] = useState(true);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Incorrect email or password. Please try again.");
      setLoading(false);
      return;
    }

    await logActivity("login", { method: "password" });
    window.location.href = "/";
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError("Enter your email address"); return; }
    setLoading(true);
    setError("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setResetSent(true);
    setLoading(false);
  };

  // Welcome / landing screen
  if (!showForm && !forgotMode) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Hero section */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          {/* Animated glow behind logo */}
          <div
            className="relative mb-8"
            style={{
              filter: "drop-shadow(0 0 60px rgba(232,70,30,0.15))",
            }}
          >
            <PACCLogoLarge />
          </div>

          <h1
            className="text-foreground font-light tracking-tight m-0 leading-tight"
            style={{ fontSize: "clamp(22px, 5vw, 32px)" }}
          >
            Fuel Delivery<br />
            <span className="font-semibold">Management Portal</span>
          </h1>

          <p className="text-muted-foreground text-sm mt-3 max-w-[320px] leading-relaxed m-0">
            Real-time tracking, delivery insights and account management for PACC Energy customers and team.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {[
              { icon: <Droplets className="w-3.5 h-3.5" />, label: "Live Volume Tracking" },
              { icon: <Truck className="w-3.5 h-3.5" />, label: "Delivery Management" },
              { icon: <Shield className="w-3.5 h-3.5" />, label: "Secure Portal Access" },
            ].map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium"
                style={{
                  background: "rgba(232,70,30,0.08)",
                  border: "1px solid rgba(232,70,30,0.15)",
                  color: "#D4C4A8",
                }}
              >
                <span style={{ color: "#E8461E" }}>{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={() => setShowForm(true)}
            className="mt-10 w-full max-w-[320px] py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all"
            style={{
              background: "#E8461E",
              color: "#F5E6D0",
              border: "none",
              boxShadow: "0 8px 32px rgba(232,70,30,0.3)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(232,70,30,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(232,70,30,0.3)"; }}
          >
            Sign In
          </button>

          <p className="text-[11px] text-muted-foreground mt-3 m-0">
            Admin · Driver · Customer portals
          </p>
        </div>

        {/* Footer */}
        <div className="py-5 text-center">
          <p className="text-[10px] text-muted-foreground m-0 tracking-wider uppercase">
            PACC Energy Pty Ltd · Melbourne, Victoria
          </p>
        </div>
      </div>
    );
  }

  if (forgotMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-5">
        <form onSubmit={handleForgotPassword} className="w-full max-w-[380px] flex flex-col gap-6">
          <div className="text-center mb-2">
            <div className="flex justify-center mb-5"><PACCLogoLarge /></div>
            <h1 className="text-xl font-semibold text-foreground m-0">Reset password</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {resetSent ? "Check your inbox for a reset link" : "Enter your email to receive a reset link"}
            </p>
          </div>

          {!resetSent && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors" />
              </div>

              {error && <div className="bg-negative/10 border border-negative/30 rounded-lg px-3.5 py-2.5 text-xs text-negative">{error}</div>}

              <button type="submit" disabled={loading} className="bg-primary text-primary-foreground border-none rounded-lg py-2.5 text-md font-semibold cursor-pointer hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70 transition-colors">
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </>
          )}

          <button type="button" onClick={() => { setForgotMode(false); setResetSent(false); setError(""); }} className="bg-transparent border-none text-primary text-sm cursor-pointer">
            ← Back to sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <form onSubmit={handleLogin} className="w-full max-w-[380px] flex flex-col gap-6">
        <div className="text-center mb-2">
          <div className="flex justify-center mb-5"><PACCLogoLarge /></div>
          <h1 className="text-xl font-semibold text-foreground m-0">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Enter your email and password to continue</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs text-muted-foreground">Password</label>
              <button type="button" onClick={() => { setForgotMode(true); setError(""); }} className="bg-transparent border-none text-xs text-primary cursor-pointer p-0">Forgot password?</button>
            </div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors" />
          </div>
        </div>

        {error && <div className="bg-negative/10 border border-negative/30 rounded-lg px-3.5 py-2.5 text-xs text-negative">{error}</div>}

        <button type="submit" disabled={loading} className="bg-primary text-primary-foreground border-none rounded-lg py-2.5 text-md font-semibold cursor-pointer hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70 transition-colors">
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <button type="button" onClick={() => setShowForm(false)} className="bg-transparent border-none text-muted-foreground text-xs cursor-pointer">
          ← Back
        </button>

        <p className="text-xs text-muted-foreground text-center m-0">Need access? Contact PACC Energy</p>
      </form>
    </div>
  );
}