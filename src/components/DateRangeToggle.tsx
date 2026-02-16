import { useDateRange } from "@/hooks/useDateRange";
import { DateRange } from "@/data/mockData";

const options: { label: string; value: DateRange }[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

export function DateRangeToggle() {
  const { range, setRange } = useDateRange();

  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setRange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            range === opt.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
