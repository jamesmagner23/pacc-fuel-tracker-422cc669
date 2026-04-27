import { useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { AlertTriangle, Plus, Trash2, Pencil, X, Check, Clock } from "lucide-react";
import {
  useOperatingExpenses,
  useUpsertExpense,
  useDeleteExpense,
  dailyRateFor,
  FREQUENCY_LABEL,
  type OperatingExpense,
  type ExpenseFrequency,
} from "@/hooks/useOperatingExpenses";

const CATEGORIES = ["Wages", "Fleet", "Fuel", "Repayments", "Tolls", "Insurance", "Rent", "Utilities", "Other"];
const FREQUENCIES: ExpenseFrequency[] = ["weekly", "fortnightly", "monthly", "quarterly", "annual", "one_off"];

interface Props {
  /** Days in the currently selected EBITDA period — used for period totals only. */
  periodDays: number;
  /** Notify parent of period total so EBITDA can include it. */
  onPeriodTotalChange?: (total: number) => void;
}

interface DraftRow {
  id?: string;
  name: string;
  category: string;
  amount: string;
  frequency: ExpenseFrequency;
  next_due_date: string;
  notes: string;
}

const blankDraft = (): DraftRow => ({
  name: "",
  category: "Other",
  amount: "",
  frequency: "monthly",
  next_due_date: "",
  notes: "",
});

const sanitize = (val: string): number => {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 1_000_000_000);
};

function dueState(dateStr: string | null): { days: number | null; tone: "ok" | "soon" | "urgent" | "overdue" } {
  if (!dateStr) return { days: null, tone: "ok" };
  const days = differenceInCalendarDays(parseISO(dateStr), new Date());
  if (days < 0) return { days, tone: "overdue" };
  if (days <= 7) return { days, tone: "urgent" };
  if (days <= 14) return { days, tone: "soon" };
  return { days, tone: "ok" };
}

const toneStyles: Record<string, string> = {
  ok: "text-muted-foreground",
  soon: "text-amber-400",
  urgent: "text-orange-400",
  overdue: "text-destructive",
};

