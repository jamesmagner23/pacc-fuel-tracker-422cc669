import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@/components/ui/command";

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
}

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const mac = isMac();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-full bg-muted border border-transparent hover:border-border transition-colors text-muted-foreground"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="text-[13px] font-medium">Search</span>
        <span className="inline-flex items-center justify-center bg-card border border-border rounded px-1.5 text-[11px] font-medium text-muted-foreground">
          {mac ? "⌘K" : "Ctrl K"}
        </span>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search customers, sites, deliveries…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
        </CommandList>
      </CommandDialog>
    </>
  );
}