import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Fuel, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function PortalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Auth state change will handle role routing
    navigate("/portal");
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setResetSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Fuel className="w-7 h-7 text-primary" />
            <span className="font-bold text-2xl tracking-tight">PACC Fuel</span>
          </div>
          <p className="text-sm text-muted-foreground">Client Portal</p>
        </div>

        <div className="glass-card p-6">
          {forgotMode ? (
            resetSent ? (
              <div className="text-center space-y-3">
                <p className="text-sm text-foreground">Password reset email sent to <strong>{email}</strong>.</p>
                <p className="text-xs text-muted-foreground">Check your inbox and follow the link to reset your password.</p>
                <button onClick={() => { setForgotMode(false); setResetSent(false); }} className="text-xs text-primary hover:underline">
                  Back to login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <h2 className="text-sm font-semibold text-center">Reset Password</h2>
                <p className="text-xs text-muted-foreground text-center">Enter your email and we'll send you a reset link.</p>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Reset Link
                </button>
                <button type="button" onClick={() => setForgotMode(false)} className="w-full text-xs text-muted-foreground hover:text-foreground">
                  Back to login
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In
              </button>
              <button type="button" onClick={() => setForgotMode(true)} className="w-full text-xs text-muted-foreground hover:text-foreground">
                Forgot password?
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-6">Powered by PACC Fuel</p>
      </div>
    </div>
  );
}
