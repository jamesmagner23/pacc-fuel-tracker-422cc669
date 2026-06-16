import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export type OutreachCategory = "daily" | "cold" | "followup" | "winback";

type Template = {
  id: string;
  name: string;
  category: string | null;
  subject: string;
  text_body: string;
  sort_order: number;
  is_active: boolean;
};

type Opener = { id: string; segment: string; opener: string };

type Props = {
  open: boolean;
  onClose: () => void;
  defaultCategory?: OutreachCategory;
  /** Customer sell price in $/L inc-GST. NEVER pass buy price. */
  sellPricePerLitre?: number | null;
  firstName?: string;
  company?: string;
  toEmail?: string;
};

const CATEGORY_LABELS: Record<OutreachCategory, string> = {
  daily: "Daily price",
  cold: "Cold",
  followup: "Follow-up",
  winback: "Win Back",
};

function formatSellPrice(v?: number | null): string {
  if (v == null || !isFinite(v) || v <= 0) return "";
  return `$${v.toFixed(2)}/L`;
}

function parseSellPriceNumber(s: string): number | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return isFinite(n) && n > 0 ? n : null;
}

function formatExGst(inc: string): string {
  const n = parseSellPriceNumber(inc);
  if (n == null) return "";
  return `$${(n / 1.1).toFixed(2)}/L`;
}

function nextBusinessDayLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  // Skip Sat (6) -> Mon, Sun (0) -> Mon
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function mergeTokens(tpl: string, vars: Record<string, string>): string {
  // Replace tokens; if a token is empty, also strip the line it sits on
  // when that line would otherwise be empty.
  const lines = tpl.split("\n").map((line) => {
    let out = line;
    const tokens = out.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
    for (const tok of tokens) {
      const key = tok.replace(/[{}\s]/g, "");
      out = out.split(tok).join(vars[key] ?? "");
    }
    return out;
  });
  // Collapse 3+ consecutive blank lines down to 2 (one paragraph break).
  const cleaned: string[] = [];
  let blanks = 0;
  for (const l of lines) {
    if (l.trim() === "") {
      blanks++;
      if (blanks <= 1) cleaned.push("");
    } else {
      blanks = 0;
      cleaned.push(l);
    }
  }
  return cleaned.join("\n");
}

