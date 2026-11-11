import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useSignedDockets, DOCKET_PAGE_SIZE, type DocketRow } from "@/hooks/useSignedDockets";
import { DocketView } from "@/components/dockets/DocketView";
import { UploadDocketDialog } from "@/components/dockets/UploadDocketDialog";
import { withTimeout } from "@/lib/requestTimeout";
import { toast } from "sonner";

export default function SignedDocketsTab({ clientAccountId, portal = false }: { clientAccountId?: number | null; portal?: boolean } = {}) {
  const [client, setClient] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [viewing, setViewing] = useState<DocketRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocketRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [upload, setUpload] = useState(false);
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["signed-docket-clients"], queryFn: async () => {
    const { data, error } = await withTimeout(supabase.from("client_accounts").select("id,company_name,speedsol_name,speedsol_names").order("company_name"));
    if (error) throw error; return data ?? [];
  } });
  const query = useSignedDockets(portal ? clientAccountId ?? null : client ? Number(client) : null, from, to, page, !portal || Boolean(clientAccountId));
  const rows = query.data?.rows ?? [];
  const count = query.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / DOCKET_PAGE_SIZE));
  const customerName = (row: DocketRow) => clients.data?.find(c => c.id === row.client_account_id)?.company_name || row.customer_name || "Customer";
  const archive = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      const { error } = await withTimeout(supabase.from("docket_archives").insert({ docket_kind: pendingDelete.kind, docket_id: pendingDelete.id }));
      if (error) throw error;
      setPendingDelete(null); setPage(0);
      await qc.invalidateQueries({ queryKey: ["signed-dockets-list"] });
      toast.success("Docket removed from lists. Original record preserved");
    } catch { toast.error("Could not remove docket. Try again"); }
    finally { setSaving(false); }
  };
  return <section className="space-y-4 min-w-0" id="signed-dockets">
    <div className="flex items-center justify-between flex-wrap gap-3"><h2 className="text-lg font-semibold">Signed dockets</h2>{!portal && <Button onClick={() => setUpload(true)} disabled={!clients.data}><Upload className="w-4 h-4 mr-2" />Upload signed docket</Button>}</div>
    <div className="flex flex-wrap gap-3 items-end">
      {!portal && <div className="min-w-0 w-full sm:w-64"><Label htmlFor="docket-client">Customer</Label><select id="docket-client" value={client} onChange={e => { setClient(e.target.value); setPage(0); }} className="w-full rounded-md border border-input bg-background p-2 text-sm"><option value="">All customers</option>{clients.data?.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select></div>}
      <div><Label htmlFor="docket-from">From</Label><Input id="docket-from" type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(0); }} /></div>
      <div><Label htmlFor="docket-to">To</Label><Input id="docket-to" type="date" min={from} value={to} onChange={e => { setTo(e.target.value); setPage(0); }} /></div>
    </div>
    {clients.error && <p role="alert">Customers could not be loaded. <Button variant="outline" onClick={() => clients.refetch()}>Retry</Button></p>}
    {query.isLoading && <p className="text-muted-foreground">Loading dockets...</p>}
    {query.error && <p role="alert">Dockets could not be loaded. <Button variant="outline" onClick={() => query.refetch()}>Retry</Button></p>}
    {!query.isLoading && !query.error && rows.length === 0 && <p className="py-8 text-muted-foreground">No signed dockets for this selection</p>}
    {rows.length > 0 && <div className="overflow-x-auto border border-border rounded-md"><table className="w-full text-sm"><thead className="text-muted-foreground"><tr>{["Date", "Customer", "Docket", "Litres", "", ...(!portal ? ["Actions"] : [])].map((heading, i) => <th className="px-3 py-3 text-left whitespace-nowrap" key={i}>{heading}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={`${row.kind}:${row.id}`} className="border-t border-border">
      <td className="px-3 py-3 whitespace-nowrap">{row.docket_date}</td><td className="px-3 py-3">{customerName(row)}</td><td className="px-3 py-3">{row.title}<span className="block text-xs text-muted-foreground">{row.kind === "uploaded" ? "Uploaded" : "Signature captured"}</span></td><td className="px-3 py-3 whitespace-nowrap">{row.litres == null ? "-" : `${Number(row.litres).toLocaleString()} L`}</td><td className="px-3 py-3"><Button variant="outline" size="sm" onClick={() => setViewing(row)}>View{row.kind === "uploaded" ? " / Download" : ""}</Button></td>
      {!portal && <td className="px-3 py-3 text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${row.title}`}><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setPendingDelete(row)}>Delete docket</DropdownMenuItem></DropdownMenuContent></DropdownMenu></td>}
    </tr>)}</tbody></table></div>}
    <div className="flex flex-wrap justify-between items-center gap-2 text-sm"><span>{count} dockets · Page {page + 1} of {pages}</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Previous dockets page" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button><Button variant="outline" size="icon" aria-label="Next dockets page" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button></div></div>
    {viewing && <DocketView docket={viewing} customer={customerName(viewing)} onClose={() => setViewing(null)} />}
    {upload && clients.data && <UploadDocketDialog clients={clients.data} onClose={() => setUpload(false)} />}
    <AlertDialog open={Boolean(pendingDelete)} onOpenChange={open => { if (!open && !saving) setPendingDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete docket?</AlertDialogTitle><AlertDialogDescription>{pendingDelete && `${customerName(pendingDelete)}, ${pendingDelete.docket_date}, ${pendingDelete.litres == null ? "litres not recorded" : `${Number(pendingDelete.litres).toLocaleString()} L`}.`} This removes the docket from staff and portal lists. The original delivery, transaction, signatures and file are preserved.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel><AlertDialogAction disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={event => { event.preventDefault(); void archive(); }}>{saving ? "Removing..." : "Delete docket"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
