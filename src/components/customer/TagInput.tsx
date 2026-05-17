import { useMemo, useRef, useState, useEffect, KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  /** Tag names that already exist on other items — used for typeahead. */
  suggestions?: string[];
  placeholder?: string;
  /** Optional max number of tags. */
  max?: number;
}

/**
 * Free-form tag input with chip rendering, comma/Enter to commit,
 * Backspace to remove the last chip, and a typeahead from existing tags.
 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Type a tag and press Enter…",
  max = 20,
}: Props) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filteredSuggestions = useMemo(() => {
    const lower = draft.trim().toLowerCase();
    const taken = new Set(value.map((v) => v.toLowerCase()));
    return suggestions
      .filter((s) => !taken.has(s.toLowerCase()))
      .filter((s) => (lower ? s.toLowerCase().includes(lower) : true))
      .slice(0, 8);
  }, [draft, suggestions, value]);

  const add = (raw: string) => {
    const t = raw.trim().replace(/,+$/g, "").trim();
    if (!t) return;
    if (t.length > 40) return;
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) {
      setDraft("");
      return;
    }
    if (value.length >= max) return;
    onChange([...value, t]);
    setDraft("");
  };

  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      remove(value.length - 1);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 min-h-10 focus-within:ring-1 focus-within:ring-primary">
        {value.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="inline-flex items-center gap-1 rounded bg-primary/20 text-foreground border border-primary/40 text-xs font-medium px-2 py-0.5"
          >
            {t}
            <button
              type="button"
              onClick={() => remove(i)}
              className="hover:text-primary/70"
              aria-label={`Remove tag ${t}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          onBlur={() => {
            // Commit pending text on blur
            if (draft.trim()) add(draft);
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {open && (filteredSuggestions.length > 0 || draft.trim()) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(s);
              }}
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
            >
              {s}
            </button>
          ))}
          {draft.trim() &&
            !filteredSuggestions.some(
              (s) => s.toLowerCase() === draft.trim().toLowerCase()
            ) && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(draft);
                }}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-accent text-primary border-t border-border"
              >
                <Plus className="w-3 h-3" /> Create "{draft.trim()}"
              </button>
            )}
        </div>
      )}
    </div>
  );
}
