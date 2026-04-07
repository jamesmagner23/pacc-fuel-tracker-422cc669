import { useState } from "react";
import { ChevronDown, ChevronRight, BookOpen, MapPin, Phone, Calendar, Search } from "lucide-react";
import { SOP_SECTIONS, CLIENT_SITES, type SOPSection, type ClientSite } from "@/data/sopData";

function SectionCard({ section }: { section: SOPSection }) {
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

function ClientSiteCard({ site }: { site: ClientSite }) {
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
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{site.preferredDays}</span>
            </div>
          </div>

          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>
            SpeedSol Codes
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

  const filteredSections = search
    ? SOP_SECTIONS.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.subsections.some(
            (sub) =>
              sub.title.toLowerCase().includes(search.toLowerCase()) ||
              sub.content.some((c) => c.toLowerCase().includes(search.toLowerCase()))
          )
      )
    : SOP_SECTIONS;

  const filteredSites = search
    ? CLIENT_SITES.filter(
        (s) =>
          s.client.toLowerCase().includes(search.toLowerCase()) ||
          s.site.toLowerCase().includes(search.toLowerCase()) ||
          s.codes.some((c) => c.code.toLowerCase().includes(search.toLowerCase()))
      )
    : CLIENT_SITES;

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

      {/* Content */}
      {activeView === "procedures" ? (
        <div className="flex flex-col gap-1">
          {filteredSections.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No matching procedures found.</p>
          ) : (
            filteredSections.map((section) => <SectionCard key={section.id} section={section} />)
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {filteredSites.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No matching sites found.</p>
          ) : (
            filteredSites.map((site, i) => <ClientSiteCard key={`${site.client}-${site.site}-${i}`} site={site} />)
          )}
        </div>
      )}
    </div>
  );
}
