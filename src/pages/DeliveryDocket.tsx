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
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", Number(id))
        .single();
      if (!error && data) setTxn(data as Transaction);
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
        title: `Delivery Docket #${txn?.factura || txn?.id}`,
        url: window.location.href,
      });
    } else {
      handleCopyLink();
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!txn) return <div className="p-8 text-muted-foreground">Transaction not found.</div>;

  const deliveryDate = format(parseISO(txn.fecha), "dd MMMM yyyy");
  const deliveryTime = format(parseISO(txn.fecha), "HH:mm");

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
            <p className="text-sm text-gray-500 mt-1">#{txn.factura || txn.id}</p>
          </div>
        </div>

        {/* Delivery details grid */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Customer</h3>
            <p className="text-sm font-semibold text-gray-900">{txn.nombre_cliente1 || "—"}</p>
            {txn.identificador_cliente1 && <p className="text-xs text-gray-500 mt-0.5">ID: {txn.identificador_cliente1}</p>}
          </div>
          <div>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Delivery Location</h3>
            <p className="text-sm font-semibold text-gray-900">{txn.ciudad || "—"}</p>
            {(txn as any).region && <p className="text-xs text-gray-500 mt-0.5">{(txn as any).region}</p>}
          </div>
          <div>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Date</h3>
            <p className="text-sm font-semibold text-gray-900">{deliveryDate}</p>
            <p className="text-xs text-gray-500 mt-0.5">{deliveryTime}</p>
          </div>
          <div>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Truck / Driver</h3>
            <p className="text-sm font-semibold text-gray-900">{txn.estacion || "—"}</p>
            <p className="text-xs text-gray-500 mt-0.5">{txn.nombre_vendedor || "—"}</p>
          </div>
        </div>

        {/* Product table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Litres</th>
                <th className="px-4 py-3 text-right">Price/L</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-900">{txn.producto || "Diesel"}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{(txn.cantidad || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-gray-700">${(txn.ppu || 0).toFixed(4)}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">${(txn.dinero_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Meter readings */}
        {txn.totalizador_bruto != null && (
          <div className="bg-gray-50 rounded-lg p-4 mb-8">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Meter Reading</h3>
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-gray-500">Totaliser (Gross)</p>
                <p className="text-sm font-semibold text-gray-900">{txn.totalizador_bruto.toLocaleString()}</p>
              </div>
              {txn.cantidad_neta != null && (
                <div>
                  <p className="text-xs text-gray-500">Net Quantity</p>
                  <p className="text-sm font-semibold text-gray-900">{txn.cantidad_neta.toLocaleString()}</p>
                </div>
              )}
              {txn.surtidor && (
                <div>
                  <p className="text-xs text-gray-500">Dispenser</p>
                  <p className="text-sm font-semibold text-gray-900">{txn.surtidor}{txn.manguera ? ` / ${txn.manguera}` : ""}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-6 flex items-end justify-between">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Payment Method</p>
            <p className="text-sm text-gray-700">{txn.forma_de_pago || "Account"}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Amount Due</p>
            <p className="text-2xl font-bold text-gray-900">${(txn.dinero_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
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

        <p className="text-center text-[9px] text-gray-300 mt-8">Generated by PACC Fuel · pacc-fuel-tracker.lovable.app</p>
      </div>
    </div>
  );
}
