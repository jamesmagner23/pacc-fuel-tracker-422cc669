import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Printer, Share2, Copy, Check, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Transaction } from "@/hooks/useTransactions";
import { useDemo } from "@/hooks/useDemo";
import { getDemoData } from "@/data/demoData";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function DeliveryDocket() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const isDemo = useDemo();

  // Support both single docket (/docket/123) and multi (/docket/multi?ids=1,2,3)
  const isMulti = id === "multi";
  const multiIds = useMemo(() => {
    const raw = searchParams.get("ids") || "";
    return raw.split(",").map(Number).filter(Boolean);
  }, [searchParams]);

  useEffect(() => {
    if (isDemo) {
      const allTxns = getDemoData().transactions;
      if (isMulti) {
        const found = allTxns.filter(t => multiIds.includes(t.id));
        setItems(found.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()));
      } else if (id) {
        const anchor = allTxns.find(t => t.id === Number(id));
        if (anchor) {
          const related = allTxns.filter(
            t => t.date === anchor.date && t.nombre_cliente1 === anchor.nombre_cliente1 && t.estacion === anchor.estacion
          ).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
          setItems(related.length > 0 ? related : [anchor]);
        }
      }
      setLoading(false);
      return;
    }

    async function fetchDocket() {
      try {
        const qs = isMulti
          ? `ids=${encodeURIComponent(multiIds.join(","))}`
          : `id=${encodeURIComponent(String(id))}`;
        const { data, error } = await supabase.functions.invoke(`get-docket?${qs}`, {
          method: "GET",
        });
        if (!error && data?.items) setItems(data.items as Transaction[]);
      } finally {
        setLoading(false);
      }
    }

    fetchDocket();
  }, [id, isMulti, multiIds, isDemo]);

  const handlePrint = () => window.print();

  const handleThermalPrint = () => {
    const root = document.getElementById("docket-root");
    if (root) root.classList.add("thermal-print");
    setTimeout(() => {
      window.print();
      root?.classList.remove("thermal-print");
    }, 100);
  };

  const handleDownloadPDF = async () => {
    const el = document.getElementById("docket");
    if (!el) return;
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH - margin * 2) {
      pdf.addImage(imgData, "PNG", margin, margin, imgW, imgH);
    } else {
      // Multi-page: slice the canvas
      const pageHeightPx = ((pageH - margin * 2) * canvas.width) / imgW;
      let renderedHeight = 0;
      while (renderedHeight < canvas.height) {
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(pageHeightPx, canvas.height - renderedHeight);
        const ctx = sliceCanvas.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, renderedHeight, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
        const sliceData = sliceCanvas.toDataURL("image/png");
        const sliceH = (sliceCanvas.height * imgW) / canvas.width;
        if (renderedHeight > 0) pdf.addPage();
        pdf.addImage(sliceData, "PNG", margin, margin, imgW, sliceH);
        renderedHeight += sliceCanvas.height;
      }
    }

    const dateStr = items[0] ? format(parseISO(items[0].fecha), "yyyy-MM-dd") : "docket";
    const client = (items[0]?.nombre_cliente1 || "PACC").replace(/[^a-z0-9]+/gi, "-");
    pdf.save(`docket-${client}-${dateStr}.pdf`);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `Delivery Docket — ${items[0]?.nombre_cliente1 || "PACC Fuel"}`,
        url: window.location.href,
      });
    } else {
      handleCopyLink();
    }
  };

  // Auto-download PDF on first load (once items have rendered)
  const [autoDownloaded, setAutoDownloaded] = useState(false);
  useEffect(() => {
    if (!loading && items.length > 0 && !autoDownloaded) {
      const t = setTimeout(() => {
        handleDownloadPDF();
        setAutoDownloaded(true);
      }, 600); // wait for fonts/QR to render
      return () => clearTimeout(t);
    }
  }, [loading, items, autoDownloaded]);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (items.length === 0) return <div className="p-8 text-muted-foreground">Transaction not found.</div>;

  const primary = items[0];
  const docketUrl = window.location.href;
  const deliveryDate = format(parseISO(primary.fecha), "dd MMMM yyyy");
  const deliveryTime = format(parseISO(primary.fecha), "HH:mm");
  const totalLitres = items.reduce((sum, t) => sum + (t.cantidad || 0), 0);

  // For multi-select dockets spanning multiple dates, show the range
  const lastItem = items[items.length - 1];
  const lastDate = format(parseISO(lastItem.fecha), "dd MMMM yyyy");
  const isDateRange = deliveryDate !== lastDate;

  return (
    <div id="docket-root" className="max-w-2xl mx-auto space-y-4 min-h-screen bg-white p-4 sm:p-6" style={{ background: "#fff" }}>
      {/* Action bar — hidden when printing */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleCopyLink} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy Link"}
          </button>
          <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
          <button onClick={handleThermalPrint} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
            <Printer className="w-3.5 h-3.5" /> Receipt
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button onClick={handleDownloadPDF} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            <Download className="w-3.5 h-3.5" /> Download PDF
          </button>
        </div>
      </div>

      {/* Docket card — optimised for single-page print */}
      <div className="bg-white text-gray-900 rounded-xl shadow-lg p-6 sm:p-8 print:shadow-none print:rounded-none print:p-4 print:text-[11px]" id="docket">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 pb-4 mb-4 print:pb-3 print:mb-3">
           <div>
            <div style={{ lineHeight: 1, display: "flex", alignItems: "baseline", gap: 6 }}>
              {isDemo ? (
                <>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#111", letterSpacing: "-0.02em" }}>
                    FUEL<span style={{ color: "#3B82F6" }}>TRACK</span>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#666", letterSpacing: "0.15em" }}>
                    DIESEL
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#111", letterSpacing: "-0.02em" }}>
                    PACC<span style={{ color: "#7BA428", fontSize: 14 }}>®</span>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6B6356", letterSpacing: "0.2em" }}>
                    FUEL
                  </div>
                </>
              )}
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">On-Site Diesel Delivery</p>
          </div>
          <div className="text-right">
            <h1 className="text-base font-bold text-gray-900 print:text-sm">DELIVERY DOCKET</h1>
            <p className="text-xs text-gray-500 mt-0.5">#{primary.factura || primary.id}</p>
          </div>
        </div>

        {/* Delivery details grid */}
        <div className="grid grid-cols-2 gap-4 mb-5 print:gap-3 print:mb-4">
          <div>
            <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Customer</h3>
            <p className="text-sm font-semibold text-gray-900 print:text-xs">{primary.nombre_cliente1 || "—"}</p>
            {primary.identificador_cliente1 && <p className="text-[10px] text-gray-500 mt-0.5">ID: {primary.identificador_cliente1}</p>}
          </div>
          <div>
            <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Delivery Location</h3>
            <p className="text-sm font-semibold text-gray-900 print:text-xs">{primary.ciudad || "—"}</p>
          </div>
          <div>
            <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Date</h3>
            <p className="text-sm font-semibold text-gray-900 print:text-xs">
              {isDateRange ? `${format(parseISO(primary.fecha), "dd MMM")} — ${format(parseISO(lastItem.fecha), "dd MMM yyyy")}` : deliveryDate}
            </p>
            {!isDateRange && <p className="text-[10px] text-gray-500 mt-0.5">{deliveryTime}</p>}
          </div>
          <div>
            <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Truck / Driver</h3>
            <p className="text-sm font-semibold text-gray-900 print:text-xs">{primary.estacion || "—"}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{primary.nombre_vendedor || "—"}</p>
          </div>
        </div>

        {/* Itemised delivery table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-5 print:mb-4 print:break-inside-avoid">
          <table className="w-full text-sm print:text-[11px]">
            <thead>
              <tr className="bg-gray-50 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-3 py-2 w-7 print:px-2 print:py-1.5">#</th>
                <th className="px-3 py-2 print:px-2 print:py-1.5">Asset / Plant</th>
                <th className="px-3 py-2 print:px-2 print:py-1.5">Product</th>
                {isDateRange && <th className="px-3 py-2 print:px-2 print:py-1.5">Date</th>}
                <th className="px-3 py-2 text-right print:px-2 print:py-1.5">Litres</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t, i) => (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-400 text-xs print:px-2 print:py-1">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-gray-900 print:px-2 print:py-1">{t.placa || t.identificador_cliente1 || "—"}</td>
                  <td className="px-3 py-2 text-gray-700 print:px-2 print:py-1">{t.producto || "Diesel"}</td>
                  {isDateRange && <td className="px-3 py-2 text-gray-600 text-xs print:px-2 print:py-1">{format(parseISO(t.fecha), "dd MMM")}</td>}
                  <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums print:px-2 print:py-1">
                    {(t.cantidad || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td colSpan={isDateRange ? 4 : 3} className="px-3 py-2.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wider print:px-2 print:py-1.5">
                  Total — {items.length} item{items.length !== 1 ? "s" : ""}
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-gray-900 tabular-nums print:px-2 print:py-1.5">
                  {totalLitres.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes / on-site remarks */}
        <div className="mb-4 print:mb-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Notes / On-Site Remarks</h3>
          </div>
          <div className="border border-gray-200 rounded-lg h-16 print:h-14" />
        </div>

        {/* Signature lines */}
        <div className="grid grid-cols-2 gap-10 mt-6 print:mt-4 print:gap-8 print:break-inside-avoid">
          <div>
            <div className="border-b border-gray-300 mb-1 h-6 print:h-5" />
            <p className="text-[9px] text-gray-400">Customer Signature</p>
          </div>
          <div>
            <div className="border-b border-gray-300 mb-1 h-6 print:h-5" />
            <p className="text-[9px] text-gray-400">Driver Signature</p>
          </div>
        </div>

        {/* QR Code footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 print:mt-3 print:pt-2">
          <div className="flex items-center gap-2">
            <QRCodeSVG value={docketUrl} size={48} level="M" className="print:w-10 print:h-10" />
            <div>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Scan to verify</p>
              <p className="text-[8px] text-gray-400 mt-0.5">Digital docket verification</p>
            </div>
          </div>
          <p className="text-[8px] text-gray-300">{isDemo ? "Generated by FuelTrack" : "Generated by PACC Fuel"}</p>
        </div>
      </div>
    </div>
  );
}
