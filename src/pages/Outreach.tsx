import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2, Search, Mail, ExternalLink, Copy, Check, Upload, Settings2, RefreshCw,
  ArrowLeft, Eye, ChevronDown, UserPlus, Send, Download,
} from "lucide-react";
import { renderTemplate, extractVariables } from "@/lib/templateVars";
import { normalizePortalDemoLinks } from "@/lib/outreachLinks";
import { exportEmailHtmlToPdf } from "@/lib/emailPdf";
import EmailActivityLog from "@/components/outreach/EmailActivityLog";

// Keys handled by the dedicated Pricing panel (hidden from generic var grid)
const PRICING_META_KEYS = ["customer_name", "quote_date", "validity", "volume"] as const;
const PRICING_FUEL_KEYS = [
  "diesel_price", "diesel_price_inc",
  "ulp_price",    "ulp_price_inc",
  "adblue_price", "adblue_price_inc",
] as const;
const PRICING_KEYS = new Set<string>([...PRICING_META_KEYS, ...PRICING_FUEL_KEYS, "extra_terms"]);

function formatGst(ex: string): string {
  const n = parseFloat(ex);
  if (!Number.isFinite(n) || n <= 0) return "";
  return (n * 1.1).toFixed(4);
}

// ULP/AdBlue offsets vs Diesel buy price (¢/L). AdBlue is sold per litre too;
// these are sensible defaults the user can override after auto-fill.
const PRODUCT_OFFSETS_CPL = { ulp: 8, adblue: -45 } as const;

