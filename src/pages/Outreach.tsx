import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Mail, ExternalLink, Copy, Check } from "lucide-react";
import showcaseHtml from "@/assets/outreach/showcase-email.html?raw";
import showcaseTxt from "@/assets/outreach/showcase-email.txt?raw";

type Person = {
  id: number;
  name: string;
  email: string | null;
  org_name: string | null;
  owner_name: string | null;
  pipedrive_url: string;
};

const DEFAULT_SUBJECT =
  "A quick look at your fuel data — built for your team";

function buildBody(person: Person): string {
  const firstName = (person.name || "there").split(" ")[0];
  const intro = `Hi ${firstName},\n\n`;
  return intro + showcaseTxt;
}

export default function Outreach() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [bcc, setBcc] = useState<string | null>(null);
  const [selected, setSelected] = useState<Person | null>(null);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedHtml, setCopiedHtml] = useState(false);

  const fetchPeople = async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "pipedrive-people",
        { method: "GET" as any, body: undefined, ...(term ? {} : {}) } as any
      );
      // supabase.functions.invoke doesn't pass query params nicely; use fetch directly:
      const url = new URL(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/pipedrive-people`
      );
      if (term) url.searchParams.set("q", term);
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load contacts");
      setPeople(json.persons ?? []);
      setBcc(json.bcc ?? null);
      void data;
      void error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setPeople([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPeople("");
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void fetchPeople(query), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (selected) setBody(buildBody(selected));
  }, [selected]);

  const mailtoHref = useMemo(() => {
    if (!selected?.email) return "#";
    const params = new URLSearchParams();
    params.set("subject", subject);
    params.set("body", body);
    if (bcc) params.set("bcc", bcc);
    return `mailto:${encodeURIComponent(selected.email)}?${params
      .toString()
      .replace(/\+/g, "%20")}`;
  }, [selected, subject, body, bcc]);

  const gmailHref = useMemo(() => {
    if (!selected?.email) return "#";
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: selected.email,
      su: subject,
      body,
    });
    if (bcc) params.set("bcc", bcc);
    return `https://mail.google.com/mail/?${params.toString()}`;
  }, [selected, subject, body, bcc]);

  const copyHtml = async () => {
    await navigator.clipboard.writeText(showcaseHtml);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 1800);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 text-[#F5E6D0]">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold">Outreach</h1>
        <p className="text-sm text-[#C4A882] mt-1">
          Send the portal showcase email to a Pipedrive contact from your own
          inbox. Pipedrive's BCC is added automatically so the thread is logged
          to their timeline.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* People list */}
        <div className="rounded-lg border border-[#6B5240] bg-[#2a1d11] p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#C4A882]" />
            <Input
              placeholder="Search people, email, org…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] placeholder:text-[#8a7559]"
            />
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-[#C4A882] py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading from Pipedrive…
            </div>
          )}
          {error && (
            <div className="text-sm text-[#ff8866] bg-[#3a1810] border border-[#6b2a1a] rounded p-2">
              {error}
            </div>
          )}

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#6B5240]/50">
            {people.map((p) => {
              const isSel = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`w-full text-left py-3 px-2 hover:bg-[#3a2818] rounded transition ${
                    isSel ? "bg-[#3a2818] ring-1 ring-[#E8461E]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{p.name}</span>
                    {!p.email && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-[#8a7559] text-[#C4A882]"
                      >
                        no email
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-[#C4A882] truncate">
                    {p.email ?? "—"}
                    {p.org_name ? ` · ${p.org_name}` : ""}
                  </div>
                </button>
              );
            })}
            {!loading && people.length === 0 && (
              <div className="text-sm text-[#C4A882] py-6 text-center">
                No contacts found.
              </div>
            )}
          </div>
        </div>

        {/* Compose / preview */}
        <div className="rounded-lg border border-[#6B5240] bg-[#2a1d11] p-4 space-y-4">
          {!selected ? (
            <div className="text-sm text-[#C4A882] py-12 text-center">
              Pick a Pipedrive contact on the left to compose.
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-lg font-semibold">{selected.name}</div>
                  <div className="text-sm text-[#C4A882]">
                    {selected.email ?? "no email on file"}
                    {selected.org_name ? ` · ${selected.org_name}` : ""}
                  </div>
                </div>
                <a
                  href={selected.pipedrive_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs inline-flex items-center gap-1 text-[#C4A882] hover:text-[#F5E6D0]"
                >
                  Open in Pipedrive <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-[#C4A882]">
                  Subject
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="bg-[#1f150b] border-[#6B5240] text-[#F5E6D0]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wide text-[#C4A882]">
                    Plain-text body (sent via your inbox)
                  </label>
                  {bcc && (
                    <span className="text-[11px] text-[#C4A882]">
                      BCC: <span className="text-[#F5E6D0]">{bcc}</span>
                    </span>
                  )}
                </div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  className="bg-[#1f150b] border-[#6B5240] text-[#F5E6D0] font-mono text-xs"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  disabled={!selected.email}
                  className="bg-[#E8461E] hover:bg-[#c93a17] text-white"
                >
                  <a href={mailtoHref}>
                    <Mail className="h-4 w-4 mr-2" /> Open in default mail
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  disabled={!selected.email}
                  className="border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818]"
                >
                  <a href={gmailHref} target="_blank" rel="noreferrer">
                    <Mail className="h-4 w-4 mr-2" /> Open in Gmail
                  </a>
                </Button>
                <Button
                  variant="outline"
                  onClick={copyHtml}
                  className="border-[#6B5240] text-[#F5E6D0] hover:bg-[#3a2818]"
                >
                  {copiedHtml ? (
                    <>
                      <Check className="h-4 w-4 mr-2" /> HTML copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" /> Copy rich HTML
                    </>
                  )}
                </Button>
              </div>

              <div className="rounded border border-[#6B5240] overflow-hidden bg-white">
                <iframe
                  title="Email preview"
                  srcDoc={showcaseHtml}
                  className="w-full h-[600px] border-0"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}