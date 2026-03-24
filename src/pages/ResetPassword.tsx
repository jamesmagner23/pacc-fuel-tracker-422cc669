import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PACCLogo } from "@/components/PACCLogo";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated successfully. Redirecting…");
    setTimeout(() => { window.location.href = "/"; }, 2000);
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-5">
        <div className="w-full max-w-[380px] text-center">
          <div className="flex justify-center mb-5"><PACCLogo /></div>
          <p className="text-sm text-muted-foreground">Invalid or expired reset link. Please request a new one from the login page.</p>
          <a href="/login" className="text-primary text-sm mt-4 inline-block">Back to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <form onSubmit={handleReset} className="w-full max-w-[380px] flex flex-col gap-6">
        <div className="text-center mb-2">
          <div className="flex justify-center mb-5"><PACCLogo /></div>
          <h1 className="text-xl font-semibold text-foreground m-0">Set new password</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Enter your new password below</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">New Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Confirm Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors" />
          </div>
        </div>

        {error && <div className="bg-negative/10 border border-negative/30 rounded-lg px-3.5 py-2.5 text-xs text-negative">{error}</div>}
        {message && <div className="bg-positive/10 border border-positive/30 rounded-lg px-3.5 py-2.5 text-xs text-positive">{message}</div>}

        <button type="submit" disabled={loading} className="bg-primary text-primary-foreground border-none rounded-lg py-2.5 text-md font-semibold cursor-pointer hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70 transition-colors">
          {loading ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}
