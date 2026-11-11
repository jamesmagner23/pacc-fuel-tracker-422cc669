import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { validateDocketFile } from "@/lib/docketUpload";
import { melbourneDate } from "@/lib/transactionDates";
import { withTimeout } from "@/lib/requestTimeout";
import { toast } from "sonner";
type Client = { id: number; company_name: string; speedsol_name: string | null; speedsol_names: string[] | null };
export function UploadDocketDialog({ clients, onClose }: { clients: Client[]; onClose: () => void }) {
  const [client, setClient] = useState("");
  const [date, setDate] = useState(melbourneDate());
  const [link, setLink] = useState("");
  const [litres, setLitres] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const choices = useQuery({ queryKey: ["docket-delivery-options", client, date], enabled: Boolean(client && date), queryFn: async () => {
    const account = clients.find(c => c.id === Number(client));
    const names = [...new Set([account?.company_name, account?.speedsol_name, ...(account?.speedsol_names ?? [])].filter((s): s is string => Boolean(s)))];
    const [stops, tx] = await Promise.all([
      withTimeout(supabase.from("dispatch_stops").select("id,site_name,delivered_litres").eq("client_account_id", Number(client)).eq("scheduled_date", date).order("id")),
      withTimeout(supabase.from("transactions").select("id,factura,cantidad").in("nombre_cliente1", names).eq("date", date).order("id")),
    ]);
    if (stops.error || tx.error) throw stops.error ?? tx.error;
    return [...(stops.data ?? []).map(s => ({ value: `stop:${s.id}`, label: `${s.site_name} (${s.delivered_litres ?? "-"} L)` })), ...(tx.data ?? []).map(t => ({ value: `tx:${t.id}`, label: `Transaction ${t.factura ?? t.id} (${t.cantidad ?? "-"} L)` }))];
  } });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (!file || !client || !date) { setError("Choose a customer, date and file"); return; }
    const invalid = validateDocketFile(file);
    if (invalid) { setError(invalid); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again");
      const path = `${client}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const upload = await withTimeout(supabase.storage.from("signed-dockets").upload(path, file, { contentType: file.type, upsert: false }), 60_000);
      if (upload.error) throw upload.error;
      const result = await withTimeout(supabase.from("uploaded_dockets").insert({ client_account_id: Number(client), docket_date: date, file_path: path, file_name: file.name, mime_type: file.type, litres: litres === "" ? null : Number(litres), notes: notes || null, uploaded_by: user.id, dispatch_stop_id: link.startsWith("stop:") ? link.slice(5) : null, transaction_id: link.startsWith("tx:") ? Number(link.slice(3)) : null }));
      if (result.error) throw result.error;
      await qc.invalidateQueries({ queryKey: ["signed-dockets-list"] });
      toast.success("Signed docket uploaded"); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed. Try again"); }
    finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={() => { if (!saving) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Upload signed docket</DialogTitle></DialogHeader><form onSubmit={submit}><fieldset disabled={saving} className="space-y-4">
    <div><Label htmlFor="upload-client">Customer</Label><select id="upload-client" required value={client} onChange={e => { setClient(e.target.value); setLink(""); }} className="w-full border border-input bg-background rounded-md p-2"><option value="">Choose customer</option>{clients.map(c => <option value={c.id} key={c.id}>{c.company_name}</option>)}</select></div>
    <div><Label htmlFor="upload-date">Docket date</Label><Input id="upload-date" type="date" required value={date} onChange={e => { setDate(e.target.value); setLink(""); }} /></div>
    <div><Label htmlFor="upload-link">Link delivery or transaction (optional)</Label><select id="upload-link" value={link} onChange={e => setLink(e.target.value)} className="w-full border border-input bg-background rounded-md p-2"><option value="">No link</option>{choices.data?.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>{choices.isLoading && <p className="text-sm text-muted-foreground">Loading deliveries...</p>}{choices.error && <Button type="button" variant="outline" onClick={() => choices.refetch()}>Retry deliveries</Button>}{choices.data?.length === 0 && <p className="text-sm text-muted-foreground">No deliveries or transactions for this customer and date</p>}</div>
    <div><Label htmlFor="upload-litres">Litres (optional)</Label><Input id="upload-litres" type="number" min="0" step="any" value={litres} onChange={e => setLitres(e.target.value)} /></div>
    <div><Label htmlFor="upload-notes">Notes (optional)</Label><Textarea id="upload-notes" value={notes} onChange={e => setNotes(e.target.value)} /></div>
    <div><Label htmlFor="upload-file">PDF or image, max 10 MB</Label><Input id="upload-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif" required onChange={e => setFile(e.target.files?.[0] ?? null)} /></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" type="button" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Uploading..." : "Upload"}</Button></div>
  </fieldset></form></DialogContent></Dialog>;
}