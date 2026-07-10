import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function DriverGuardrailBanner({
  breaches,
  visible = true,
}: {
  breaches: string[];
  visible?: boolean;
}) {
  if (!visible) return null;
  const ok = breaches.length === 0;
  return (
    <div
      className={`rounded-lg border p-3 text-xs flex gap-2 ${
        ok
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          : "border-amber-500/50 bg-amber-500/10 text-amber-100"
      }`}
    >
      {ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
      <div className="flex-1">
        <div className="font-semibold mb-0.5">
          {ok ? "Within driver pricing rules" : "Outside driver pricing rules — admin approval required"}
        </div>
        {ok ? (
          <div className="opacity-80">Volume ≥ 2,000 L · Terms ≤ 14 days · Margin ≥ 20%.</div>
        ) : (
          <ul className="list-disc list-inside space-y-0.5">
            {breaches.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}