/** Parse a litre figure that may include commas, "L", or "litres" suffix. */
function parseLitres(s: string): number {
  const n = parseFloat(String(s).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

type PricingTierRow = { min_litres: number; max_litres: number | null; margin_percent: number; tier_name: string };

type Person = {
  id: number;
  name: string;
  email: string | null;
  org_name: string | null;
  owner_name: string | null;
  pipedrive_url: string;
};

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

type SendStatus = {
  send_id: string;
  pipedrive_person_id: number | null;
  recipient_email: string | null;
  created_at: string;
  status: "pending" | "logged" | "replied" | "none" | null;
  last_message_at: string | null;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending sync", color: "bg-[#3a2818] text-[#C4A882] border-[#6B5240]" },
  none: { label: "Not in Pipedrive yet", color: "bg-[#3a2818] text-[#C4A882] border-[#6B5240]" },
  logged: { label: "Logged in Pipedrive", color: "bg-[#1f3a26] text-[#9be3a8] border-[#2f5a3a]" },
  replied: { label: "Replied", color: "bg-[#3a2a14] text-[#ffb37a] border-[#E8461E]" },
};

function parseCSV(text: string): { name: string; email: string; org: string }[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  // Detect header
  const first = lines[0].toLowerCase();
  const hasHeader = /name/.test(first) && /email/.test(first);
  const rows = hasHeader ? lines.slice(1) : lines;
  const header = hasHeader
    ? first.split(",").map(h => h.trim().replace(/"/g, ""))
    : ["name", "email", "org"];
  const idxName = header.findIndex(h => h === "name" || h === "full_name");
  const idxEmail = header.findIndex(h => h === "email");
  const idxOrg = header.findIndex(h => h === "org" || h === "organisation" || h === "organization" || h === "company");

  return rows.map(line => {
    // Simple CSV parse — handles quoted fields with commas
    const cells: string[] = [];
    let cur = ""; let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { cells.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cells.push(cur);
    return {
      name: (cells[idxName >= 0 ? idxName : 0] ?? "").trim(),
      email: (cells[idxEmail >= 0 ? idxEmail : 1] ?? "").trim(),
      org: (cells[idxOrg >= 0 ? idxOrg : 2] ?? "").trim(),
    };
  }).filter(r => r.email);
}

async function copyBrandedEmail(html: string, text: string) {
  const ClipboardItemCtor = (window as any).ClipboardItem;
  if (navigator.clipboard?.write && ClipboardItemCtor) {
    await navigator.clipboard.write([
      new ClipboardItemCtor({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(html || text);
}

function normalizePipedriveHost(rawDomain?: string | null) {
  const cleaned = String(rawDomain ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.+$/, "");
  if (!cleaned) return null;
  return cleaned.endsWith(".pipedrive.com") ? cleaned : `${cleaned}.pipedrive.com`;
}

export default function Outreach() {
  const { toast } = useToast();

  // People list
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [bcc, setBcc] = useState<string | null>(null);
  const [pipedriveHost, setPipedriveHost] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Person | null>(null);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const activeTemplate = useMemo(
    () => templates.find(t => t.id === templateId) ?? null,
    [templates, templateId]
  );

  // Variable values for current compose session
  const [vars, setVars] = useState<Record<string, string>>({});

  // Pricing simulator state
  const [productMix, setProductMix] = useState<{ diesel: boolean; ulp: boolean; adblue: boolean }>({
    diesel: true, ulp: false, adblue: false,
  });
  const [latestBuyPrice, setLatestBuyPrice] = useState<number>(0);
  const [pricingTiers, setPricingTiers] = useState<PricingTierRow[]>([]);
  useEffect(() => {
    (async () => {
      const [{ data: bp }, { data: tiers }] = await Promise.all([
        supabase.from("buy_prices").select("price_per_litre").order("price_date", { ascending: false }).limit(1),
        supabase.from("pricing_tiers").select("tier_name, min_litres, max_litres, margin_percent").order("min_litres"),
      ]);
      if (bp?.[0]) setLatestBuyPrice(Number(bp[0].price_per_litre) || 0);
      if (tiers) setPricingTiers(tiers as PricingTierRow[]);
    })();
  }, []);

  const matchedTier = useMemo<PricingTierRow | null>(() => {
    const weeklyL = parseLitres(vars["volume"] ?? "");
    if (!weeklyL || pricingTiers.length === 0) return null;
    return pricingTiers.find(t => weeklyL >= t.min_litres && (t.max_litres == null || weeklyL <= t.max_litres))
        ?? pricingTiers[pricingTiers.length - 1];
  }, [vars, pricingTiers]);

  const calcAndApplyPricing = useCallback(() => {
    if (!latestBuyPrice || !matchedTier) return;
    const dieselEx = latestBuyPrice * (1 + matchedTier.margin_percent / 100);
    const next: Record<string, string> = {};
    if (productMix.diesel) {
      next.diesel_price = dieselEx.toFixed(4);
      next.diesel_price_inc = (dieselEx * 1.1).toFixed(4);
    } else { next.diesel_price = ""; next.diesel_price_inc = ""; }
    if (productMix.ulp) {
      const ex = dieselEx + PRODUCT_OFFSETS_CPL.ulp / 100;
      next.ulp_price = ex.toFixed(4);
      next.ulp_price_inc = (ex * 1.1).toFixed(4);
    } else { next.ulp_price = ""; next.ulp_price_inc = ""; }
    if (productMix.adblue) {
      const ex = Math.max(0.50, dieselEx + PRODUCT_OFFSETS_CPL.adblue / 100);
      next.adblue_price = ex.toFixed(4);
      next.adblue_price_inc = (ex * 1.1).toFixed(4);
    } else { next.adblue_price = ""; next.adblue_price_inc = ""; }
    setVars(v => ({ ...v, ...next }));
  }, [latestBuyPrice, matchedTier, productMix]);

  // Send statuses (keyed by recipient_email)
  const [statuses, setStatuses] = useState<Record<string, SendStatus>>({});
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  // CSV import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);

  // Manual recipient dialog
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualOrg, setManualOrg] = useState("");

  // Template editor dialog
  const [editorOpen, setEditorOpen] = useState(false);

  const [copiedHtml, setCopiedHtml] = useState(false);
  const [sendingGmail, setSendingGmail] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // ── Data loaders ─────────────────────────────────────────────────────────
  const fetchPeople = useCallback(async (term: string) => {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("pipedrive-people", { body: { q: term } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setPeople((data as any)?.persons ?? []);
      setBcc((data as any)?.bcc ?? null);
      setPipedriveHost(normalizePipedriveHost((data as any)?.company_domain));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setPeople([]);
    } finally { setLoading(false); }
  }, []);

  const fetchTemplates = useCallback(async () => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) { console.error(error); return; }
    const rows: Template[] = (data ?? []).map((r: any) => ({
      ...r,
      variables: Array.isArray(r.variables) ? r.variables : [],
      default_values: r.default_values ?? {},
    }));
    setTemplates(rows);
    if (!templateId && rows.length > 0) setTemplateId(rows[0].id);
  }, [templateId]);

  const fetchStatuses = useCallback(async () => {
    // Pull last 50 sends + their cached status
    const { data, error } = await supabase
      .from("outreach_send_log")
      .select("id, pipedrive_person_id, recipient_email, created_at, outreach_thread_status(status, last_message_at)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { console.error(error); return; }
    const map: Record<string, SendStatus> = {};
    for (const row of data as any[]) {
      const ts = Array.isArray(row.outreach_thread_status) ? row.outreach_thread_status[0] : row.outreach_thread_status;
      // Latest send per recipient wins (data is desc-sorted)
      if (row.recipient_email && !map[row.recipient_email]) {
        map[row.recipient_email] = {
          send_id: row.id,
          pipedrive_person_id: row.pipedrive_person_id,
          recipient_email: row.recipient_email,
          created_at: row.created_at,
          status: ts?.status ?? "pending",
          last_message_at: ts?.last_message_at ?? null,
        };
      }
    }
    setStatuses(map);
  }, []);

  const refreshStatuses = async () => {
    setRefreshingStatus(true);
    try {
      const { error } = await supabase.functions.invoke("pipedrive-thread-status", { body: {} });
      if (error) throw error;
      await fetchStatuses();
      toast({ title: "Status refreshed", description: "Pulled latest mail-thread state from Pipedrive." });
    } catch (e) {
      toast({ title: "Status refresh failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally { setRefreshingStatus(false); }
  };

  useEffect(() => { void fetchPeople(""); void fetchTemplates(); void fetchStatuses(); }, [fetchPeople, fetchTemplates, fetchStatuses]);

  useEffect(() => {
    const t = setTimeout(() => void fetchPeople(query), 350);
    return () => clearTimeout(t);
  }, [query, fetchPeople]);

  // Reset variable values when template or person changes
  useEffect(() => {
    if (!activeTemplate) return;
    const next: Record<string, string> = { ...activeTemplate.default_values };
    if (selected) {
      const firstName = (selected.name || "there").split(" ")[0];
      if (!next.customerName || next.customerName === activeTemplate.default_values.customerName) {
        next.customerName = firstName;
      }
    }
    setVars(next);
  }, [activeTemplate, selected]);

  // ── Rendered subject / body / html ───────────────────────────────────────
  const renderedSubject = useMemo(
    () => activeTemplate ? renderTemplate(activeTemplate.subject, vars) : "",
    [activeTemplate, vars]
  );
  const renderedText = useMemo(
    () => activeTemplate ? normalizePortalDemoLinks(renderTemplate(activeTemplate.text_body, vars)) : "",
    [activeTemplate, vars]
  );
  const renderedHtml = useMemo(
    () => activeTemplate ? normalizePortalDemoLinks(renderTemplate(activeTemplate.html_body, vars)) : "",
    [activeTemplate, vars]
  );

  const allVarKeys = useMemo(() => {
    if (!activeTemplate) return [];
    const declared = activeTemplate.variables ?? [];
    const inferred = extractVariables(activeTemplate.subject, activeTemplate.text_body, activeTemplate.html_body);
    return Array.from(new Set([...declared, ...inferred]));
  }, [activeTemplate]);

  // Validation for the pricing/meta fields shown in the "Today's Pricing" panel.
  // Only validates keys that are actually used by the active template.
  const pricingErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!allVarKeys.some(k => PRICING_KEYS.has(k))) return errs;

    const need = (k: string) => allVarKeys.includes(k);
    const val = (k: string) => (vars[k] ?? "").trim();

    if (need("quote_date")) {
      const v = val("quote_date");
      if (!v) errs.quote_date = "Quote date is required.";
      else {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) errs.quote_date = "Use a valid date (e.g. 30 Apr 2026).";
        else {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          if (d.getTime() < today.getTime() - 86_400_000) errs.quote_date = "Quote date is in the past.";
        }
      }
    }

    if (need("validity")) {
      const v = val("validity");
      if (!v) errs.validity = "Validity is required (e.g. \"7 days\").";
      else if (v.length > 80) errs.validity = "Keep validity under 80 characters.";
    }

    if (need("volume")) {
      const v = val("volume");
      if (!v) errs.volume = "Weekly volume is required.";
      else if (parseLitres(v) <= 0) errs.volume = "Enter a positive litre figure (e.g. 2,500 L).";
    }

    (["diesel", "ulp", "adblue"] as const).forEach(p => {
      const exKey = `${p}_price`;
      const incKey = `${p}_price_inc`;
      if (!need(exKey) && !need(incKey)) return;
      if (!productMix[p]) return; // intentionally blank when not in mix

      if (need(exKey)) {
        const raw = val(exKey);
        const n = parseFloat(raw);
        if (!raw) errs[exKey] = "Required.";
        else if (!Number.isFinite(n) || n <= 0) errs[exKey] = "Must be a positive number.";
        else if (n > 10) errs[exKey] = "Looks too high — enter $/L.";
      }
      if (need(incKey)) {
        const raw = val(incKey);
        const n = parseFloat(raw);
        const ex = parseFloat(val(exKey));
        if (!raw) errs[incKey] = "Required.";
        else if (!Number.isFinite(n) || n <= 0) errs[incKey] = "Must be a positive number.";
        else if (Number.isFinite(ex) && n + 0.0001 < ex) errs[incKey] = "Inc-GST cannot be less than ex-GST.";
      }
    });

    return errs;
  }, [allVarKeys, vars, productMix]);

  const pricingErrorCount = Object.keys(pricingErrors).length;

  const selectedPipedriveUrl = useMemo(() => {
    if (!selected || selected.id <= 0) return null;
    if (pipedriveHost) return `https://${pipedriveHost}/person/${selected.id}`;
    return selected.pipedrive_url || null;
  }, [selected, pipedriveHost]);

  // ── Mailto / Gmail links ─────────────────────────────────────────────────
  const mailtoHref = useMemo(() => {
    if (!selected?.email) return "#";
    const params = new URLSearchParams();
    params.set("subject", renderedSubject);
    params.set("body", renderedText);
    if (bcc) params.set("bcc", bcc);
    return `mailto:${encodeURIComponent(selected.email)}?${params.toString().replace(/\+/g, "%20")}`;
  }, [selected, renderedSubject, renderedText, bcc]);

  const gmailHref = useMemo(() => {
    if (!selected?.email) return "#";
    const params = new URLSearchParams({
      view: "cm", fs: "1", to: selected.email, su: renderedSubject, body: renderedText,
    });
    if (bcc) params.set("bcc", bcc);
    return `https://mail.google.com/mail/?${params.toString()}`;
  }, [selected, renderedSubject, renderedText, bcc]);

  const brandedMailtoHref = useMemo(() => {
    if (!selected?.email) return "#";
    const params = new URLSearchParams();
    params.set("subject", renderedSubject);
    if (bcc) params.set("bcc", bcc);
    return `mailto:${encodeURIComponent(selected.email)}?${params.toString().replace(/\+/g, "%20")}`;
  }, [selected, renderedSubject, bcc]);

  const brandedGmailHref = useMemo(() => {
    if (!selected?.email) return "#";
    const params = new URLSearchParams({
      view: "cm", fs: "1", to: selected.email, su: renderedSubject,
    });
    if (bcc) params.set("bcc", bcc);
    return `https://mail.google.com/mail/?${params.toString()}`;
  }, [selected, renderedSubject, bcc]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const copyHtml = async () => {
    await copyBrandedEmail(renderedHtml, renderedText);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 1800);
  };

  const exportPdf = async () => {
    if (!activeTemplate || !renderedHtml) return;
    setExportingPdf(true);
    try {
      await exportEmailHtmlToPdf({
        html: renderedHtml,
        filename: `${activeTemplate.name}-${selected?.org_name || selected?.name || "campaign"}`,
      });
      toast({ title: "PDF exported", description: "Clickable links are preserved in the PDF." });
    } catch (e) {
      toast({
        title: "PDF export failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const logSend = async (
    channel: "default_mail" | "gmail",
    extra?: { gmail_message_id?: string | null; gmail_thread_id?: string | null; send_status?: string },
  ) => {
    if (!selected || !activeTemplate) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      await supabase.from("outreach_send_log").insert({
        sent_by: userData.user.id,
        channel,
        pipedrive_person_id: selected.id > 0 ? selected.id : null,
        recipient_name: selected.name,
        recipient_email: selected.email,
        organisation: selected.org_name,
        subject: renderedSubject,
        body: renderedText,
        bcc,
        template_id: activeTemplate.id,
        gmail_message_id: extra?.gmail_message_id ?? null,
        gmail_thread_id: extra?.gmail_thread_id ?? null,
        send_status: extra?.send_status ?? "sent",
      });
      // Optimistically mark this recipient as pending
      if (selected.email) {
        setStatuses(prev => ({
          ...prev,
          [selected.email!]: {
            send_id: "local",
            pipedrive_person_id: selected.id,
            recipient_email: selected.email,
            created_at: new Date().toISOString(),
            status: "pending",
            last_message_at: null,
          },
        }));
      }
    } catch (e) {
      console.error("Failed to log outreach send", e);
    }
  };

  const openBrandedCompose = async (channel: "default_mail" | "gmail") => {
    if (!selected?.email) return;
    const popup = channel === "gmail" ? window.open("", "_blank") : null;
    let copied = false;
    try {
      await copyBrandedEmail(renderedHtml, renderedText);
      copied = true;
      toast({ title: "Branded email copied", description: "Paste it into the email body, then send." });
    } catch (e) {
      toast({ title: "Opening plain-text fallback", description: "Your browser blocked copying the branded layout.", variant: "destructive" });
    }
    void logSend(channel);
    const href = copied
      ? (channel === "gmail" ? brandedGmailHref : brandedMailtoHref)
      : (channel === "gmail" ? gmailHref : mailtoHref);
    if (channel === "gmail") {
      if (popup) popup.location.href = href;
      else window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.href = href;
  };

  const sendViaGmail = async () => {
    if (!selected?.email || !activeTemplate) return;
    setSendingGmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-via-gmail", {
        body: {
          to: selected.email,
          subject: renderedSubject,
          html: renderedHtml,
          text: renderedText,
          bcc: bcc || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Email sent", description: `Branded email delivered to ${selected.email} from your Gmail account.` });
      void logSend("gmail", {
        gmail_message_id: (data as any)?.messageId ?? null,
        gmail_thread_id: (data as any)?.threadId ?? null,
        send_status: "sent",
      });
    } catch (e) {
      toast({
        title: "Send failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSendingGmail(false);
    }
  };

  const importCsv = async () => {
    const leads = parseCSV(csvText);
    if (leads.length === 0) {
      toast({ title: "No valid rows", description: "Need at least an email column.", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("pipedrive-create-persons", {
        body: { leads },
      });
      if (error) throw error;
      const results = (data as any)?.results ?? [];
      const created = results.filter((r: any) => r.status === "created").length;
      const exists = results.filter((r: any) => r.status === "exists").length;
      const errored = results.filter((r: any) => r.status === "error").length;
      toast({
        title: `Import complete`,
        description: `${created} created · ${exists} already in Pipedrive · ${errored} errors`,
      });
      setImportOpen(false);
      setCsvText("");
      await fetchPeople("");
    } catch (e) {
      toast({ title: "Import failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally { setImporting(false); }
  };

  const useManualRecipient = () => {
    const email = manualEmail.trim();
    const name = manualName.trim();
    if (!email || !/.+@.+\..+/.test(email)) {
      toast({ title: "Email required", description: "Enter a valid email address.", variant: "destructive" });
      return;
    }
    // Synthesize a Person — negative id signals "not in Pipedrive"
    const synthetic: Person = {
      id: -Date.now(),
      name: name || email,
      email,
      org_name: manualOrg.trim() || null,
      owner_name: null,
      pipedrive_url: "",
    };
    setSelected(synthetic);
    setManualOpen(false);
    setManualName(""); setManualEmail(""); setManualOrg("");
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="text-[#F5E6D0] pb-28 lg:pb-8">
      <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className={`${selected ? "hidden md:block" : ""}`}>
          <h1 className="text-2xl md:text-3xl font-semibold">Outreach</h1>
          <p className="text-sm text-[#C4A882] mt-1 hidden md:block">
            Send templated emails from your inbox. Pipedrive's Smart BCC logs the thread automatically.
          </p>
        </div>
        {selected && (
          <Button
            variant="ghost"
            onClick={() => setSelected(null)}
            className="md:hidden text-[#F5E6D0] hover:bg-[#3a2818] -ml-2 h-11"
          >
            <ArrowLeft className="h-5 w-5 mr-1" /> Contacts
          </Button>
        )}
        <div className="flex gap-2 flex-wrap">
          <EmailActivityLog />
          <Button
            variant="outline"
            onClick={refreshStatuses}
            disabled={refreshingStatus}
            className="border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818] h-11 px-3"
          >
            {refreshingStatus
              ? <Loader2 className="h-4 w-4 md:mr-2 animate-spin" />
              : <RefreshCw className="h-4 w-4 md:mr-2" />}
            <span className="hidden md:inline">Sync status from Pipedrive</span>
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818] h-11 px-3">
                <Upload className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Import CSV</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#2a1d11] border-[#6B5240] text-[#F5E6D0] max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import recipients into Pipedrive</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-[#C4A882]">
                Paste a CSV with columns <code className="text-[#F5E6D0]">name, email, org</code>. Each row will be
                created as a Person in Pipedrive (or matched if the email already exists).
              </p>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={10}
                placeholder={"name,email,org\nJane Smith,jane@acme.com,Acme Pty Ltd"}
                className="bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] font-mono text-xs"
              />
              <DialogFooter>
                <Button onClick={importCsv} disabled={importing} className="bg-[#E8461E] hover:bg-[#c93a17] text-white">
                  {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Push to Pipedrive
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={manualOpen} onOpenChange={setManualOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818] h-11 px-3">
                <UserPlus className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Manual recipient</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#2a1d11] border-[#6B5240] text-[#F5E6D0] max-w-md">
              <DialogHeader>
                <DialogTitle>Send to a one-off recipient</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-[#C4A882]">
                Type a name and email to send the templated email immediately. The send will be logged here, and
                Pipedrive's Smart BCC will still capture the thread if you keep it on.
              </p>
              <div className="space-y-3">
                <Input
                  placeholder="Full name (optional)"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="h-12 bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] placeholder:text-[#8a7559]"
                />
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="h-12 bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] placeholder:text-[#8a7559]"
                />
                <Input
                  placeholder="Organisation (optional)"
                  value={manualOrg}
                  onChange={(e) => setManualOrg(e.target.value)}
                  className="h-12 bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] placeholder:text-[#8a7559]"
                />
              </div>
              <DialogFooter>
                <Button onClick={useManualRecipient} className="bg-[#E8461E] hover:bg-[#c93a17] text-white h-12">
                  Use this recipient
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            onClick={() => setEditorOpen(true)}
            className="border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818] h-11 px-3"
          >
            <Settings2 className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Templates</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* People list — hidden on mobile when a person is selected */}
        <div className={`rounded-lg border border-[#6B5240] bg-[#2a1d11] p-3 space-y-3 ${selected ? "hidden lg:block" : ""}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#C4A882]" />
            <Input
              placeholder="Search people, email, org…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-12 bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] placeholder:text-[#8a7559]"
            />
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-[#C4A882] py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading from Pipedrive…
            </div>
          )}
          {error && (
            <div className="text-sm text-[#ff8866] bg-[#3a1810] border border-[#6b2a1a] rounded p-2">{error}</div>
          )}

          <div className="max-h-[calc(100vh-220px)] lg:max-h-[65vh] overflow-y-auto divide-y divide-[#6B5240]/50">
            {people.map((p) => {
              const isSel = selected?.id === p.id;
              const st = p.email ? statuses[p.email.toLowerCase()] : undefined;
              const meta = st?.status ? STATUS_META[st.status] : null;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`w-full text-left py-4 px-2 min-h-[56px] hover:bg-[#3a2818] active:bg-[#3a2818] rounded transition ${isSel ? "bg-[#3a2818] ring-1 ring-[#E8461E]" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{p.name}</span>
                    {!p.email && (
                      <Badge variant="outline" className="text-[10px] border-[#8a7559] text-[#C4A882]">no email</Badge>
                    )}
                  </div>
                  <div className="text-xs text-[#C4A882] truncate">
                    {p.email ?? "—"}{p.org_name ? ` · ${p.org_name}` : ""}
                  </div>
                  {meta && (
                    <div className="mt-1">
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
            {!loading && people.length === 0 && (
              <div className="text-sm text-[#C4A882] py-6 text-center">No contacts found.</div>
            )}
          </div>
        </div>

        {/* Compose — hidden on mobile until a person is picked */}
        <div className={`rounded-lg border border-[#6B5240] bg-[#2a1d11] p-4 space-y-4 ${selected ? "" : "hidden lg:block"}`}>
          {!selected ? (
            <div className="text-sm text-[#C4A882] py-12 text-center">
              Pick a Pipedrive contact on the left to compose, or import a CSV to add new leads.
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-lg font-semibold">{selected.name}</div>
                  <div className="text-sm text-[#C4A882]">
                    {selected.email ?? "no email on file"}{selected.org_name ? ` · ${selected.org_name}` : ""}
                  </div>
                </div>
                {selectedPipedriveUrl && (
                  <a href={selectedPipedriveUrl} target="_blank" rel="noreferrer"
                     className="text-xs inline-flex items-center gap-1 text-[#C4A882] hover:text-[#F5E6D0]">
                    Open in Pipedrive <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* Template picker */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-[#C4A882]">Template</label>
                <Select value={templateId ?? ""} onValueChange={setTemplateId}>
                  <SelectTrigger className="bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] h-12">
                    <SelectValue placeholder="Pick a template" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2a1d11] border-[#6B5240] text-[#F5E6D0]">
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pricing panel — only when template uses pricing keys */}
              {allVarKeys.some(k => PRICING_KEYS.has(k)) && (
                <div className="space-y-3 rounded-lg border border-[#6B5240] bg-[#1f150b] p-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wide text-[#C4A882]">Today's Pricing</label>
                    <span className="text-[10px] text-[#8B7355]">Inc-GST auto-fills at +10%</span>
                  </div>

                  {pricingErrorCount > 0 && (
                    <div
                      role="alert"
                      className="rounded border border-[#E8461E] bg-[#3a1a0d] px-3 py-2 text-xs text-[#FFD9C8]"
                    >
                      <div className="font-semibold">
                        {pricingErrorCount} field{pricingErrorCount === 1 ? "" : "s"} need{pricingErrorCount === 1 ? "s" : ""} attention
                      </div>
                      <div className="text-[11px] text-[#F5C9B5] mt-0.5">
                        Fix the highlighted inputs below before sending.
                      </div>
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {PRICING_META_KEYS.filter(k => allVarKeys.includes(k)).map(key => (
                      <div key={key} className="space-y-1">
                        <span className="text-[11px] text-[#C4A882]">
                          {key === "customer_name" ? "Customer name"
                            : key === "quote_date" ? "Quote date"
                            : key === "validity"   ? "Validity"
                            : "Weekly volume"}
                        </span>
                        <Input
                          value={vars[key] ?? ""}
                          onChange={(e) => setVars(v => ({ ...v, [key]: e.target.value }))}
                          placeholder={activeTemplate?.default_values?.[key] ?? ""}
                          aria-invalid={!!pricingErrors[key]}
                          className={`bg-[#120a04] text-[#F5E6D0] h-11 ${
                            pricingErrors[key] ? "border-[#E8461E] focus-visible:ring-[#E8461E]" : "border-[#6B5240]"
                          }`}
                        />
                        {pricingErrors[key] && (
                          <span className="block text-[10px] text-[#FFB199]">{pricingErrors[key]}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pricing simulator */}
                  <div className="space-y-2 rounded border border-[#6B5240] bg-[#120a04] p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[11px] uppercase tracking-wide text-[#C4A882]">Calculator</span>
                      <span className="text-[10px] text-[#8B7355]">
                        Buy: {latestBuyPrice ? `$${latestBuyPrice.toFixed(4)}/L` : "—"}
                        {matchedTier && ` · ${matchedTier.tier_name} +${matchedTier.margin_percent}%`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {(["diesel", "ulp", "adblue"] as const).map(p => (
                        <label key={p} className="flex items-center gap-1.5 text-xs text-[#F5E6D0] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={productMix[p]}
                            onChange={(e) => setProductMix(m => ({ ...m, [p]: e.target.checked }))}
                            className="accent-[#E8461E] h-4 w-4"
                          />
                          {p === "ulp" ? "ULP" : p === "adblue" ? "AdBlue" : "Diesel"}
                        </label>
                      ))}
                      <Button
                        type="button"
                        onClick={calcAndApplyPricing}
                        disabled={!latestBuyPrice || !matchedTier}
                        className="ml-auto h-9 bg-[#E8461E] hover:bg-[#c93a17] text-white text-xs px-3"
                      >
                        Calculate from volume
                      </Button>
                    </div>
                    {!matchedTier && (
                      <div className="text-[10px] text-[#C4A882]">Enter weekly volume above to match a tier.</div>
                    )}
                  </div>

                  {/* Fuel pricing rows */}
                  <div className="space-y-2">
                    {(["diesel", "ulp", "adblue"] as const).map(fuel => {
                      const exKey  = `${fuel}_price`;
                      const incKey = `${fuel}_price_inc`;
                      if (!allVarKeys.includes(exKey) && !allVarKeys.includes(incKey)) return null;
                      const label = fuel === "ulp" ? "ULP" : fuel === "adblue" ? "AdBlue" : "Diesel";
                      return (
                        <div key={fuel} className="grid grid-cols-[80px_1fr_1fr_auto] items-end gap-2">
                          <span className="text-xs text-[#F5E6D0] pb-2">{label}</span>
                          <div className="space-y-1">
                            <span className="text-[10px] text-[#C4A882]">Ex-GST $/L</span>
                            <Input
                              type="number" step="0.0001" inputMode="decimal"
                              value={vars[exKey] ?? ""}
                              onChange={(e) => setVars(v => ({ ...v, [exKey]: e.target.value }))}
                              placeholder={activeTemplate?.default_values?.[exKey] ?? "0.0000"}
                              aria-invalid={!!pricingErrors[exKey]}
                              className={`bg-[#120a04] text-[#F5E6D0] h-11 ${
                                pricingErrors[exKey] ? "border-[#E8461E] focus-visible:ring-[#E8461E]" : "border-[#6B5240]"
                              }`}
                            />
                            {pricingErrors[exKey] && (
                              <span className="block text-[10px] text-[#FFB199]">{pricingErrors[exKey]}</span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-[#C4A882]">Inc-GST $/L</span>
                            <Input
                              type="number" step="0.0001" inputMode="decimal"
                              value={vars[incKey] ?? ""}
                              onChange={(e) => setVars(v => ({ ...v, [incKey]: e.target.value }))}
                              placeholder={activeTemplate?.default_values?.[incKey] ?? "0.0000"}
                              aria-invalid={!!pricingErrors[incKey]}
                              className={`bg-[#120a04] text-[#F5E6D0] h-11 ${
                                pricingErrors[incKey] ? "border-[#E8461E] focus-visible:ring-[#E8461E]" : "border-[#6B5240]"
                              }`}
                            />
                            {pricingErrors[incKey] && (
                              <span className="block text-[10px] text-[#FFB199]">{pricingErrors[incKey]}</span>
                            )}
                          </div>
                          <Button
                            type="button" variant="outline"
                            onClick={() => setVars(v => ({ ...v, [incKey]: formatGst(v[exKey] ?? "") }))}
                            className="h-11 border-[#6B5240] bg-[#2a1d11] text-[#F5E6D0] hover:bg-[#3a2818] text-[10px] px-2"
                            title="Calculate inc-GST from ex-GST"
                          >
                            +10%
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Estimated weekly cost summary */}
                  {(() => {
                    const weeklyL = parseLitres(vars["volume"] ?? "");
                    const selected = (["diesel", "ulp", "adblue"] as const).filter(p => productMix[p]);
                    if (!weeklyL || selected.length === 0) {
                      return (
                        <div className="rounded border border-[#6B5240] bg-[#120a04] p-3 text-[11px] text-[#C4A882]">
                          Enter weekly volume and select at least one product to see estimated cost.
                        </div>
                      );
                    }
                    const perProductL = weeklyL / selected.length;
                    const fmt = (n: number) =>
                      n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 });
                    const rows = selected.map(p => {
                      const ex = parseFloat(vars[`${p}_price`] ?? "") || 0;
                      const inc = parseFloat(vars[`${p}_price_inc`] ?? "") || 0;
                      return {
                        key: p,
                        label: p === "ulp" ? "ULP" : p === "adblue" ? "AdBlue" : "Diesel",
                        litres: perProductL,
                        ex: ex * perProductL,
                        inc: inc * perProductL,
                      };
                    });
                    const totals = rows.reduce(
                      (acc, r) => ({ ex: acc.ex + r.ex, inc: acc.inc + r.inc, gst: acc.gst + (r.inc - r.ex) }),
                      { ex: 0, inc: 0, gst: 0 }
                    );
                    return (
                      <div className="rounded border border-[#6B5240] bg-[#120a04] p-3 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-[#C4A882]">
                            Estimated weekly cost
                          </span>
                          <span className="text-[10px] text-[#8B7355]">
                            {weeklyL.toLocaleString("en-AU")} L total
                            {selected.length > 1 && ` · split equally across ${selected.length} products`}
                          </span>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 text-xs">
                          <span className="text-[10px] text-[#C4A882]">Product</span>
                          <span className="text-[10px] text-[#C4A882] text-right">Litres</span>
                          <span className="text-[10px] text-[#C4A882] text-right">Ex-GST</span>
                          <span className="text-[10px] text-[#C4A882] text-right">Inc-GST</span>
                          {rows.map(r => (
                            <React.Fragment key={r.key}>
                              <span className="text-[#F5E6D0]">{r.label}</span>
                              <span className="text-[#F5E6D0] text-right tabular-nums">
                                {Math.round(r.litres).toLocaleString("en-AU")}
                              </span>
                              <span className="text-[#F5E6D0] text-right tabular-nums">{fmt(r.ex)}</span>
                              <span className="text-[#F5E6D0] text-right tabular-nums">{fmt(r.inc)}</span>
                            </React.Fragment>
                          ))}
                          <span className="text-[#C4A882] pt-1 border-t border-[#6B5240]">GST</span>
                          <span className="text-right pt-1 border-t border-[#6B5240]" />
                          <span className="text-right pt-1 border-t border-[#6B5240]" />
                          <span className="text-[#F5E6D0] text-right tabular-nums pt-1 border-t border-[#6B5240]">
                            {fmt(totals.gst)}
                          </span>
                          <span className="text-[#F5E6D0] font-semibold">Weekly total</span>
                          <span className="text-right" />
                          <span className="text-[#F5E6D0] font-semibold text-right tabular-nums">{fmt(totals.ex)}</span>
                          <span className="text-[#E8461E] font-semibold text-right tabular-nums">{fmt(totals.inc)}</span>
                          <span className="text-[10px] text-[#8B7355]">Annual (×52) inc-GST</span>
                          <span />
                          <span />
                          <span className="text-[10px] text-[#C4A882] text-right tabular-nums">
                            {fmt(totals.inc * 52)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {allVarKeys.includes("extra_terms") && (
                    <div className="space-y-1">
                      <span className="text-[11px] text-[#C4A882]">Extra terms (optional)</span>
                      <Textarea
                        value={vars["extra_terms"] ?? ""}
                        onChange={(e) => setVars(v => ({ ...v, extra_terms: e.target.value }))}
                        placeholder={activeTemplate?.default_values?.["extra_terms"] ?? ""}
                        className="bg-[#120a04] border-[#6B5240] text-[#F5E6D0] min-h-[60px]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Other variables (anything not handled by the pricing panel) */}
              {allVarKeys.filter(k => !PRICING_KEYS.has(k)).length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-[#C4A882]">Variables</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {allVarKeys.filter(k => !PRICING_KEYS.has(k)).map(key => (
                      <div key={key} className="space-y-1">
                        <span className="text-[11px] text-[#C4A882] font-mono">{`{{${key}}}`}</span>
                        <Input
                          value={vars[key] ?? ""}
                          onChange={(e) => setVars(v => ({ ...v, [key]: e.target.value }))}
                          placeholder={activeTemplate?.default_values?.[key] ?? ""}
                          className="bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] h-12"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subject (read-only rendered) */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-[#C4A882]">Subject (rendered)</label>
                <Input value={renderedSubject} readOnly
                       className="bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] h-12" />
              </div>

              {/* Preview tabs — collapsed by default on mobile */}
              <details className="lg:hidden group rounded border border-[#6B5240] bg-[#1f150b]">
                <summary className="list-none cursor-pointer px-3 py-3 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2"><Eye className="h-4 w-4" /> Preview email</span>
                  <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                </summary>
                <div className="p-2 border-t border-[#6B5240]">
                  <div className="rounded border border-[#6B5240] overflow-hidden bg-white">
                    <iframe title="Email preview" srcDoc={renderedHtml} className="w-full h-[420px] border-0" />
                  </div>
                  {bcc && (
                    <div className="text-[11px] text-[#C4A882] mt-2">
                      BCC: <span className="text-[#F5E6D0]">{bcc}</span>
                    </div>
                  )}
                </div>
              </details>

              <Tabs defaultValue="html" className="hidden lg:block">
                <div className="flex items-center justify-between">
                  <TabsList className="bg-[#1f150b] border border-[#6B5240]">
                    <TabsTrigger value="html">HTML preview</TabsTrigger>
                    <TabsTrigger value="text">Plain-text body</TabsTrigger>
                  </TabsList>
                  {bcc && (
                    <span className="text-[11px] text-[#C4A882]">
                      BCC: <span className="text-[#F5E6D0]">{bcc}</span>
                    </span>
                  )}
                </div>
                <TabsContent value="html" className="mt-3">
                  <div className="rounded border border-[#6B5240] overflow-hidden bg-white">
                    <iframe title="Email preview" srcDoc={renderedHtml} className="w-full h-[600px] border-0" />
                  </div>
                </TabsContent>
                <TabsContent value="text" className="mt-3">
                  <Textarea value={renderedText} readOnly rows={20}
                            className="bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] font-mono text-xs" />
                </TabsContent>
              </Tabs>

              {/* Desktop send actions */}
              <div className="hidden lg:flex flex-wrap gap-2">
                <Button disabled={!selected.email || sendingGmail || pricingErrorCount > 0}
                        onClick={() => void sendViaGmail()}
                        title={pricingErrorCount > 0 ? "Fix pricing/meta validation errors first" : undefined}
                        className="bg-[#E8461E] hover:bg-[#c93a17] text-white">
                  {sendingGmail
                    ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>)
                    : (<><Send className="h-4 w-4 mr-2" /> Send branded email via Gmail</>)}
                </Button>
                <Button disabled={!selected.email || pricingErrorCount > 0}
                        onClick={() => void openBrandedCompose("default_mail")}
                        variant="outline"
                        title={pricingErrorCount > 0 ? "Fix pricing/meta validation errors first" : undefined}
                        className="border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818]">
                  <Mail className="h-4 w-4 mr-2" /> Open in default mail
                </Button>
                <Button variant="outline" disabled={!selected.email || pricingErrorCount > 0}
                        onClick={() => void openBrandedCompose("gmail")}
                        title={pricingErrorCount > 0 ? "Fix pricing/meta validation errors first" : undefined}
                        className="border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818]">
                  <Mail className="h-4 w-4 mr-2" /> Open in Gmail
                </Button>
                <Button variant="outline" onClick={copyHtml}
                        className="border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818]">
                  {copiedHtml
                    ? (<><Check className="h-4 w-4 mr-2" /> HTML copied</>)
                    : (<><Copy className="h-4 w-4 mr-2" /> Copy rendered HTML</>)}
                </Button>
                <Button variant="outline" onClick={() => void exportPdf()} disabled={exportingPdf || !renderedHtml}
                        className="border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818]">
                  {exportingPdf
                    ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Exporting…</>)
                    : (<><Download className="h-4 w-4 mr-2" /> Export clickable PDF</>)}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Template editor */}
      <TemplateEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        templates={templates}
        onChanged={() => void fetchTemplates()}
      />
      </div>

      {/* Sticky mobile send bar */}
      {selected && selected.email && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#6B5240] bg-[#1a1108]/95 backdrop-blur p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {pricingErrorCount > 0 && (
            <div role="alert" className="mb-2 rounded border border-[#E8461E] bg-[#3a1a0d] px-2 py-1 text-[11px] text-[#FFD9C8]">
              {pricingErrorCount} pricing field{pricingErrorCount === 1 ? "" : "s"} need{pricingErrorCount === 1 ? "s" : ""} attention — sending disabled.
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => void sendViaGmail()}
                    disabled={sendingGmail || pricingErrorCount > 0}
                    className="flex-1 h-12 bg-[#E8461E] hover:bg-[#c93a17] text-white">
              {sendingGmail
                ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>)
                : (<><Send className="h-4 w-4 mr-2" /> Send via Gmail</>)}
            </Button>
            <Button variant="outline"
                    onClick={() => void openBrandedCompose("default_mail")}
                    disabled={pricingErrorCount > 0}
                    className="h-12 px-4 border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818]">
              Mail
            </Button>
            <Button variant="outline"
                    onClick={() => void exportPdf()}
                    disabled={exportingPdf || !renderedHtml}
                    className="h-12 px-4 border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818]">
              {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Template editor ───────────────────────────────────────────────────────
function TemplateEditor({
  open, onOpenChange, templates, onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templates: Template[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Template>>({});
  const [saving, setSaving] = useState(false);
  const [exportingDraftPdf, setExportingDraftPdf] = useState(false);

  useEffect(() => {
    if (!open) { setEditingId(null); setDraft({}); }
  }, [open]);

  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setDraft({ ...t });
  };

  const startNew = () => {
    setEditingId("new");
    setDraft({
      name: "New template",
      description: "",
      subject: "Subject for {{customerName}}",
      html_body: "<p>Hi {{customerName}},</p>",
      text_body: "Hi {{customerName}},",
      variables: ["customerName"],
      default_values: { customerName: "there" },
      is_active: true,
    });
  };

  const inferred = useMemo(() => {
    return extractVariables(
      draft.subject ?? "", draft.text_body ?? "", draft.html_body ?? ""
    );
  }, [draft.subject, draft.text_body, draft.html_body]);

  const save = async () => {
    if (!draft.name || !draft.subject || !draft.html_body || !draft.text_body) {
      toast({ title: "Missing fields", description: "Name, subject, html and text are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name,
        description: draft.description ?? null,
        subject: draft.subject,
        html_body: normalizePortalDemoLinks(draft.html_body),
        text_body: normalizePortalDemoLinks(draft.text_body),
        variables: inferred,
        default_values: draft.default_values ?? {},
        is_active: draft.is_active ?? true,
      };
      if (editingId === "new") {
        const { error } = await supabase.from("email_templates").insert(payload);
        if (error) throw error;
      } else if (editingId) {
        const { error } = await supabase.from("email_templates").update(payload).eq("id", editingId);
        if (error) throw error;
      }
      toast({ title: "Saved", description: "Template saved." });
      onChanged();
      setEditingId(null); setDraft({});
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const exportDraftPdf = async () => {
    if (!draft.html_body) return;
    setExportingDraftPdf(true);
    try {
      await exportEmailHtmlToPdf({
        html: normalizePortalDemoLinks(draft.html_body),
        filename: draft.name || "email-campaign-template",
      });
      toast({ title: "PDF exported", description: "Clickable links are preserved in the PDF." });
    } catch (e) {
      toast({
        title: "PDF export failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setExportingDraftPdf(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#2a1d11] border-[#6B5240] text-[#F5E6D0] max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email templates</DialogTitle>
        </DialogHeader>

        {!editingId ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={startNew} className="bg-[#E8461E] hover:bg-[#c93a17] text-white">+ New template</Button>
            </div>
            <div className="divide-y divide-[#6B5240]/50">
              {templates.map(t => (
                <button key={t.id} onClick={() => startEdit(t)}
                        className="w-full text-left py-3 px-2 hover:bg-[#3a2818] rounded">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-[#C4A882] truncate">{t.subject}</div>
                  <div className="text-[11px] text-[#8a7559] mt-1">
                    Variables: {(t.variables ?? []).join(", ") || "—"}
                  </div>
                </button>
              ))}
              {templates.length === 0 && (
                <div className="text-sm text-[#C4A882] py-6 text-center">No templates yet.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase text-[#C4A882]">Name</label>
                <Input value={draft.name ?? ""} onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                       className="bg-[#1f150b] border-[#6B5240] text-[#F5E6D0]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase text-[#C4A882]">Description</label>
                <Input value={draft.description ?? ""} onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
                       className="bg-[#1f150b] border-[#6B5240] text-[#F5E6D0]" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase text-[#C4A882]">Subject</label>
              <Input value={draft.subject ?? ""} onChange={(e) => setDraft(d => ({ ...d, subject: e.target.value }))}
                     className="bg-[#1f150b] border-[#6B5240] text-[#F5E6D0]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase text-[#C4A882]">Plain-text body</label>
              <Textarea rows={8} value={draft.text_body ?? ""} onChange={(e) => setDraft(d => ({ ...d, text_body: e.target.value }))}
                        className="bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase text-[#C4A882]">HTML body</label>
              <Textarea rows={12} value={draft.html_body ?? ""} onChange={(e) => setDraft(d => ({ ...d, html_body: e.target.value }))}
                        className="bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] font-mono text-xs" />
            </div>
            <div className="text-xs text-[#C4A882]">
              Detected variables: {inferred.length > 0 ? inferred.map(v => <code key={v} className="text-[#F5E6D0] mr-2">{`{{${v}}}`}</code>) : "—"}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => void exportDraftPdf()} disabled={exportingDraftPdf || !draft.html_body}
                      className="border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818]">
                {exportingDraftPdf
                  ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Exporting…</>)
                  : (<><Download className="h-4 w-4 mr-2" /> Export PDF</>)}
              </Button>
              <Button variant="outline" onClick={() => { setEditingId(null); setDraft({}); }}
                      className="border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818]">Cancel</Button>
              <Button onClick={save} disabled={saving} className="bg-[#E8461E] hover:bg-[#c93a17] text-white">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save template
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}