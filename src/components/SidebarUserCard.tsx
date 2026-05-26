import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useDemoContext } from "@/hooks/useDemo";

function initialsFor(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase() || (email?.[0] || "?").toUpperCase();
  }
  return (email?.[0] || "?").toUpperCase();
}

function prettyRole(role: string | null | undefined): string {
  if (!role) return "Admin";
  if (role === "admin") return "Admin";
  if (role === "operations") return "Ops";
  if (role === "driver") return "Driver";
  if (role === "client") return "Client";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function SidebarUserCard() {
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const { data: role } = useUserRole();
  const { isDemo } = useDemoContext();

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
  const display = name || email?.split("@")[0] || "Account";

  const handleSignOut = async () => {
    sessionStorage.removeItem("demo_unlocked");
    await supabase.auth.signOut();
    window.location.href = isDemo ? "/landing" : "/login";
  };

  return (
    <div className="flex items-center gap-2.5 px-3 py-3">
      <span
        className="inline-flex w-9 h-9 items-center justify-center rounded-full text-[13px] font-bold shrink-0"
        style={{ background: "#142A16", color: "var(--accent)" }}
      >
        {initials}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-foreground truncate">{display}</div>
        <div className="text-[11px] font-medium text-muted-foreground truncate">{prettyRole(role)}</div>
      </div>
      <button
        type="button"
        aria-label="Sign out"
        onClick={handleSignOut}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}