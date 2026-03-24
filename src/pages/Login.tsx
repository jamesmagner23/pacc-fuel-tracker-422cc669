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
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <PACCLogo />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#ffffff", margin: 0 }}>Sign in</h1>
          <p style={{ fontSize: 13, color: "#555555", margin: "6px 0 0" }}>
            Enter your email and password to continue
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#888888" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              style={{
                background: "#111111",
                border: "1px solid #1f1f1f",
                borderRadius: 8,
                color: "#ffffff",
                padding: "10px 12px",
                fontSize: 13,
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7C3AED")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1f1f1f")}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#888888" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                background: "#111111",
                border: "1px solid #1f1f1f",
                borderRadius: 8,
                color: "#ffffff",
                padding: "10px 12px",
                fontSize: 13,
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7C3AED")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1f1f1f")}
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#7C3AED",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "11px 0",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.background = "#6D28D9";
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.background = "#7C3AED";
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p style={{ fontSize: 11, color: "#333333", textAlign: "center", margin: 0 }}>
          Need access? Contact PACC Energy
        </p>
      </form>
    </div>
  );
}
