import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, Sun, Moon, Plus, Trash2 } from "lucide-react";
import { renderTemplate, extractVariables } from "@/lib/templateVars";
import { normalizePortalDemoLinks } from "@/lib/outreachLinks";

type Template = {
  id: string;
  name: string;
  description: string | null;
  subject: string;
  html_body: string;
  text_body: string;
  variables: string[];
  default_values: Record<string, string>;
  is_active: boolean;
};

type PreviewTheme = "light" | "dark";

const PREVIEW_BG: Record<PreviewTheme, string> = {
  light: "#EFE9DC",
  dark: "#0E1F10",
};

export default function EmailTemplatesTab() {
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>("light");
  const [newVarKey, setNewVarKey] = useState("");

  const { data: templates = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        variables: Array.isArray(r.variables) ? r.variables : [],
        default_values: r.default_values ?? {},
      })) as Template[];
    },
  });

  // Pick the first template once loaded
  useEffect(() => {
    if (!activeId && templates.length > 0) setActiveId(templates[0].id);
  }, [templates, activeId]);

  // Hydrate draft when active template changes
  useEffect(() => {
    const tpl = templates.find(t => t.id === activeId) ?? null;
    setDraft(tpl ? { ...tpl, default_values: { ...tpl.default_values } } : null);
  }, [activeId, templates]);

  const inferredVars = useMemo(() => {
    if (!draft) return [] as string[];
    return extractVariables(draft.subject, draft.text_body, draft.html_body);
  }, [draft]);

  const allVarKeys = useMemo(() => {
    if (!draft) return [] as string[];
    return Array.from(new Set([...(draft.variables || []), ...inferredVars]));
  }, [draft, inferredVars]);

  const previewValues = useMemo(() => {
    const v: Record<string, string> = { ...(draft?.default_values ?? {}) };
    for (const k of allVarKeys) if (!v[k]) v[k] = `{{${k}}}`;
    return v;
  }, [draft, allVarKeys]);

  const renderedSubject = useMemo(
    () => (draft ? renderTemplate(draft.subject, previewValues) : ""),
    [draft, previewValues]
  );
  const renderedHtml = useMemo(
    () => (draft ? normalizePortalDemoLinks(renderTemplate(draft.html_body, previewValues)) : ""),
    [draft, previewValues]
  );

  const updateDefault = (key: string, value: string) => {
    setDraft(d => (d ? { ...d, default_values: { ...d.default_values, [key]: value } } : d));
  };

  const addVariable = () => {
    const k = newVarKey.trim();
    if (!k || !draft) return;
    if (!/^[a-zA-Z0-9_]+$/.test(k)) {
      toast({ title: "Invalid variable name", description: "Use letters, numbers and underscores only.", variant: "destructive" });
      return;
    }
    if (draft.variables.includes(k)) return;
    setDraft({ ...draft, variables: [...draft.variables, k] });
    setNewVarKey("");
  };

  const removeVariable = (k: string) => {
    if (!draft) return;
    const nextDefaults = { ...draft.default_values };
    delete nextDefaults[k];
    setDraft({
      ...draft,
      variables: draft.variables.filter(v => v !== k),
      default_values: nextDefaults,
    });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({
          name: draft.name,
          description: draft.description,
          subject: draft.subject,
          html_body: draft.html_body,
          text_body: draft.text_body,
          variables: draft.variables,
          default_values: draft.default_values,
          is_active: draft.is_active,
        })
        .eq("id", draft.id);
      if (error) throw error;
      toast({ title: "Template saved", description: draft.name });
      await refetch();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary text-sm p-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading email templates…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
      {/* Sidebar */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-2 h-fit">
        {templates.map(t => {
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all min-h-[44px] flex flex-col gap-0.5"
              style={{
                background: active ? "var(--accent-light)" : "transparent",
                color: active ? "var(--primary)" : "var(--text-secondary)",
              }}
            >
              <span>{t.name}</span>
              {!t.is_active && (
                <span className="text-[10px] uppercase tracking-wider text-text-muted">inactive</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Editor + Preview */}
      {draft ? (
        <div className="flex flex-col gap-4">
          {/* Meta fields */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Template</div>
                <Input
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  className="mt-1 max-w-md"
                />
              </div>
              <Button onClick={save} disabled={saving} className="min-h-[44px]">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Subject</div>
              <Input
                value={draft.subject}
                onChange={e => setDraft({ ...draft, subject: e.target.value })}
              />
            </div>
          </div>

          {/* Variables */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Variables</div>
              <div className="flex gap-2">
                <Input
                  value={newVarKey}
                  onChange={e => setNewVarKey(e.target.value)}
                  placeholder="new_var_name"
                  className="h-9 w-48"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addVariable(); } }}
                />
                <Button variant="outline" size="sm" onClick={addVariable} className="min-h-[36px]">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
            </div>
            {allVarKeys.length === 0 && (
              <div className="text-xs text-text-muted">No variables yet. Reference one in the body as <code>{`{{name}}`}</code> or add it above.</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allVarKeys.map(k => {
                const inferredOnly = !draft.variables.includes(k) && inferredVars.includes(k);
                return (
                  <div key={k} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono text-text-secondary">{`{{${k}}}`}</label>
                      <div className="flex items-center gap-2">
                        {inferredOnly && <Badge variant="outline" className="text-[9px]">inferred</Badge>}
                        {!inferredOnly && (
                          <button
                            onClick={() => removeVariable(k)}
                            className="text-text-muted hover:text-negative"
                            title="Remove variable"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <Input
                      value={draft.default_values[k] ?? ""}
                      onChange={e => updateDefault(k, e.target.value)}
                      placeholder="Default value"
                      className="h-9"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* HTML editor */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">HTML body</div>
            <Textarea
              value={draft.html_body}
              onChange={e => setDraft({ ...draft, html_body: e.target.value })}
              rows={14}
              className="font-mono text-xs"
            />
          </div>

          {/* Plain text */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Plain-text body</div>
            <Textarea
              value={draft.text_body}
              onChange={e => setDraft({ ...draft, text_body: e.target.value })}
              rows={8}
              className="font-mono text-xs"
            />
          </div>

          {/* Preview */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Preview</div>
                <div className="text-sm text-text-primary mt-0.5">{renderedSubject || <span className="text-text-muted">(no subject)</span>}</div>
              </div>
              <div className="flex gap-1 bg-surface-raised border border-surface-border rounded-lg p-1">
                {(["light", "dark"] as PreviewTheme[]).map(theme => (
                  <button
                    key={theme}
                    onClick={() => setPreviewTheme(theme)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all min-h-[36px]"
                    style={{
                      background: previewTheme === theme ? "var(--accent-light)" : "transparent",
                      color: previewTheme === theme ? "var(--primary)" : "var(--text-secondary)",
                    }}
                  >
                    {theme === "light" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    {theme === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            </div>
            <div
              className="rounded-lg p-4 border border-surface-border"
              style={{ background: PREVIEW_BG[previewTheme] }}
            >
              <iframe
                title="email-preview"
                srcDoc={renderedHtml}
                sandbox=""
                className="w-full bg-white rounded-md"
                style={{ height: 720, border: "none" }}
              />
            </div>
            <p className="text-[11px] text-text-muted mt-2">
              The email body is always white in inboxes. The toggle simulates the surrounding chrome (light or dark mail client).
            </p>
          </div>
        </div>
      ) : (
        <div className="text-sm text-text-muted">No templates found.</div>
      )}
    </div>
  );
}