export default function RecurringExpensesPanel({ periodDays, onPeriodTotalChange }: Props) {
  const { data: expenses = [], isLoading } = useOperatingExpenses();
  const upsert = useUpsertExpense();
  const del = useDeleteExpense();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftRow>(blankDraft());
  const [adding, setAdding] = useState(false);

  const active = useMemo(() => expenses.filter((e) => e.is_active), [expenses]);

  const totals = useMemo(() => {
    const dailyTotal = active.reduce((s, e) => s + dailyRateFor(e), 0);
    const periodTotal = dailyTotal * periodDays;
    const monthlyTotal = dailyTotal * 30.4375;
    const annualTotal = dailyTotal * 365.25;
    return { dailyTotal, periodTotal, monthlyTotal, annualTotal };
  }, [active, periodDays]);

  // Push period total upstream
  useMemo(() => {
    onPeriodTotalChange?.(totals.periodTotal);
  }, [totals.periodTotal, onPeriodTotalChange]);

  const upcoming = useMemo(() => {
    return active
      .map((e) => ({ exp: e, ...dueState(e.next_due_date) }))
      .filter((x) => x.tone === "urgent" || x.tone === "overdue")
      .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
  }, [active]);

  const startEdit = (e: OperatingExpense) => {
    setEditingId(e.id);
    setAdding(false);
    setDraft({
      id: e.id,
      name: e.name,
      category: e.category,
      amount: String(e.amount),
      frequency: e.frequency,
      next_due_date: e.next_due_date ?? "",
      notes: e.notes ?? "",
    });
  };

  const startAdd = () => {
    setAdding(true);
    setEditingId(null);
    setDraft(blankDraft());
  };

  const cancel = () => {
    setEditingId(null);
    setAdding(false);
    setDraft(blankDraft());
  };

  const save = async () => {
    if (!draft.name.trim()) return;
    await upsert.mutateAsync({
      id: draft.id,
      name: draft.name.trim().slice(0, 120),
      category: draft.category,
      amount: sanitize(draft.amount || "0"),
      frequency: draft.frequency,
      next_due_date: draft.next_due_date || null,
      notes: draft.notes.trim().slice(0, 500) || null,
      is_active: true,
    });
    cancel();
  };

  return (
    <div className="bg-surface border border-surface-border rounded-[10px] p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold">Recurring Operating Expenses</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Each item normalized to a daily rate, then applied to your selected EBITDA window.
          </p>
        </div>
        <button
          onClick={startAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Plus className="w-3.5 h-3.5" /> Add expense
        </button>
      </div>

      {/* Urgent banner */}
      {upcoming.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/10">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-xs text-foreground space-y-0.5">
            <div className="font-medium">Renewals needing attention</div>
            <ul className="space-y-0.5">
              {upcoming.map(({ exp, days, tone }) => (
                <li key={exp.id} className={toneStyles[tone]}>
                  • <span className="text-foreground">{exp.name}</span> —{" "}
                  {tone === "overdue"
                    ? `overdue by ${Math.abs(days!)} day${Math.abs(days!) === 1 ? "" : "s"}`
                    : `due in ${days} day${days === 1 ? "" : "s"}`}{" "}
                  {exp.next_due_date && <span className="text-muted-foreground">({format(parseISO(exp.next_due_date), "d MMM")})</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Totals strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[
          { l: "Daily", v: totals.dailyTotal },
          { l: "Monthly", v: totals.monthlyTotal },
          { l: "Annual", v: totals.annualTotal },
          { l: "Selected period", v: totals.periodTotal },
        ].map((t) => (
          <div key={t.l} className="bg-raised border border-surface-border rounded-md px-3 py-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.l}</div>
            <div className="text-sm font-semibold tabular-nums">${Math.round(t.v).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Add row */}
      {adding && <ExpenseEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={upsert.isPending} />}

      {/* List */}
      {isLoading ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Loading expenses…</div>
      ) : active.length === 0 && !adding ? (
        <div className="text-xs text-muted-foreground py-8 text-center border border-dashed border-surface-border rounded-md">
          No recurring expenses yet. Add insurance, repayments, tolls etc. to feed live EBITDA.
        </div>
      ) : (
        <div className="space-y-1.5">
          {active.map((e) => {
            const isEditing = editingId === e.id;
            if (isEditing) {
              return <ExpenseEditor key={e.id} draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={upsert.isPending} />;
            }
            const due = dueState(e.next_due_date);
            const daily = dailyRateFor(e);
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 px-3 py-2 rounded-md border border-surface-border bg-raised hover:border-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium truncate">{e.name}</span>
                    <span className="text-[10px] text-muted-foreground bg-surface px-1.5 py-0.5 rounded">{e.category}</span>
                    <span className="text-[10px] text-muted-foreground">{FREQUENCY_LABEL[e.frequency]}</span>
                    {e.next_due_date && (
                      <span className={`inline-flex items-center gap-1 text-[10px] ${toneStyles[due.tone]}`}>
                        <Clock className="w-3 h-3" />
                        {due.tone === "overdue"
                          ? `Overdue ${Math.abs(due.days!)}d`
                          : due.tone === "urgent"
                          ? `Due ${due.days}d`
                          : due.tone === "soon"
                          ? `Due ${due.days}d`
                          : format(parseISO(e.next_due_date), "d MMM")}
                      </span>
                    )}
                  </div>
                  {e.notes && <div className="text-[10px] text-muted-foreground truncate mt-0.5">{e.notes}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold tabular-nums">${Number(e.amount).toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">${daily.toFixed(2)}/day</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(e)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                    aria-label="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove "${e.name}"?`)) del.mutate(e.id);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExpenseEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  draft: DraftRow;
  setDraft: (d: DraftRow) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="p-3 rounded-md border border-accent/40 bg-raised space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
        <input
          autoFocus
          placeholder="Name (e.g. Truck insurance)"
          value={draft.name}
          maxLength={120}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="sm:col-span-2 bg-surface border border-surface-border rounded-md px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-accent/50"
        />
        <select
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          className="bg-surface border border-surface-border rounded-md px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-accent/50"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            placeholder="0"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            className="w-full bg-surface border border-surface-border rounded-md pl-5 pr-2 py-1.5 text-xs text-foreground tabular-nums text-right outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>
        <select
          value={draft.frequency}
          onChange={(e) => setDraft({ ...draft, frequency: e.target.value as ExpenseFrequency })}
          className="bg-surface border border-surface-border rounded-md px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-accent/50"
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>
          ))}
        </select>
        <input
          type="date"
          value={draft.next_due_date}
          onChange={(e) => setDraft({ ...draft, next_due_date: e.target.value })}
          className="bg-surface border border-surface-border rounded-md px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          placeholder="Notes (optional)"
          value={draft.notes}
          maxLength={500}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          className="flex-1 bg-surface border border-surface-border rounded-md px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-accent/50"
        />
        <button
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-surface-border text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving || !draft.name.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          <Check className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
