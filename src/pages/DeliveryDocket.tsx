import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Printer, Share2, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Transaction } from "@/hooks/useTransactions";

export default function DeliveryDocket() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetch() {
      // First get the anchor transaction
      const { data: anchor, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", Number(id))
        .single();

      if (error || !anchor) {
        setLoading(false);
        return;
      }

      // Then find all related transactions: same date, client, truck/driver
      const { data: related } = await supabase
        .from("transactions")
        .select("*")
        .eq("date", anchor.date)
        .eq("nombre_cliente1", anchor.nombre_cliente1)
        .eq("estacion", anchor.estacion)
        .order("fecha", { ascending: true });

      setItems((related || [anchor]) as Transaction[]);
      setLoading(false);
    }
    if (id) fetch();
  }, [id]);

  const handlePrint = () => window.print();

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `Delivery Docket #${items[0]?.factura || items[0]?.id}`,
        url: window.location.href,
      });
    } else {
      handleCopyLink();
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (items.length === 0) return <div className="p-8 text-muted-foreground">Transaction not found.</div>;

  const primary = items[0];
  const docketUrl = window.location.href;
  const deliveryDate = format(parseISO(primary.fecha), "dd MMMM yyyy");
  const deliveryTime = format(parseISO(primary.fecha), "HH:mm");
  const totalLitres = items.reduce((sum, t) => sum + (t.cantidad || 0), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Action bar — hidden when printing */}
      <div className="flex items-center justify-between print:hidden">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex gap-2">
          <button onClick={handleCopyLink} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy Link"}
          </button>
          <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>

      {/* Docket card */}
      <div className="bg-white text-gray-900 rounded-xl shadow-lg p-8 print:shadow-none print:rounded-none print:p-6" id="docket">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 pb-6 mb-6">
          <div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#111", letterSpacing: "-0.02em" }}>
                PACC<span style={{ color: "#7C3AED", fontSize: 18 }}>®</span>
              </div>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#666", letterSpacing: "0.15em", marginTop: 3 }}>
                FUEL
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">On-Site Diesel Delivery</p>
          </div>
          <div className="text-right">
            <h1 className="text-lg font-bold text-gray-900">DELIVERY DOCKET</h1>
            <p className="text-sm text-gray-500 mt-1">#{primary.factura || primary.id}</p>
          </div>
        </div>

        {/* Delivery details grid */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Customer</h3>
            <p className="text-sm font-semibold text-gray-900">{primary.nombre_cliente1 || "—"}</p>
            {primary.identificador_cliente1 && <p className="text-xs text-gray-500 mt-0.5">ID: {primary.identificador_cliente1}</p>}
          </div>
          <div>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Delivery Location</h3>
            <p className="text-sm font-semibold text-gray-900">{primary.ciudad || "—"}</p>
          </div>
          <div>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Date</h3>
            <p className="text-sm font-semibold text-gray-900">{deliveryDate}</p>
            <p className="text-xs text-gray-500 mt-0.5">{deliveryTime}</p>
          </div>
          <div>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Truck / Driver</h3>
            <p className="text-sm font-semibold text-gray-900">{primary.estacion || "—"}</p>
            <p className="text-xs text-gray-500 mt-0.5">{primary.nombre_vendedor || "—"}</p>
          </div>
        </div>

        {/* Itemised delivery table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 w-8">#</th>
                <th className="px-4 py-3">Asset / Plant</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Litres</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t, i) => (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{t.placa || t.identificador_cliente1 || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-700">{t.producto || "Diesel"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900 tabular-nums">
                    {(t.cantidad || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total — {items.length} item{items.length !== 1 ? "s" : ""}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900 text-base tabular-nums">
                  {totalLitres.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Signature lines for print */}
        <div className="mt-10 grid grid-cols-2 gap-12 print:mt-16">
          <div>
            <div className="border-b border-gray-300 mb-1 h-8" />
            <p className="text-[10px] text-gray-400">Customer Signature</p>
          </div>
          <div>
            <div className="border-b border-gray-300 mb-1 h-8" />
            <p className="text-[10px] text-gray-400">Driver Signature</p>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <QRCodeSVG value={docketUrl} size={64} level="M" />
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Scan to verify</p>
              <p className="text-[9px] text-gray-400 mt-0.5">Digital docket verification</p>
            </div>
          </div>
          <p className="text-[9px] text-gray-300">Generated by PACC Fuel</p>
        </div>
      </div>
    </div>
  );
}
