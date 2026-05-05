import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, History, Loader2, Mail, MessageSquare, Search } from "lucide-react";

type LogRow = {
  id: string;
  created_at: string;
  channel: string;
  recipient_name: string | null;
  recipient_email: string | null;
  organisation: string | null;
  subject: string;
  bcc: string | null;
  sent_by: string;
  sender_email?: string | null;
  sender_name?: string | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  send_status: string | null;
};

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

const CHANNEL_LABEL: Record<string, string> = {
  gmail: "Gmail (sent)",
  default_mail: "Mail app (composed)",
};

export default function EmailActivityLog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("outreach_send_log")
        .select("id, created_at, channel, recipient_name, recipient_email, organisation, subject, bcc, sent_by, gmail_message_id, gmail_thread_id, send_status")
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) {
        console.error("Failed to load outreach log", error);
        setRows([]);
      } else {
        const base = (data ?? []) as LogRow[];
        // Resolve sender display via user_roles (email/full_name)
        const senderIds = Array.from(new Set(base.map(r => r.sent_by).filter(Boolean)));
        let lookup: Record<string, { email: string | null; full_name: string | null }> = {};
        if (senderIds.length) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("user_id, email, full_name")
            .in("user_id", senderIds);
          for (const r of roles ?? []) {
            lookup[(r as any).user_id] = { email: (r as any).email, full_name: (r as any).full_name };
          }
        }
        setRows(base.map(r => ({
          ...r,
          sender_email: lookup[r.sent_by]?.email ?? null,
          sender_name: lookup[r.sent_by]?.full_name ?? null,
        })));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const filtered = rows.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [
      r.recipient_email, r.recipient_name, r.organisation, r.subject,
      r.sender_email, r.sender_name,
    ].some(v => (v ?? "").toLowerCase().includes(q));
  });

  // Group Gmail sends by thread id, oldest -> newest within each thread,
  // then sort threads by most-recent activity desc.
  const threads = (() => {
    const map = new Map<string, LogRow[]>();
    for (const r of filtered) {
      if (r.channel !== "gmail" || !r.gmail_thread_id) continue;
      const arr = map.get(r.gmail_thread_id) ?? [];
      arr.push(r);
      map.set(r.gmail_thread_id, arr);
    }
    const list = Array.from(map.entries()).map(([threadId, items]) => {
      const sorted = [...items].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      return {
        threadId,
        items: sorted,
        latest: sorted[sorted.length - 1],
        first: sorted[0],
      };
    });
    list.sort(
      (a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime()
    );
    return list;
  })();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-surface-border text-foreground hover:bg-surface-raised h-11 px-3">
          <History className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Activity log</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-surface border-surface-border text-foreground max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-accent" /> Email activity log
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--text-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by recipient, sender, organisation, or subject"
            className="pl-9 h-11 bg-surface border-surface-border text-foreground placeholder:text-[color:var(--text-muted)]"
          />
        </div>

        <Tabs defaultValue="all" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-surface border border-surface-border">
            <TabsTrigger value="all" className="data-[state=active]:bg-surface-raised data-[state=active]:text-foreground text-muted-foreground">
              All sends
            </TabsTrigger>
            <TabsTrigger value="threads" className="data-[state=active]:bg-surface-raised data-[state=active]:text-foreground text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Threads ({threads.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="flex-1 overflow-auto rounded border border-surface-border mt-2">
            {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading activity…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No emails sent yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface text-muted-foreground text-xs uppercase tracking-wide sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">When</th>
                  <th className="text-left px-3 py-2">Sender</th>
                  <th className="text-left px-3 py-2">Recipient</th>
                  <th className="text-left px-3 py-2">Subject</th>
                  <th className="text-left px-3 py-2">Channel</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t border-surface-border align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="text-foreground">{r.sender_name || r.sender_email || "—"}</div>
                      {r.sender_name && r.sender_email && (
                        <div className="text-xs text-[color:var(--text-muted)]">{r.sender_email}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-foreground">{r.recipient_name || r.recipient_email || "—"}</div>
                      <div className="text-xs text-[color:var(--text-muted)]">{r.recipient_email}{r.organisation ? ` · ${r.organisation}` : ""}</div>
                      {r.bcc && <div className="text-[10px] text-[color:var(--text-muted)] mt-0.5">BCC: {r.bcc}</div>}
                    </td>
                    <td className="px-3 py-2 text-foreground max-w-xs truncate" title={r.subject}>{r.subject}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={
                          r.channel === "gmail"
                            ? "border-surface-border bg-surface-raised text-accent"
                            : "border-surface-border bg-surface-raised text-muted-foreground"
                        }
                      >
                        {CHANNEL_LABEL[r.channel] ?? r.channel}
                      </Badge>
                      {r.channel === "gmail" && r.gmail_thread_id && (
                        <a
                          href={`https://mail.google.com/mail/u/0/#sent/${r.gmail_thread_id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="block text-[10px] mt-1 text-accent hover:underline"
                        >
                          View in Gmail
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </TabsContent>

          <TabsContent value="threads" className="flex-1 overflow-auto rounded border border-surface-border mt-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading threads…
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No Gmail threads yet. Threads appear once you send branded emails via Gmail.
              </div>
            ) : (
              <ul className="divide-y divide-surface-border">
                {threads.map(t => {
                  const isOpen = expanded[t.threadId] ?? false;
                  const recipient = t.first.recipient_email || t.first.recipient_name || "—";
                  return (
                    <li key={t.threadId} className="bg-surface">
                      <button
                        type="button"
                        onClick={() => setExpanded(s => ({ ...s, [t.threadId]: !isOpen }))}
                        className="w-full text-left px-3 py-3 hover:bg-surface-raised flex items-start gap-2"
                      >
                        {isOpen
                          ? <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-foreground font-medium truncate">{t.first.subject}</span>
                            <Badge variant="outline" className="border-surface-border bg-surface-raised text-accent text-[10px]">
                              {t.items.length} message{t.items.length === 1 ? "" : "s"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            To {recipient}
                            {t.first.organisation ? ` · ${t.first.organisation}` : ""}
                          </div>
                          <div className="text-[10px] text-[color:var(--text-muted)] mt-0.5">
                            Last activity {formatDateTime(t.latest.created_at)}
                          </div>
                        </div>
                        <a
                          href={`https://mail.google.com/mail/u/0/#sent/${t.threadId}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-accent hover:underline shrink-0 mt-1"
                        >
                          Open in Gmail
                        </a>
                      </button>

                      {isOpen && (
                        <ol className="border-t border-surface-border bg-surface">
                          {t.items.map((m, idx) => (
                            <li key={m.id} className="px-3 py-2 border-b border-surface-border last:border-b-0 flex gap-3">
                              <div className="text-[10px] text-[color:var(--text-muted)] w-6 pt-0.5 shrink-0">#{idx + 1}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-muted-foreground">
                                  {formatDateTime(m.created_at)}
                                  <span className="mx-1">·</span>
                                  <span className="text-foreground">{m.sender_name || m.sender_email || "—"}</span>
                                </div>
                                <div className="text-sm text-foreground mt-0.5 truncate" title={m.subject}>
                                  {m.subject}
                                </div>
                                {m.bcc && (
                                  <div className="text-[10px] text-[color:var(--text-muted)] mt-0.5">BCC: {m.bcc}</div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        <div className="text-xs text-[color:var(--text-muted)]">
          Showing latest {rows.length} sends. Only admins can view this log.
        </div>
      </DialogContent>
    </Dialog>
  );
}