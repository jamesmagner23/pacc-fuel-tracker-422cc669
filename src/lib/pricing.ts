/**
 * PACC unified pricing engine.
 * Single source of truth for Quote Builder + Price a Drop.
 *
 * Governing margin is % of SELL (true GP).
 * All prices inc GST (ratios are GST-invariant).
 */

export interface VolumeTier {
  label: string;
  minLitres: number;
  maxLitres: number | null; // exclusive upper bound; null = open
  targetGpPct: number;      // % of sell
  custom?: boolean;         // true = requires approval / manual
}

export const VOLUME_TIERS: VolumeTier[] = [
  { label: "0–500 L",         minLitres: 0,      maxLitres: 500,   targetGpPct: 26 },
  { label: "500–1,000 L",     minLitres: 500,    maxLitres: 1000,  targetGpPct: 23 },
  { label: "1,000–2,500 L",   minLitres: 1000,   maxLitres: 2500,  targetGpPct: 20 },
  { label: "2,500–5,000 L",   minLitres: 2500,   maxLitres: 5000,  targetGpPct: 17 },
  { label: "5,000–7,500 L",   minLitres: 5000,   maxLitres: 7500,  targetGpPct: 15 },
  { label: "7,500–10,000 L",  minLitres: 7500,   maxLitres: 10000, targetGpPct: 13 },
  { label: "10,000 L+",       minLitres: 10000,  maxLitres: null,  targetGpPct: 13, custom: true },
];

export const ABSOLUTE_FLOOR_PCT = 8;
export const HIGH_VOLUME_THRESHOLD = 2500;
export const OWNER_BCC_EMAIL = "jmagner@paccenergy.com";

export function tierForLitres(litres: number): VolumeTier {
  const l = Number.isFinite(litres) ? litres : 0;
  for (const t of VOLUME_TIERS) {
    if (l >= t.minLitres && (t.maxLitres === null || l < t.maxLitres)) return t;
  }
  return VOLUME_TIERS[VOLUME_TIERS.length - 1];
}

/** Payment-terms floor. Returns floor % of sell + behaviour. */
export interface TermFloorResult {
  floorPct: number;        // effective floor % of sell
  blocked: boolean;        // send is blocked entirely at this terms level
  warn: boolean;           // amber warning
  reason: string;
}

export function floorForTerms({
  litres,
  termsDays,
  tierTargetPct,
  clientEstablished,
}: {
  litres: number;
  termsDays: number | null | undefined;
  tierTargetPct: number;
  clientEstablished: boolean;
}): TermFloorResult {
  const t = termsDays ?? 21;
  // >21d: blocked
  if (t >= 45) {
    return { floorPct: tierTargetPct, blocked: true, warn: false, reason: "Beyond supply terms. Approval required." };
  }
  if (t >= 30) {
    return { floorPct: tierTargetPct, blocked: false, warn: true, reason: "Past cash-flow window. Call James before sending." };
  }
  if (t >= 21) {
    return { floorPct: tierTargetPct, blocked: false, warn: false, reason: "At tier target — cannot go below." };
  }
  // <21d unlocks thin floors ONLY on high volume + established client
  const highVol = litres >= HIGH_VOLUME_THRESHOLD;
  if (!highVol) {
    return { floorPct: tierTargetPct, blocked: false, warn: false, reason: "Below high-volume threshold — floor stays at tier target." };
  }
  if (!clientEstablished) {
    return { floorPct: tierTargetPct, blocked: false, warn: true, reason: "COD on first drops for new clients. Call James before dropping below tier." };
  }
  let floor: number;
  if (t >= 14) floor = 12;
  else if (t >= 7) floor = 10;
  else floor = 8; // COD / prepay
  return { floorPct: Math.max(floor, ABSOLUTE_FLOOR_PCT), blocked: false, warn: false, reason: `Cash-flow floor for ${t}d terms.` };
}

/** Compute sell price from a target GP % of sell. */
export function computeSellFromGpPct(buy: number, gpPct: number): number {
  if (!Number.isFinite(buy) || buy <= 0) return 0;
  const m = Math.min(Math.max(gpPct, 0), 99.9) / 100;
  return buy / (1 - m);
}

/** Compute sell price from cents/L over buy. */
export function computeSellFromCpl(buy: number, cpl: number): number {
  return buy + (cpl || 0) / 100;
}

