import { format, subDays } from "date-fns";
import type { Transaction } from "@/hooks/useTransactions";
import type { BuyPrice } from "@/hooks/useBuyPrices";
import type { TerminalGatePrice } from "@/hooks/useTGPrices";
import type { CustomerPricing } from "@/hooks/useCustomerPricing";

const today = new Date();

// ── Helpers ──
const d = (daysAgo: number) => format(subDays(today, daysAgo), "yyyy-MM-dd");
const ts = (daysAgo: number, hour = 8) => {
  const dt = subDays(today, daysAgo);
  dt.setHours(hour, Math.floor(Math.random() * 60), 0);
  return dt.toISOString();
};
let txId = 90000;

const CUSTOMERS = [
  "Metro Construction Group",
  "Citywide Earthworks",
  "Peninsula Logistics",
  "Bayside Transport",
  "Southern Cross Mining",
  "Greenfield Agriculture",
  "Harbour Freight Co",
  "Westfield Plant Hire",
];

const DRIVERS = ["Jake Mitchell", "Sarah Chen", "Tom Bradley", "Liam Foster"];
const TRUCKS = ["BOWSR-01", "BOWSR-02", "BOWSR-03"];
const LOCATIONS = ["Dandenong", "Laverton", "Altona", "Epping", "Campbellfield", "Moorabbin"];
const PRODUCTS = ["Diesel"];