export default function OutreachComposer({
  open,
  onClose,
  defaultCategory = "cold",
  sellPricePerLitre,
  firstName,
  company,
  toEmail,
}: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [openers, setOpeners] = useState<Opener[]>([]);
  const [capLink, setCapLink] = useState<string>("");

  const [category, setCategory] = useState<OutreachCategory>(defaultCategory);
  const [templateId, setTemplateId] = useState<string>("");
  const [segment, setSegment] = useState<string>("__none");
  const [first, setFirst] = useState(firstName ?? "");
  const [comp, setComp] = useState(company ?? "");
  const [to, setTo] = useState(toEmail ?? "");
  const [sellPrice, setSellPrice] = useState<string>(formatSellPrice(sellPricePerLitre));
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);

  // Re-sync prefilled fields each time the drawer opens.
  useEffect(() => {
    if (!open) return;
    setCategory(defaultCategory);
    setFirst(firstName ?? "");
    setComp(company ?? "");
    setTo(toEmail ?? "");
    setSellPrice(formatSellPrice(sellPricePerLitre));
    setSubjectOverride(null);
    setBodyOverride(null);
    setSegment("__none");
  }, [open, defaultCategory, firstName, company, toEmail, sellPricePerLitre]);

  // Load templates + openers when opened
  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [{ data: tpls }, { data: ops }] = await Promise.all([
        supabase
          .from("email_templates")
          .select("id, name, category, subject, text_body, sort_order, is_active")
          .eq("is_active", true)
          .in("category", ["daily", "cold", "followup", "winback"])
          .order("category")
          .order("sort_order"),
        supabase
          .from("segment_openers")
          .select("id, segment, opener")
          .eq("is_active", true)
          .order("sort_order"),
      ]);
      setTemplates((tpls ?? []) as Template[]);
      setOpeners((ops ?? []) as Opener[]);
      // Capability statement link — read from a cheap settings shim if present.
      const { data: settings } = await supabase
        .from("crm_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      // Tolerant lookup; column may not exist.
      const link = (settings as any)?.capability_statement_url ?? "";
      setCapLink(link || "");
    })();
  }, [open]);

  // Auto-pick first template in category when category changes / templates load.
  useEffect(() => {
    const inCat = templates.filter((t) => t.category === category);
    if (inCat.length === 0) {
      setTemplateId("");
      return;
    }
    if (!inCat.find((t) => t.id === templateId)) {
      setTemplateId(inCat[0].id);
      setSubjectOverride(null);
      setBodyOverride(null);
    }
  }, [templates, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templates, templateId],
  );

  const segmentOpener = useMemo(() => {
    if (segment === "__none") return "";
    return openers.find((o) => o.segment === segment)?.opener ?? "";
  }, [openers, segment]);

  const vars: Record<string, string> = useMemo(
    () => ({
      first_name: first || "",
      company: comp || "",
      sell_price: sellPrice || "",
      sell_price_ex: formatExGst(sellPrice),
      delivery_date: nextBusinessDayLabel(),
      segment_opener: segmentOpener || "",
      cap_statement_link: capLink || "",
    }),
    [first, comp, sellPrice, segmentOpener, capLink],
  );

  const mergedSubject = useMemo(() => {
    if (!template) return "";
    return mergeTokens(template.subject, vars);
  }, [template, vars]);

  const mergedBody = useMemo(() => {
    if (!template) return "";
    return mergeTokens(template.text_body, vars);
  }, [template, vars]);

  const finalSubject = subjectOverride ?? mergedSubject;
  const finalBody = bodyOverride ?? mergedBody;

  const gmailUrl = useMemo(() => {
    const u = new URL("https://mail.google.com/mail/");
    u.searchParams.set("view", "cm");
    u.searchParams.set("fs", "1");
    if (to) u.searchParams.set("to", to);
    u.searchParams.set("su", finalSubject);
    u.searchParams.set("body", finalBody);
    return u.toString();
  }, [to, finalSubject, finalBody]);

  const logSend = async (via: "gmail" | "copied") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("outreach_log").insert({
      to_name: first || null,
      to_email: to || null,
      company: comp || null,
      template_id: template?.id ?? null,
      category,
      segment: segment === "__none" ? null : segment,
      sell_price: sellPrice || null,
      sent_via: via,
      sent_by: user.id,
    });
  };

  const openInGmail = async () => {
    if (!finalSubject.trim() || !finalBody.trim()) {
      toast.error("Subject and body required");
      return;
    }
    window.open(gmailUrl, "_blank", "noopener,noreferrer");
    await logSend("gmail");
    toast.success("Opened Gmail — attach the cap statement before sending");
    onClose();
  };

  const copyEmail = async () => {
    if (!finalSubject.trim() || !finalBody.trim()) {
      toast.error("Subject and body required");
      return;
    }
    await navigator.clipboard.writeText(`Subject: ${finalSubject}\n\n${finalBody}`);
    await logSend("copied");
    toast.success("Copied subject + body");
  };

  const templatesInCategory = templates.filter((t) => t.category === category);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface border-surface-border text-foreground max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compose outreach</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Category segmented */}
          <div className="flex gap-1 bg-surface-raised border border-surface-border rounded-lg p-1 w-fit">
            {(["daily", "cold", "followup", "winback"] as OutreachCategory[]).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className="px-3 py-1.5 rounded-md text-xs font-medium min-h-[36px]"
                style={{
                  background: category === c ? "var(--accent-light)" : "transparent",
                  color: category === c ? "var(--primary)" : "var(--text-secondary)",
                }}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Template</Label>
              <Select value={templateId} onValueChange={(v) => { setTemplateId(v); setSubjectOverride(null); setBodyOverride(null); }}>
                <SelectTrigger className="bg-surface border-surface-border">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent className="bg-surface border-surface-border text-foreground">
                  {templatesInCategory.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {category === "cold" && (
              <div>
                <Label>Segment opener</Label>
                <Select value={segment} onValueChange={setSegment}>
                  <SelectTrigger className="bg-surface border-surface-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-surface-border text-foreground">
                    <SelectItem value="__none">None</SelectItem>
                    {openers.map((o) => (
                      <SelectItem key={o.id} value={o.segment}>{o.segment}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>First name</Label>
              <Input value={first} onChange={(e) => setFirst(e.target.value)} className="bg-surface border-surface-border" />
            </div>
            <div>
              <Label>Company</Label>
              <Input value={comp} onChange={(e) => setComp(e.target.value)} className="bg-surface border-surface-border" />
            </div>
            <div>
              <Label>To email</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} className="bg-surface border-surface-border" type="email" />
            </div>
          </div>

          <div>
            <Label>Sell price</Label>
            <Input
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder="$1.85/L"
              className="bg-surface border-surface-border max-w-xs"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Customer sell price only. Never paste buy price, margin or supplier.
            </p>
          </div>

          <div>
            <Label>Subject</Label>
            <Input
              value={finalSubject}
              onChange={(e) => setSubjectOverride(e.target.value)}
              className="bg-surface border-surface-border"
            />
          </div>

          <div>
            <Label>Body (editable)</Label>
            <Textarea
              value={finalBody}
              onChange={(e) => setBodyOverride(e.target.value)}
              rows={16}
              className="bg-surface border-surface-border font-sans text-sm"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground sm:mr-auto">
            Attach the capability statement in Gmail before sending.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyEmail} className="border-surface-border">
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy email
            </Button>
            <Button onClick={openInGmail}>
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open in Gmail
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}