export interface DerivedMetrics {
  gpPct: number;         // % of sell
  markupPct: number;     // % of buy
  cplMargin: number;     // cents per litre
  grossMargin$: number;
  contribution$: number; // GM$ minus truck cost
}

export function deriveMetrics({
  buy,
  sell,
  litres,
  truckCost = 0,
}: {
  buy: number;
  sell: number;
  litres: number;
  truckCost?: number;
}): DerivedMetrics {
  const cplL = sell - buy;
  const gpPct = sell > 0 ? ((sell - buy) / sell) * 100 : 0;
  const markupPct = buy > 0 ? ((sell - buy) / buy) * 100 : 0;
  const cplMargin = cplL * 100;
  const grossMargin$ = (litres || 0) * cplL;
  const contribution$ = grossMargin$ - (truckCost || 0);
  return { gpPct, markupPct, cplMargin, grossMargin$, contribution$ };
}

/** Validate a single line item (junk detection). */
export function validateLineItem({ buy, sell }: { buy: number; sell: number }): { ok: boolean; reason?: string } {
  if (!Number.isFinite(sell) || sell <= 0) return { ok: false, reason: "No sell price" };
  if (buy > 0 && sell < buy) return { ok: false, reason: "Below cost" };
  if (buy > 0 && sell > buy * 5) return { ok: false, reason: `Unit price > 5× buy ($${buy.toFixed(2)}) — likely junk` };
  return { ok: true };
}

export type PriceLevel = "green" | "amber" | "red" | "blocked";

export interface PriceStatus {
  level: PriceLevel;
  message: string;
  canSend: boolean;
  floorPct: number;
  tier: VolumeTier;
}

export function priceStatus({
  buy,
  sell,
  litres,
  termsDays,
  clientEstablished,
  isAdmin,
}: {
  buy: number;
  sell: number;
  litres: number;
  termsDays: number | null | undefined;
  clientEstablished: boolean;
  isAdmin: boolean;
}): PriceStatus {
  const tier = tierForLitres(litres);
  const term = floorForTerms({ litres, termsDays, tierTargetPct: tier.targetGpPct, clientEstablished });
  const metrics = deriveMetrics({ buy, sell, litres });

  // Custom volume ≥ 10,000 always requires admin
  if (tier.custom) {
    return {
      level: "blocked",
      message: "Custom volume (10,000 L+). Approval required — call James.",
      canSend: isAdmin, // admin can still choose to override manually
      floorPct: tier.targetGpPct,
      tier,
    };
  }

  if (term.blocked) {
    return { level: "blocked", message: term.reason, canSend: false, floorPct: term.floorPct, tier };
  }

  if (buy > 0 && sell < buy) {
    return { level: "red", message: "Below cost. Cannot send.", canSend: false, floorPct: term.floorPct, tier };
  }

  if (metrics.gpPct < ABSOLUTE_FLOOR_PCT) {
    return { level: "red", message: `Below absolute ${ABSOLUTE_FLOOR_PCT}% floor. Call James.`, canSend: false, floorPct: term.floorPct, tier };
  }

  if (metrics.gpPct + 0.01 < term.floorPct) {
    return {
      level: "red",
      message: `Below floor of ${term.floorPct.toFixed(0)}% GP for ${termsDays ?? 21}d terms. ${term.reason}`,
      canSend: false,
      floorPct: term.floorPct,
      tier,
    };
  }

  if (metrics.markupPct > 60) {
    return { level: "amber", message: "Above normal range — confirm before sending.", canSend: true, floorPct: term.floorPct, tier };
  }

  if (term.warn) {
    return { level: "amber", message: term.reason, canSend: true, floorPct: term.floorPct, tier };
  }

  return { level: "green", message: "OK to quote.", canSend: true, floorPct: term.floorPct, tier };
}

/** Clamp a user-typed target GP % up to the applicable floor. */
export function clampToFloor(targetGpPct: number, floorPct: number): { value: number; clamped: boolean } {
  const floor = Math.max(floorPct, ABSOLUTE_FLOOR_PCT);
  if (targetGpPct < floor) return { value: floor, clamped: true };
  return { value: targetGpPct, clamped: false };
}

export function fmtMoney0(n: number): string {
  return Number.isFinite(n) ? "$" + Math.round(n).toLocaleString("en-AU") : "$0";
}
export function fmtMoney2(n: number): string {
  return Number.isFinite(n) ? "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "$0.00";
}