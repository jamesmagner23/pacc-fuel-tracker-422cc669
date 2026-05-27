/**
 * Stylized brand-correct wordmarks for the trusted-by marquee.
 * Each mark is an inline SVG so it scales crisply on any background.
 * Colors and letterforms are tuned to match each company's public brand
 * identity (palette + weight + spacing), kept monochrome-friendly where
 * appropriate. Not affiliated logos — visual references for the partner strip.
 */

type LogoProps = { className?: string };

const H = 28; // baseline mark height in px; marquee scales via className

export function CoatesMark({ className }: LogoProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: H,
        padding: "0 14px",
        background: "#F26522",
        color: "#ffffff",
        borderRadius: 4,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontWeight: 800,
        fontSize: 18,
        letterSpacing: "-0.01em",
        fontStyle: "italic",
      }}
    >
      Coates
    </span>
  );
}

export function KellerMark({ className }: LogoProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: H,
        color: "#003473",
        fontFamily: "'Inter', system-ui, sans-serif",
        fontWeight: 800,
        fontSize: 20,
        letterSpacing: "0.02em",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <polygon points="0,4 8,11 0,18" fill="#FFC524" />
        <polygon points="9,4 17,11 9,18" fill="#003473" />
      </svg>
      KELLER
    </span>
  );
}

export function FultonHoganMark({ className }: LogoProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: H,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: 18,
        letterSpacing: "-0.01em",
      }}
    >
      <span style={{ color: "#EE7203" }}>Fulton</span>
      <span style={{ color: "#5B6770", marginLeft: 6 }}>Hogan</span>
    </span>
  );
}

export function IronsideMark({ className }: LogoProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: H,
        color: "#1F1F1F",
        fontFamily: "'Inter', system-ui, sans-serif",
        fontWeight: 300,
        fontSize: 19,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
      }}
    >
      Ironside
    </span>
  );
}

export function JustTrackMark({ className }: LogoProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: H,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontWeight: 900,
        fontSize: 18,
        letterSpacing: "-0.01em",
        textTransform: "uppercase",
      }}
    >
      <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden>
        <rect x="0" y="2" width="22" height="2" fill="#C8102E" />
        <rect x="0" y="10" width="22" height="2" fill="#C8102E" />
        <rect x="3" y="0" width="2" height="14" fill="#1F1F1F" />
        <rect x="10" y="0" width="2" height="14" fill="#1F1F1F" />
        <rect x="17" y="0" width="2" height="14" fill="#1F1F1F" />
      </svg>
      <span style={{ color: "#C8102E" }}>Just</span>
      <span style={{ color: "#1F1F1F" }}>Track</span>
    </span>
  );
}

export function GearonMark({ className }: LogoProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: H,
        color: "#0B2A4A",
        fontFamily: "'Inter', system-ui, sans-serif",
        fontWeight: 800,
        fontSize: 19,
        letterSpacing: "-0.01em",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r="9" fill="none" stroke="#0B2A4A" strokeWidth="2" />
        <path d="M10 4 v6 h5" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Gearon
    </span>
  );
}

export const CLIENT_LOGOS = [
  { name: "Ironside", Mark: IronsideMark },
  { name: "Just Track", Mark: JustTrackMark },
  { name: "Keller", Mark: KellerMark },
  { name: "Coates", Mark: CoatesMark },
  { name: "Fulton Hogan", Mark: FultonHoganMark },
  { name: "Gearon", Mark: GearonMark },
] as const;