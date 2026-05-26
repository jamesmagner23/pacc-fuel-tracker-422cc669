import { useEffect, useState } from "react";
import { ChevronDown, LogOut, Settings, FlaskConical, BookOpen } from "lucide-react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initialsFor(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase() || (email?.[0] || "?").toUpperCase();
  }
  return (email?.[0] || "?").toUpperCase();
}

export function UserMenu() {
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const isDemo = params.get("demo") === "true";

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const meta = (data.user?.user_metadata || {}) as any;
      const displayName =
        meta.full_name || meta.name || meta.first_name
          ? `${meta.first_name || ""} ${meta.last_name || ""}`.trim() || meta.full_name || meta.name
          : null;
      setName(displayName || null);
      setEmail(data.user?.email || null);
    });
    return () => { cancelled = true; };
  }, []);

  const initials = initialsFor(name, email);
  const display = (name || email || "Account").slice(0, 18);

  const handleSignOut = async () => {
    sessionStorage.removeItem("demo_unlocked");
    await supabase.auth.signOut();
    window.location.href = isDemo ? "/landing" : "/login";
  };

  const toggleDemo = () => {
    const next = new URLSearchParams(params);
    if (isDemo) next.delete("demo");
    else next.set("demo", "true");
    const q = next.toString();
    navigate(`${location.pathname}${q ? `?${q}` : ""}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 h-9 px-1 md:px-3 rounded-full border border-border bg-card hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className="inline-flex w-6 h-6 items-center justify-center rounded-full text-[11px] font-bold"
            style={{ background: "#142A16", color: "#C8F26A" }}
          >
            {initials}
          </span>
          <span className="hidden md:inline text-[13px] font-semibold text-foreground truncate max-w-[140px]">
            {display}
          </span>
          <ChevronDown className="hidden md:inline w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => navigate("/admin")}>
          <Settings className="w-4 h-4 mr-2" /> Profile settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleDemo}>
          <FlaskConical className="w-4 h-4 mr-2" />
          {isDemo ? "Exit demo data" : "Switch to demo data"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open("https://paccenergy.com", "_blank", "noopener")}
        >
          <BookOpen className="w-4 h-4 mr-2" /> Help / docs
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}