function randomBetween(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

// ── Transactions (last 65 days — covers current + previous period) ──
function generateTransactions(): Transaction[] {
  const txns: Transaction[] = [];
  for (let day = 0; day < 65; day++) {
    const deliveries = randomBetween(3, 8);
    for (let j = 0; j < deliveries; j++) {
      const qty = randomBetween(200, 2800);
      const ppu = 1.65 + Math.random() * 0.35;
      const total = qty * ppu;
      const customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
      const driver = DRIVERS[Math.floor(Math.random() * DRIVERS.length)];
      const truck = TRUCKS[Math.floor(Math.random() * TRUCKS.length)];
      const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
      const hour = randomBetween(5, 18);

      txns.push({
        id: txId++,
        fecha: ts(day, hour),
        date: d(day),
        estacion: location,
        nombre_flota: null,
        nombre_cliente1: customer,
        identificador_cliente1: null,
        ciudad: location,
        cantidad: qty,
        cantidad_neta: qty * 0.98,
        producto: PRODUCTS[0],
        nombre_vendedor: driver,
        placa: truck,
        totalizador_bruto: 50000 + txId * 100,
        factura: 10000 + txId,
        forma_de_pago: "Account",
        ppu: parseFloat(ppu.toFixed(4)),
        dinero_total: parseFloat(total.toFixed(2)),
        id_surtidor: 1,
        surtidor: "Pump 1",
        manguera: "Nozzle A",
      });
    }
  }
  return txns.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

// ── Buy Prices (last 60 days) ──
function generateBuyPrices(): BuyPrice[] {
  const prices: BuyPrice[] = [];
  let price = 1.42;
  for (let day = 59; day >= 0; day--) {
    price += (Math.random() - 0.48) * 0.03;
    price = Math.max(1.28, Math.min(1.65, price));
    prices.push({
      id: `bp-${day}`,
      price_date: d(day),
      price_per_litre: parseFloat(price.toFixed(4)),
      supplier: "Pacific",
      notes: null,
      created_at: ts(day),
    });
  }
  return prices.reverse();
}

// ── TGP (last 30 days) ──
function generateTGP(): TerminalGatePrice[] {
  const prices: TerminalGatePrice[] = [];
  let cpl = 155;
  for (let day = 29; day >= 0; day--) {
    cpl += (Math.random() - 0.48) * 2;
    cpl = Math.max(140, Math.min(170, cpl));
    prices.push({
      id: `tgp-${day}`,
      price_date: d(day),
      location: "Melbourne",
      product: "Diesel",
      price_cpl: parseFloat(cpl.toFixed(2)),
      price_per_litre: parseFloat((cpl / 100).toFixed(4)),
      source: "AIP",
      created_at: ts(day),
    });
  }
  return prices.reverse();
}

// ── Customer Pricing ──
function generateCustomerPricing(): CustomerPricing[] {
  const pricing: CustomerPricing[] = [];
  const clientIds = [1, 2, 3, 4, 5, 6, 7, 8];
  const margins = [12, 10, 8, 7, 9, 11, 6, 10];
  clientIds.forEach((id, i) => {
    pricing.push({
      id: `cp-${id}-1`,
      client_account_id: id,
      margin_percent: margins[i],
      payment_terms: i < 3 ? "7 days" : "30 days",
      weekly_volume_tier: "0-500",
      min_litres: 0,
      max_litres: 500,
      pricing_type: "margin",
      notes: null,
      created_at: ts(30),
      updated_at: ts(5),
    });
    pricing.push({
      id: `cp-${id}-2`,
      client_account_id: id,
      margin_percent: Math.max(5, margins[i] - 2),
      payment_terms: i < 3 ? "7 days" : "30 days",
      weekly_volume_tier: "500-1,000",
      min_litres: 500,
      max_litres: 1000,
      pricing_type: "margin",
      notes: null,
      created_at: ts(30),
      updated_at: ts(5),
    });
  });
  return pricing;
}

// ── Demo Users ──
export const DEMO_USERS = [
  { id: "u1", user_id: "u1", role: "admin", full_name: "Alex Morgan", email: "alex@demo.com", client_account_id: null, company_name: null },
  { id: "u2", user_id: "u2", role: "admin", full_name: "Jordan Lee", email: "jordan@demo.com", client_account_id: null, company_name: null },
  { id: "u3", user_id: "u3", role: "client", full_name: "Rachel Green", email: "rachel@metroconstruction.com", client_account_id: 1, company_name: "Metro Construction Group" },
  { id: "u4", user_id: "u4", role: "client", full_name: "David Kim", email: "david@citywideearth.com", client_account_id: 2, company_name: "Citywide Earthworks" },
  { id: "u5", user_id: "u5", role: "client", full_name: "Lisa Nguyen", email: "lisa@peninsulalogistics.com", client_account_id: 3, company_name: "Peninsula Logistics" },
  { id: "u6", user_id: "u6", role: "driver", full_name: "Jake Mitchell", email: "jake@driver.com", client_account_id: null, company_name: null },
  { id: "u7", user_id: "u7", role: "driver", full_name: "Sarah Chen", email: "sarah@driver.com", client_account_id: null, company_name: null },
  { id: "u8", user_id: "u8", role: "driver", full_name: "Tom Bradley", email: "tom@driver.com", client_account_id: null, company_name: null },
];

// ── Demo Activity ──
export const DEMO_ACTIVITY = [
  { id: "a1", user_id: "u1", action: "login", metadata: {}, created_at: ts(0, 8), full_name: "Alex Morgan", email: "alex@demo.com" },
  { id: "a2", user_id: "u6", action: "login", metadata: {}, created_at: ts(0, 6), full_name: "Jake Mitchell", email: "jake@driver.com" },
  { id: "a3", user_id: "u3", action: "login", metadata: {}, created_at: ts(0, 9), full_name: "Rachel Green", email: "rachel@metroconstruction.com" },
  { id: "a4", user_id: "u1", action: "export", metadata: { type: "transactions_csv" }, created_at: ts(1, 14), full_name: "Alex Morgan", email: "alex@demo.com" },
  { id: "a5", user_id: "u7", action: "login", metadata: {}, created_at: ts(1, 5), full_name: "Sarah Chen", email: "sarah@driver.com" },
  { id: "a6", user_id: "u4", action: "page_view", metadata: { page: "portal" }, created_at: ts(1, 10), full_name: "David Kim", email: "david@citywideearth.com" },
  { id: "a7", user_id: "u1", action: "login", metadata: {}, created_at: ts(2, 8), full_name: "Alex Morgan", email: "alex@demo.com" },
  { id: "a8", user_id: "u6", action: "login", metadata: {}, created_at: ts(2, 6), full_name: "Jake Mitchell", email: "jake@driver.com" },
  { id: "a9", user_id: "u2", action: "login", metadata: {}, created_at: ts(3, 9), full_name: "Jordan Lee", email: "jordan@demo.com" },
  { id: "a10", user_id: "u5", action: "login", metadata: {}, created_at: ts(3, 11), full_name: "Lisa Nguyen", email: "lisa@peninsulalogistics.com" },
  { id: "a11", user_id: "u1", action: "export", metadata: { type: "quote_pdf" }, created_at: ts(4, 15), full_name: "Alex Morgan", email: "alex@demo.com" },
  { id: "a12", user_id: "u8", action: "login", metadata: {}, created_at: ts(5, 5), full_name: "Tom Bradley", email: "tom@driver.com" },
];

// ── Demo Client Accounts ──
export const DEMO_CLIENT_ACCOUNTS = CUSTOMERS.map((name, i) => ({
  id: i + 1,
  company_name: name,
  contact_email: `accounts@${name.toLowerCase().replace(/\s+/g, "")}.com.au`,
  contact_name: DEMO_USERS.find(u => u.company_name === name)?.full_name || null,
  contact_phone: `04${randomBetween(10, 99)} ${randomBetween(100, 999)} ${randomBetween(100, 999)}`,
  speedsol_name: name,
  speedsol_names: [name],
  is_active: true,
  auth_user_id: null,
  created_at: ts(60),
  updated_at: ts(5),
}));

// ── Demo Sync Log ──
export const DEMO_SYNC_LOG = {
  id: 1,
  synced_at: ts(0, 7),
  status: "success",
  records_fetched: 156,
  records_upserted: 156,
  error_message: null,
};

// ── Demo Quotes ──
export const DEMO_QUOTES = [
  {
    id: "q1",
    customer_name: "Metro Construction Group",
    customer_email: "rachel@metroconstruction.com",
    customer_phone: "0412 345 678",
    volume_litres: 5000,
    buy_price_per_litre: 1.45,
    margin_percent: 10,
    sell_price_per_litre: 1.595,
    total_ex_gst: 7975,
    total_inc_gst: 8772.5,
    notes: "Weekly delivery to Dandenong site",
    status: "sent",
    sent_at: ts(2, 10),
    valid_until: d(-1),
    created_at: ts(3, 9),
  },
  {
    id: "q2",
    customer_name: "Greenfield Agriculture",
    customer_email: "ops@greenfieldagri.com",
    customer_phone: null,
    volume_litres: 8000,
    buy_price_per_litre: 1.43,
    margin_percent: 8,
    sell_price_per_litre: 1.5444,
    total_ex_gst: 12355.2,
    total_inc_gst: 13590.72,
    notes: "Harvest season — bi-weekly",
    status: "draft",
    sent_at: null,
    valid_until: d(0),
    created_at: ts(1, 14),
  },
];

// ── Demo Pricing Tiers ──
export const DEMO_PRICING_TIERS = [
  { id: "pt-1", tier_name: "Small", min_litres: 0, max_litres: 500, margin_percent: 12, created_at: ts(30) },
  { id: "pt-2", tier_name: "Medium", min_litres: 500, max_litres: 2000, margin_percent: 10, created_at: ts(30) },
  { id: "pt-3", tier_name: "Large", min_litres: 2000, max_litres: 5000, margin_percent: 8, created_at: ts(30) },
  { id: "pt-4", tier_name: "Bulk", min_litres: 5000, max_litres: null, margin_percent: 6, created_at: ts(30) },
];

// ── Demo Scheduled Deliveries ──
export const DEMO_SCHEDULED_DELIVERIES = [
  { id: "sd-1", client_account_id: 1, site_name: "Dandenong Depot", scheduled_date: d(-2), estimated_litres: 3000, notes: "Morning delivery", status: "scheduled", created_at: ts(1), client_accounts: { company_name: "Metro Construction Group" } },
  { id: "sd-2", client_account_id: 2, site_name: "Laverton Yard", scheduled_date: d(-3), estimated_litres: 2500, notes: null, status: "scheduled", created_at: ts(1), client_accounts: { company_name: "Citywide Earthworks" } },
  { id: "sd-3", client_account_id: 5, site_name: "Mine Site Alpha", scheduled_date: d(-5), estimated_litres: 8000, notes: "Access via Gate B", status: "scheduled", created_at: ts(2), client_accounts: { company_name: "Southern Cross Mining" } },
];

// ── Demo Pump Readings (last 14 days — closely track transaction totals) ──
function generatePumpReadingsFromTxns(txns: Transaction[]) {
  const readings: any[] = [];

  for (let day = 0; day < 14; day++) {
    const dateStr = d(day);
    // Sum actual transaction litres for this day
    const dayTxns = txns.filter(t => t.date === dateStr);
    const dayTotal = dayTxns.reduce((sum, t) => sum + (t.cantidad || 0), 0);
    if (dayTotal === 0) continue;

    // Split into 1-3 pump readings that sum close to the day total
    // Apply a small variance (-1.5% to +1.5%) to make it realistic
    const varianceFactor = 0.985 + Math.random() * 0.03; // 98.5% to 101.5%
    const adjustedTotal = Math.round(dayTotal * varianceFactor);
    const numReadings = randomBetween(1, 3);
    let remaining = adjustedTotal;

    for (let j = 0; j < numReadings; j++) {
      const isLast = j === numReadings - 1;
      const litres = isLast ? remaining : Math.round(remaining * (0.3 + Math.random() * 0.4));
      remaining -= litres;
      readings.push({
        id: `pr-${day}-${j}`,
        reading_date: dateStr,
        litres,
        driver_id: `u${randomBetween(6, 8)}`,
        notes: j === 0 && day % 3 === 0 ? "Morning fill at Pacific Dandenong" : null,
        created_at: ts(day, 6 + j * 4),
      });
    }
  }
  return readings;
}

// ── Demo Reconciliation Alerts ──
export const DEMO_RECON_ALERTS = [
  { id: "ra-1", alert_date: d(1), alert_type: "high_variance", values: { variance_pct: 1.1, variance_litres: 28 }, status: "new", suggested_action: "Check pump calibration", created_at: ts(1), resolved_at: null, resolved_by: null },
  { id: "ra-2", alert_date: d(3), alert_type: "missing_pump", values: { date: d(3) }, status: "new", suggested_action: "Request driver to submit reading", created_at: ts(3), resolved_at: null, resolved_by: null },
  { id: "ra-3", alert_date: d(7), alert_type: "unusual_volume", values: { volume: 5100, avg: 4200 }, status: "resolved", suggested_action: null, created_at: ts(7), resolved_at: ts(6), resolved_by: "u1" },
];

// ── Demo Recon Settings ──
export const DEMO_RECON_SETTINGS = {
  id: 1,
  variance_threshold_pct: 2,
  variance_threshold_litres: 50,
  alert_sensitivity: "medium",
  calibration_factor: 0,
  auto_weekly_report: true,
  report_email: "admin@paccfuel.com",
  updated_at: ts(5),
};

// ── Demo Fuel Intake Logs ──
export const DEMO_FUEL_INTAKE_LOGS = [
  { id: "fil-1", driver_user_id: "u6", litres_entered: 3200, log_date: d(0), photo_path: null, bowser_retail_price: 1.85, notes: "Pacific Dandenong", created_at: ts(0, 7) },
  { id: "fil-2", driver_user_id: "u6", litres_entered: 2800, log_date: d(0), photo_path: null, bowser_retail_price: 1.84, notes: "Altona terminal", created_at: ts(0, 14) },
];

// ── Export all generated data (memoize-friendly) ──
let _cache: ReturnType<typeof _generate> | null = null;

function _generate() {
  const transactions = generateTransactions();
  return {
    transactions,
    buyPrices: generateBuyPrices(),
    tgp: generateTGP(),
    customerPricing: generateCustomerPricing(),
    pumpReadings: generatePumpReadingsFromTxns(transactions),
  };
}

export function getDemoData() {
  if (!_cache) _cache = _generate();
  return _cache;
}
