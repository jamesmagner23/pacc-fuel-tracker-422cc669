import { useDateRange } from "@/hooks/useDateRange";
import { DateRange } from "@/hooks/useTransactions";

const options: { value: DateRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

export function DateRangeToggle() {
  const { range, setRange } = useDateRange();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        minWidth: 0,
        maxWidth: "100%",
        background: "var(--surface)",
        border: "1px solid var(--surface-border)",
        borderRadius: 20,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const isActive = range === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setRange(opt.value)}
            style={{
              padding: "4px 12px",
              borderRadius: 16,
              fontSize: 12,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? "var(--primary-foreground)" : "var(--text-secondary)",
              background: isActive ? "var(--accent)" : "transparent",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            flex: "0 0 auto",
            textAlign: "center",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
