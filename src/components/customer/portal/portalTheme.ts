import type React from "react";

// Shared brown/cream PACC portal theme tokens
export const T = {
  bg: "#3D2B1A",
  surface: "#4A3525",
  surfaceRaised: "#56402E",
  border: "#6B5240",
  borderSubtle: "#56402E",
  accent: "#E8461E",
  accentHover: "#D13A14",
  text: "#F5E6D0",
  textSecondary: "#C4A882",
  muted: "#8B7355",
  sansHead: "'Inter', system-ui, sans-serif",
  sansBody: "'Inter', system-ui, sans-serif",
  badgePending: "#8B7355",
  badgeConfirmed: "#E8461E",
  badgeCompleted: "#10B981",
  positive: "#10B981",
  warning: "#F59E0B",
} as const;

export const card: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: "16px 18px",
};

export const inputStyle: React.CSSProperties = {
  background: T.bg,
  border: `1px solid ${T.border}`,
  color: T.text,
  padding: "10px 12px",
  fontSize: 13,
  fontFamily: T.sansBody,
  borderRadius: 4,
  outline: "none",
  width: "100%",
};

export const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: T.sansHead,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: T.muted,
  display: "block",
  marginBottom: 6,
};

export const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontFamily: T.sansHead,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: T.text,
  margin: 0,
};

export const muted = (s: number = 12): React.CSSProperties => ({
  fontSize: s,
  color: T.muted,
  fontFamily: T.sansBody,
});

export const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${T.border}`,
  color: T.muted,
  padding: "9px 16px",
  fontSize: 12,
  fontFamily: T.sansHead,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  borderRadius: 4,
  cursor: "pointer",
  fontWeight: 500,
  transition: "all 0.15s",
};

export const fmtL = (n: number) => `${Math.round(n).toLocaleString()}L`;
export const fmtNum = (n: number, dp = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export function startOfFY(d: Date) {
  const y = d.getFullYear();
  return d.getMonth() >= 6 ? new Date(y, 6, 1) : new Date(y - 1, 6, 1);
}

export function fyLabel(d: Date) {
  const s = startOfFY(d);
  const a = s.getFullYear();
  return `FY${String(a).slice(-2)}/${String(a + 1).slice(-2)}`;
}

export function downloadCSV(rows: (string | number)[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
