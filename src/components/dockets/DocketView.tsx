import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/requestTimeout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DocketRow } from "@/hooks/useSignedDockets";
export function DocketView({ docket, customer, onClose }: { docket: DocketRow; customer?: string; onClose: () => void }) {
  const query = useQuery({ queryKey: ["docket-open", docket.kind, docket.id], queryFn: async () => {
    if (docket.kind === "uploaded" && docket.file_path) {
      const { data, error } = await withTimeout(supabase.storage.from("signed-dockets").createSignedUrl(docket.file_path, 300));
      if (error) throw error;
      const download = await withTimeout(supabase.storage.from("signed-dockets").createSignedUrl(docket.file_path, 300, { download: docket.file_name ?? true }));
      if (download.error) throw download.error;
      return { url: data.signedUrl, download: download.data.signedUrl, stop: null };
    }
    const { data, error } = await withTimeout(supabase.from("dispatch_stops").select("site_name,address,customer_name,customer_role,customer_signature,driver_signature,signature_notes,products").eq("id", docket.id).single());
    if (error) throw error;
    return { url: null, download: null, stop: data };
  }, staleTime: 0 });
  const stop = query.data?.stop;
  const products = stop?.products as { lines?: { placa?: string; litres?: number; product?: string }[] } | null;
  return <Dialog open onOpenChange={onClose}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{customer || docket.customer_name || docket.title || "Signed docket"}</DialogTitle></DialogHeader>
    <p className="text-sm text-muted-foreground">{docket.docket_date} · {docket.litres == null ? "Litres not recorded" : `${Number(docket.litres).toLocaleString()} L`}</p>
    {query.isLoading && <p>Loading docket...</p>}
    {query.error && <div role="alert">Docket could not be opened. <Button variant="outline" onClick={() => query.refetch()}>Retry</Button></div>}
    {query.data?.url && <><div className="flex gap-2"><Button asChild variant="outline"><a href={query.data.url} target="_blank" rel="noreferrer">View</a></Button><Button asChild><a href={query.data.download ?? query.data.url}>Download</a></Button></div>{docket.mime_type === "application/pdf" ? <iframe title={docket.file_name || "Signed docket PDF"} src={query.data.url} className="w-full h-[60vh] border border-border" /> : <img src={query.data.url} alt={docket.file_name || "Signed docket"} className="w-full max-h-[60vh] object-contain" />}</>}
    {stop && <><div className="space-y-2"><p>{stop.site_name}</p><p>{stop.address}</p><p>{stop.customer_name} {stop.customer_role}</p><p>{stop.signature_notes}</p>{products?.lines?.map((line, i) => <p key={i}>{line.placa || "-"} · {line.product || "-"} · {line.litres == null ? "-" : `${line.litres} L`}</p>)}</div><div className="grid sm:grid-cols-2 gap-4">{[["Customer", stop.customer_signature], ["Driver", stop.driver_signature]].map(([name, image]) => <div key={name} className="border border-border rounded-md p-3"><p className="text-sm">{name}</p>{image ? <img src={image} alt={`${name} signature`} className="w-full h-28 object-contain" /> : <p className="text-muted-foreground">No signature</p>}</div>)}</div><Button variant="outline" onClick={() => window.print()}>Print</Button></>}
  </DialogContent></Dialog>;
}