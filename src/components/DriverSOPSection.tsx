import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, BookOpen, MapPin, Phone, Calendar, Search } from "lucide-react";
import { useDemo } from "@/hooks/useDemo";
import { SOP_SECTIONS, CLIENT_SITES, type SOPSection, type ClientSite } from "@/data/sopData";

interface DBSection {
  id: string;
  title: string;
  display_order: number;
  subsections: { title: string; content: string[] }[];
}

interface DBSite {
  id: string;
  client: string;
  site: string;
  address: string;
  contact: string;
  phone: string;
  preferred_days: string;
  codes: { code: string; description: string }[];
  notes: string[];
}

function useSopData() {
  const isDemo = useDemo();

  const sections = useQuery({
    queryKey: ["driver-sop-sections", isDemo],
    queryFn: async () => {
      if (isDemo) {
        return SOP_SECTIONS.map((s, i) => ({ ...s, display_order: i } as unknown as DBSection));
      }
      const { data, error } = await supabase
        .from("sop_sections")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data || []) as unknown as DBSection[];
    },
  });

  const sites = useQuery({
    queryKey: ["driver-sop-sites", isDemo],
    queryFn: async () => {
      if (isDemo) {
        return CLIENT_SITES.map((s, i) => ({ ...s, id: `demo-${i}`, preferred_days: s.preferredDays } as unknown as DBSite));
      }
      const { data, error } = await supabase
        .from("sop_client_sites")
        .select("*")
        .order("client");
      if (error) throw error;
      return (data || []) as unknown as DBSite[];
    },
  });

  return { sections, sites };
}

function SectionCard({ section }: { section: DBSection }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card" style={{ padding: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 text-left transition-colors hover:bg-surface-hover"
        style={{ minHeight: 52, background: "none", border: "none", cursor: "pointer", color: "var(--text-primary, #f0ebe4)" }}
      >
        {open ? <ChevronDown className="w-4 h-4 shrink-0 text-accent" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
        <span className="text-sm font-medium flex-1">{section.title}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-surface-border">
          {section.subsections.map((sub, i) => (
            <div key={i} className="mt-3 first:mt-0">
              <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--accent, #f04a1a)" }}>
                {sub.title}
              </div>
              {sub.content.map((line, j) => (
                <p key={j} className="text-xs leading-relaxed mb-1 last:mb-0" style={{ color: "var(--text-secondary, #C4A882)" }}>
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientSiteCard({ site }: { site: DBSite }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card" style={{ padding: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 text-left transition-colors hover:bg-surface-hover"
        style={{ minHeight: 52, background: "none", border: "none", cursor: "pointer", color: "var(--text-primary, #f0ebe4)" }}
      >
        {open ? <ChevronDown className="w-4 h-4 shrink-0 text-accent" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium block truncate">{site.client}</span>
          <span className="text-[11px] block truncate" style={{ color: "var(--text-muted, #8B7355)" }}>{site.site}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-surface-border">
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{site.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{site.contact} — {site.phone}</span>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{site.preferred_days}</span>
            </div>
          </div>

          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>
            Fuel System Codes
          </div>
          <div className="rounded-lg overflow-hidden border border-surface-border">
            {site.codes.map((c, i) => (
              <div
                key={c.code}
                className="flex items-center justify-between px-3 py-2"
                style={{ borderBottom: i < site.codes.length - 1 ? "1px solid var(--surface-border)" : "none" }}
              >
                <code className="text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>{c.code}</code>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{c.description}</span>
              </div>
            ))}
          </div>

          {site.notes.length > 0 && (
            <div className="mt-3 p-2.5 rounded-lg" style={{ background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.2)" }}>
              {site.notes.map((note, i) => (
                <p key={i} className="text-[11px] mb-1 last:mb-0" style={{ color: "#D97706" }}>⚠ {note}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DriverSOPSection() {
  const [activeView, setActiveView] = useState<"procedures" | "sites">("procedures");
  const [search, setSearch] = useState("");
  const { sections, sites } = useSopData();

  const allSections = sections.data || [];
  const allSites = sites.data || [];

  const filteredSections = search
    ? allSections.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.subsections.some(
            (sub) =>
              sub.title.toLowerCase().includes(search.toLowerCase()) ||
              sub.content.some((c) => c.toLowerCase().includes(search.toLowerCase()))
          )
      )
    : allSections;

  const filteredSites = search
    ? allSites.filter(
        (s) =>
          s.client.toLowerCase().includes(search.toLowerCase()) ||
          s.site.toLowerCase().includes(search.toLowerCase()) ||
          s.codes.some((c) => c.code.toLowerCase().includes(search.toLowerCase()))
      )
    : allSites;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="card p-4 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold text-foreground">Operations Handbook</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search procedures or site codes..."
          className="w-full bg-surface border border-surface-border rounded-lg text-foreground pl-9 pr-3 py-2.5 text-xs outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Toggle */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--surface, #1e1008)", border: "1px solid var(--surface-border)" }}>
        {[
          { key: "procedures" as const, label: "Procedures" },
          { key: "sites" as const, label: "Client Sites" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            className="flex-1 text-xs font-medium py-2.5 rounded-md transition-colors"
            style={{
              background: activeView === tab.key ? "var(--accent, #f04a1a)" : "transparent",
              color: activeView === tab.key ? "#fff" : "var(--text-secondary, #C4A882)",
              border: "none",
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {(sections.isLoading || sites.isLoading) && (
        <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
      )}

      {/* Content */}
      {activeView === "procedures" ? (
        <div className="flex flex-col gap-1">
          {filteredSections.length === 0 && !sections.isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-6">No matching procedures found.</p>
          ) : (
            filteredSections.map((section) => <SectionCard key={section.id} section={section} />)
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {filteredSites.length === 0 && !sites.isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-6">No matching sites found.</p>
          ) : (
            filteredSites.map((site) => <ClientSiteCard key={site.id} site={site} />)
          )}
        </div>
      )}
    </div>
  );
}
