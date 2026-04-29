import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { History, Loader2, Mail, Search } from "lucide-react";

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818] h-11 px-3">
          <History className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Activity log</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#2a1d11] border-[#6B5240] text-[#F5E6D0] max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#E8461E]" /> Email activity log
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a7559]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by recipient, sender, organisation, or subject"
            className="pl-9 h-11 bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] placeholder:text-[#8a7559]"
          />
        </div>

        <div className="flex-1 overflow-auto rounded border border-[#6B5240]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#C4A882]">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading activity…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#C4A882] text-sm">
              No emails sent yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#1f150b] text-[#C4A882] text-xs uppercase tracking-wide sticky top-0">
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
                  <tr key={r.id} className="border-t border-[#3a2818] align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-[#C4A882]">{formatDateTime(r.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="text-[#F5E6D0]">{r.sender_name || r.sender_email || "—"}</div>
                      {r.sender_name && r.sender_email && (
                        <div className="text-xs text-[#8a7559]">{r.sender_email}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-[#F5E6D0]">{r.recipient_name || r.recipient_email || "—"}</div>
                      <div className="text-xs text-[#8a7559]">{r.recipient_email}{r.organisation ? ` · ${r.organisation}` : ""}</div>
                      {r.bcc && <div className="text-[10px] text-[#8a7559] mt-0.5">BCC: {r.bcc}</div>}
                    </td>
                    <td className="px-3 py-2 text-[#F5E6D0] max-w-xs truncate" title={r.subject}>{r.subject}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={
                          r.channel === "gmail"
                            ? "border-[#2f5a3a] bg-[#1f3a26] text-[#9be3a8]"
                            : "border-[#6B5240] bg-[#3a2818] text-[#C4A882]"
                        }
                      >
                        {CHANNEL_LABEL[r.channel] ?? r.channel}
                      </Badge>
                      {r.channel === "gmail" && r.gmail_thread_id && (
                        <a
                          href={`https://mail.google.com/mail/u/0/#sent/${r.gmail_thread_id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="block text-[10px] mt-1 text-[#E8461E] hover:underline"
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
        </div>

        <div className="text-xs text-[#8a7559]">
          Showing latest {rows.length} sends. Only admins can view this log.
        </div>
      </DialogContent>
    </Dialog>
  );
}