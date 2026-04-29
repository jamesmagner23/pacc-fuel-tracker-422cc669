import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type ExportEmailPdfOptions = {
  html: string;
  filename: string;
};

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 10;
const EMAIL_WIDTH_PX = 600;

function safeFilename(name: string) {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "email-campaign";
}

function waitForFrameLoad(frame: HTMLIFrameElement) {
  return new Promise<void>((resolve) => {
    frame.onload = () => resolve();
    setTimeout(resolve, 750);
  });
}

export async function exportEmailHtmlToPdf({ html, filename }: ExportEmailPdfOptions) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.left = "-10000px";
  frame.style.top = "0";
  frame.style.width = `${EMAIL_WIDTH_PX}px`;
  frame.style.height = "1px";
  frame.style.border = "0";
  frame.style.background = "#ffffff";
  frame.srcdoc = html;
  document.body.appendChild(frame);

  try {
    await waitForFrameLoad(frame);
    const doc = frame.contentDocument;
    if (!doc?.body) throw new Error("Email preview could not be prepared for PDF export.");

    const body = doc.body;
    const contentWidth = Math.max(EMAIL_WIDTH_PX, body.scrollWidth, doc.documentElement.scrollWidth);
    const contentHeight = Math.max(body.scrollHeight, doc.documentElement.scrollHeight);
    frame.style.width = `${contentWidth}px`;
    frame.style.height = `${contentHeight}px`;

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const bodyRect = body.getBoundingClientRect();
    const links = Array.from(body.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .map((anchor) => {
        const rect = anchor.getBoundingClientRect();
        const href = anchor.href || anchor.getAttribute("href") || "";
        if (!href || rect.width <= 0 || rect.height <= 0) return null;
        return {
          href,
          x: rect.left - bodyRect.left,
          y: rect.top - bodyRect.top,
          width: rect.width,
          height: rect.height,
        };
      })
      .filter((link): link is NonNullable<typeof link> => Boolean(link));

    const canvas = await html2canvas(body, {
      backgroundColor: "#ffffff",
      scale: Math.min(2, window.devicePixelRatio || 2),
      useCORS: true,
      windowWidth: contentWidth,
      windowHeight: contentHeight,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const contentWidthMm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
    const contentHeightMm = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2;
    const imagePxToMm = contentWidthMm / canvas.width;
    const cssPxToMm = contentWidthMm / contentWidth;
    const imageHeightMm = canvas.height * imagePxToMm;
    const image = canvas.toDataURL("image/png");
    const pageCount = Math.max(1, Math.ceil(imageHeightMm / contentHeightMm));

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      if (pageIndex > 0) pdf.addPage();
      const offsetY = PAGE_MARGIN_MM - pageIndex * contentHeightMm;
      pdf.addImage(image, "PNG", PAGE_MARGIN_MM, offsetY, contentWidthMm, imageHeightMm);

      for (const link of links) {
        const x = PAGE_MARGIN_MM + link.x * cssPxToMm;
        const y = PAGE_MARGIN_MM + link.y * cssPxToMm - pageIndex * contentHeightMm;
        const width = link.width * cssPxToMm;
        const height = link.height * cssPxToMm;
        const visibleTop = Math.max(PAGE_MARGIN_MM, y);
        const visibleBottom = Math.min(A4_HEIGHT_MM - PAGE_MARGIN_MM, y + height);
        if (visibleBottom > visibleTop) {
          pdf.link(x, visibleTop, width, visibleBottom - visibleTop, { url: link.href });
        }
      }
    }

    pdf.save(`${safeFilename(filename)}.pdf`);
  } finally {
    frame.remove();
  }
}