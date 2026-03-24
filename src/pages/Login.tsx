import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PACCLogo } from "@/components/PACCLogo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-[380px] flex flex-col gap-6"
      >
        <div className="text-center mb-2">
          <div className="flex justify-center mb-5">
            <PACCLogo />
          </div>
          <h1 className="text-xl font-semibold text-foreground m-0">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Enter your email and password to continue
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {error && (
          <div className="bg-negative/10 border border-negative/30 rounded-lg px-3.5 py-2.5 text-xs text-negative">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-primary-foreground border-none rounded-lg py-2.5 text-md font-semibold cursor-pointer hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70 transition-colors"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-xs text-muted-foreground text-center m-0">
          Need access? Contact PACC Energy
        </p>
      </form>
    </div>
  );
}
