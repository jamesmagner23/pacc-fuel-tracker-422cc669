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
        background: "#1A1009",
        border: "1px solid #2E1C0C",
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
              color: isActive ? "#ffffff" : "#4A3520",
              background: isActive ? "#FF4D1C" : "transparent",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.color = "#8B7355";
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.color = "#4A3520";
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
