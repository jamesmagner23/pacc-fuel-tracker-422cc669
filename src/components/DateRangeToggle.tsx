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
        background: "#141414",
        border: "1px solid #1f1f1f",
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
              color: isActive ? "#ffffff" : "#555555",
              background: isActive ? "#7C3AED" : "transparent",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.color = "#888888";
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.color = "#555555";
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
