import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

interface Subsection {
  title: string;
  content: string[];
}

interface SOPRow {
  id: string;
  title: string;
  display_order: number;
  subsections: Subsection[];
  created_at: string;
}

interface SiteRow {
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

function useSopSections() {
  return useQuery({
    queryKey: ["admin-sop-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sop_sections")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data || []) as unknown as SOPRow[];
    },
  });
}

function useSopSites() {
  return useQuery({
    queryKey: ["admin-sop-sites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sop_client_sites")
        .select("*")
        .order("client");
      if (error) throw error;
      return (data || []) as unknown as SiteRow[];
    },
  });
}

function SectionEditor({ section, onClose }: { section: SOPRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = !section;
  const [title, setTitle] = useState(section?.title || "");
  const [order, setOrder] = useState(section?.display_order ?? 0);
  const [subsections, setSubsections] = useState<Subsection[]>(
    section?.subsections || [{ title: "", content: [""] }]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        const { error } = await supabase.from("sop_sections").insert({
          title,
          display_order: order,
          subsections: subsections as any,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sop_sections")
          .update({ title, display_order: order, subsections: subsections as any })
          .eq("id", section!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-sop-sections"] });
      toast.success(isNew ? "Section created" : "Section updated");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSubsection = () => setSubsections([...subsections, { title: "", content: [""] }]);
  const removeSubsection = (i: number) => setSubsections(subsections.filter((_, j) => j !== i));
  const updateSub = (i: number, field: string, value: any) => {
    const updated = [...subsections];
    (updated[i] as any)[field] = value;
    setSubsections(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-surface-border rounded-[10px] p-5 w-full max-w-[600px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {isNew ? "New Section" : "Edit Section"}
          </span>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[11px] text-muted-foreground">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none" />
            </div>
            <div className="w-20 flex flex-col gap-1.5">
              <label className="text-[11px] text-muted-foreground">Order</label>
              <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))}
                className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none" />
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2">Subsections</div>
          {subsections.map((sub, i) => (
            <div key={i} className="border border-surface-border rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  value={sub.title}
                  onChange={(e) => updateSub(i, "title", e.target.value)}
                  placeholder="Subsection title"
                  className="flex-1 bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-1.5 text-[12px] outline-none"
                />
                <button onClick={() => removeSubsection(i)} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                value={sub.content.join("\n")}
                onChange={(e) => updateSub(i, "content", e.target.value.split("\n"))}
                placeholder="Content (one line per bullet)"
                rows={4}
                className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[12px] outline-none resize-y"
              />
            </div>
          ))}

          <button onClick={addSubsection}
            className="flex items-center gap-2 text-xs text-accent bg-transparent border border-dashed border-surface-border rounded-lg py-2 px-3 cursor-pointer hover:border-accent transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Subsection
          </button>

          <button
            onClick={() => mutation.mutate()}
            disabled={!title || mutation.isPending}
            className="bg-primary text-primary-foreground border-none rounded-full px-5 py-2.5 text-xs font-semibold cursor-pointer mt-2 disabled:opacity-50"
          >
            {mutation.isPending ? "Saving…" : isNew ? "Create Section" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SiteEditor({ site, onClose }: { site: SiteRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = !site;
  const [client, setClient] = useState(site?.client || "");
  const [siteName, setSiteName] = useState(site?.site || "");
  const [address, setAddress] = useState(site?.address || "");
  const [contact, setContact] = useState(site?.contact || "");
  const [phone, setPhone] = useState(site?.phone || "");
  const [preferredDays, setPreferredDays] = useState(site?.preferred_days || "");
  const [codes, setCodes] = useState<{ code: string; description: string }[]>(site?.codes || [{ code: "", description: "" }]);
  const [notes, setNotes] = useState<string[]>(site?.notes || []);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        client, site: siteName, address, contact, phone,
        preferred_days: preferredDays,
        codes: codes.filter(c => c.code) as any,
        notes: notes.filter(Boolean) as any,
      };
      if (isNew) {
        const { error } = await supabase.from("sop_client_sites").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sop_client_sites").update(payload).eq("id", site!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-sop-sites"] });
      toast.success(isNew ? "Site created" : "Site updated");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-surface-border rounded-[10px] p-5 w-full max-w-[600px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{isNew ? "New Client Site" : "Edit Client Site"}</span>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Client", value: client, set: setClient },
              { label: "Site", value: siteName, set: setSiteName },
              { label: "Address", value: address, set: setAddress },
              { label: "Contact", value: contact, set: setContact },
              { label: "Phone", value: phone, set: setPhone },
              { label: "Preferred Days", value: preferredDays, set: setPreferredDays },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted-foreground">{label}</label>
                <input value={value} onChange={(e) => set(e.target.value)}
                  className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none" />
              </div>
            ))}
          </div>

          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2">SpeedSol Codes</div>
          {codes.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input value={c.code} onChange={(e) => { const u = [...codes]; u[i] = { ...u[i], code: e.target.value }; setCodes(u); }}
                placeholder="Code" className="flex-1 bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-1.5 text-[12px] outline-none" />
              <input value={c.description} onChange={(e) => { const u = [...codes]; u[i] = { ...u[i], description: e.target.value }; setCodes(u); }}
                placeholder="Description" className="flex-1 bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-1.5 text-[12px] outline-none" />
              <button onClick={() => setCodes(codes.filter((_, j) => j !== i))}
                className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button onClick={() => setCodes([...codes, { code: "", description: "" }])}
            className="flex items-center gap-2 text-xs text-accent bg-transparent border border-dashed border-surface-border rounded-lg py-2 px-3 cursor-pointer hover:border-accent transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Code
          </button>

          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2">Notes</div>
          <textarea
            value={notes.join("\n")}
            onChange={(e) => setNotes(e.target.value.split("\n"))}
            placeholder="One note per line"
            rows={3}
            className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[12px] outline-none resize-y"
          />

          <button onClick={() => mutation.mutate()} disabled={!client || !siteName || mutation.isPending}
            className="bg-primary text-primary-foreground border-none rounded-full px-5 py-2.5 text-xs font-semibold cursor-pointer mt-2 disabled:opacity-50">
            {mutation.isPending ? "Saving…" : isNew ? "Create Site" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SOPManager() {
  const { data: sections = [], isLoading: secLoading } = useSopSections();
  const { data: sites = [], isLoading: siteLoading } = useSopSites();
  const [activeView, setActiveView] = useState<"procedures" | "sites">("procedures");
  const [editSection, setEditSection] = useState<SOPRow | null | "new">(null);
  const [editSite, setEditSite] = useState<SiteRow | null | "new">(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const deleteSectionMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sop_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-sop-sections"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSiteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sop_client_sites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-sop-sites"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-foreground">Operations Handbook</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{sections.length} procedures · {sites.length} sites</span>
      </div>

      {/* Toggle */}
      <div className="flex gap-1 p-1 rounded-lg bg-surface border border-surface-border">
        {[
          { key: "procedures" as const, label: "Procedures" },
          { key: "sites" as const, label: "Client Sites" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveView(tab.key)}
            className="flex-1 text-xs font-medium py-2 rounded-md transition-colors"
            style={{
              background: activeView === tab.key ? "var(--accent, #f04a1a)" : "transparent",
              color: activeView === tab.key ? "#fff" : "var(--text-secondary, #C4A882)",
              border: "none", cursor: "pointer",
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Procedures */}
      {activeView === "procedures" && (
        <>
          <button onClick={() => setEditSection("new")}
            className="flex items-center gap-2 text-xs font-medium text-accent bg-transparent border border-dashed border-surface-border rounded-lg py-3 px-4 cursor-pointer hover:border-accent transition-colors w-full justify-center">
            <Plus className="w-4 h-4" /> Add Procedure Section
          </button>
          {secLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <div className="flex flex-col gap-1">
              {sections.map((s) => (
                <div key={s.id} className="bg-surface border border-surface-border rounded-[10px]">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      className="bg-transparent border-none cursor-pointer text-muted-foreground p-0">
                      {expandedId === s.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <span className="flex-1 text-[13px] font-medium text-foreground">{s.title}</span>
                    <span className="text-[10px] text-muted-foreground">{s.subsections.length} sub</span>
                    <button onClick={() => setEditSection(s)} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if (confirm(`Delete "${s.title}"?`)) deleteSectionMut.mutate(s.id); }}
                      className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  {expandedId === s.id && (
                    <div className="px-4 pb-3 border-t border-surface-border">
                      {s.subsections.map((sub, i) => (
                        <div key={i} className="mt-2">
                          <div className="text-[11px] font-semibold text-accent uppercase tracking-wider">{sub.title}</div>
                          {sub.content.map((line, j) => (
                            <p key={j} className="text-[12px] text-muted-foreground mt-0.5 mb-0">{line}</p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Client Sites */}
      {activeView === "sites" && (
        <>
          <button onClick={() => setEditSite("new")}
            className="flex items-center gap-2 text-xs font-medium text-accent bg-transparent border border-dashed border-surface-border rounded-lg py-3 px-4 cursor-pointer hover:border-accent transition-colors w-full justify-center">
            <Plus className="w-4 h-4" /> Add Client Site
          </button>
          {siteLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <div className="flex flex-col gap-1">
              {sites.map((s) => (
                <div key={s.id} className="bg-surface border border-surface-border rounded-[10px] px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground truncate">{s.client}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{s.site} · {s.codes.length} codes</div>
                  </div>
                  <button onClick={() => setEditSite(s)} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (confirm(`Delete "${s.client} — ${s.site}"?`)) deleteSiteMut.mutate(s.id); }}
                    className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {editSection !== null && (
        <SectionEditor
          section={editSection === "new" ? null : editSection}
          onClose={() => setEditSection(null)}
        />
      )}
      {editSite !== null && (
        <SiteEditor
          site={editSite === "new" ? null : editSite}
          onClose={() => setEditSite(null)}
        />
      )}
    </div>
  );
}
