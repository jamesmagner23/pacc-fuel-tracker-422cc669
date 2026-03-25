import { useState } from "react";
import { format } from "date-fns";
import { Check, Gauge } from "lucide-react";
import { toast } from "sonner";
import { useSubmitPumpReading, useDriverPumpReadings } from "@/hooks/useReconciliation";

export function PumpReadingForm() {
  const [litres, setLitres] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const submitMutation = useSubmitPumpReading();
  const { data: recentReadings = [] } = useDriverPumpReadings(7);

  const handleSubmit = () => {
    if (!litres) return;
    submitMutation.mutate(
      { litres: parseFloat(litres), reading_date: date, notes: notes || undefined },
      {
        onSuccess: () => {
          toast.success(`Pump reading logged for ${date}`);
          setLitres("");
          setNotes("");
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-4 h-4 text-accent" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Pump #17 Reading
        </span>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Pump #17 Litres</label>
          <input
            type="number"
            step="0.01"
            value={litres}
            onChange={(e) => setLitres(e.target.value)}
            placeholder="e.g. 4500.00"
            className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Spillage at site, pump calibration issue"
            className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!litres || submitMutation.isPending}
        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4" />
        {submitMutation.isPending ? "Submitting…" : "Log Pump Reading"}
      </button>

      {recentReadings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-surface-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Last 7 Days</p>
          {recentReadings.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
              <div>
                <span className="text-sm font-semibold text-foreground">
                  {Number(r.litres).toLocaleString()}L
                </span>
                {r.notes && (
                  <span className="text-xs text-muted-foreground ml-2">{r.notes}</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{r.reading_date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
