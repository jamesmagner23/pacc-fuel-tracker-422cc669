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
        background: "var(--muted)",
        border: "1px solid var(--border)",
        borderRadius: 9999,
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
              padding: "6px 14px",
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
              background: isActive ? "var(--primary)" : "transparent",
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
