import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/hooks/useActivityLog";
import { ArrowLeft } from "lucide-react";

function PACCHeaderLogo() {
  return (
    <div className="flex items-center gap-2.5" style={{ lineHeight: 1 }}>
      <svg width={26} height={32} viewBox="0 0 100 120" aria-hidden="true" className="shrink-0">
        {[
          [1,1,1,1,0],
          [1,0,0,0,1],
          [1,0,0,0,1],
          [1,1,1,1,0],
          [1,0,0,0,0],
          [1,0,0,0,0],
        ].flatMap((row, y) => row.map((on, x) => on ? (
          <circle key={`${x}-${y}`} cx={x*20+10} cy={y*20+10} r={7.5} fill="var(--accent)" />
        ) : null))}
      </svg>
      <div
        style={{
          fontFamily: "'Archivo Narrow', 'Archivo', 'Inter', sans-serif",
          fontSize: 18,
          fontWeight: 800,
          color: "var(--foreground)",
          letterSpacing: "0.01em",
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        PACC ENERGY
      </div>
    </div>
  );
}

function AppHeader({ onBack }: { onBack?: () => void }) {
  return (
    <header className="sticky top-0 z-20 h-16 shrink-0 border-b border-border bg-background px-4">
      <div className="mx-auto flex h-full max-w-[430px] items-center justify-between">
        <PACCHeaderLogo />
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to sign in"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground active:scale-[0.96]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </header>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Incorrect email or password. Please try again.");
      setLoading(false);
      return;
    }

    try {
      await logActivity("login", { method: "password" });
    } catch (_) {
      // Non-critical, don't block login
    }

    let destination = "/";
    const userId = data.user?.id ?? data.session?.user.id;

    if (userId) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (roleData?.role === "client") destination = "/portal";
      if (roleData?.role === "driver") destination = "/driver";
    }

    navigate(destination, { replace: true });
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

  if (forgotMode) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader onBack={() => { setForgotMode(false); setResetSent(false); setError(""); }} />
        <main className="flex-1 px-4 pt-8">
          <form onSubmit={handleForgotPassword} className="mx-auto w-full max-w-[380px] flex flex-col gap-6">
            <div className="mb-1">
              <h1 className="text-2xl font-semibold text-foreground m-0">Reset password</h1>
              <p className="text-sm text-muted-foreground mt-2">
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

                <button type="submit" disabled={loading} className="bg-primary text-primary-foreground border-none rounded-lg py-3 text-md font-semibold cursor-pointer hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70 transition-colors">
                  {loading ? "Sending…" : "Send Reset Link"}
                </button>
              </>
            )}

            <button type="button" onClick={() => { setForgotMode(false); setResetSent(false); setError(""); }} className="bg-transparent border-none text-primary text-sm cursor-pointer">
              Back to sign in
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="flex-1 px-4 pt-8">
        <form onSubmit={handleLogin} className="mx-auto w-full max-w-[380px] flex flex-col gap-6">
          <div className="mb-1">
            <h1 className="text-2xl font-semibold text-foreground m-0">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-2">Enter your email and password to continue</p>
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

        <button type="submit" disabled={loading} className="bg-primary text-primary-foreground border-none rounded-lg py-3 text-md font-semibold cursor-pointer hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70 transition-colors">
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-xs text-muted-foreground text-center m-0">Need access? Contact PACC Energy</p>
        </form>
      </main>
    </div>
  );
}