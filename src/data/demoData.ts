import { format, subDays } from "date-fns";
import type { Transaction } from "@/hooks/useTransactions";
import type { BuyPrice } from "@/hooks/useBuyPrices";
import type { TerminalGatePrice } from "@/hooks/useTGPrices";
import type { CustomerPricing } from "@/hooks/useCustomerPricing";
import type { PlantItem } from "@/hooks/usePlantItems";
import type { Project, ProjectAssignment } from "@/hooks/useProjects";
import type { FtcRate } from "@/hooks/useFtcRates";
import type { PlantTag, PlantItemTag } from "@/hooks/usePlantTags";

const today = new Date();
const d = (daysAgo: number) => format(subDays(today, daysAgo), "yyyy-MM-dd");
const ts = (daysAgo: number, hour = 8) => {
  const dt = subDays(today, daysAgo);
  dt.setHours(hour, Math.floor(Math.random() * 60), 0);
  return dt.toISOString();
};
let txId = 90000;
function rand(min: number, max: number) { return Math.round(min + Math.random() * (max - min)); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── Customers ───────────────────────────────────────────────────────
// Showcase = Kelly Excavation (~20,000 L/month). Metro Cranes (~10,000 L/mo).
// Extra companies kept small for admin-side breadth.
const CUSTOMERS = [
  "Kelly Excavation",       // 1 — showcase, ~20k L/mo
  "Metro Cranes",           // 2 — ~10k L/mo
  "Citywide Earthworks",    // 3
  "Peninsula Logistics",    // 4
  "Bayside Transport",      // 5
  "Southern Cross Mining",  // 6
  "Greenfield Agriculture", // 7
  "Harbour Freight Co",     // 8
  "Westfield Plant Hire",   // 9
  "Oakridge Civil",         // 10
  "Murray Valley Haulage",  // 11
  "Pacific Drilling",       // 12
];

const DRIVERS = ["Jake Mitchell", "Sarah Chen", "Tom Bradley", "Liam Foster", "Nick Russo"];
const TRUCKS = ["BOWSR-01", "BOWSR-02", "BOWSR-03", "BOWSR-04"];
const LOCATIONS = ["Dandenong", "Laverton", "Altona", "Epping", "Campbellfield", "Moorabbin"];

// ─── FTC Rates (mirrors prod ftc_rates table) ────────────────────────
export const DEMO_FTC_RATES: FtcRate[] = [
  { id: "ftc-offroad", equipment_type: "Machinery & Plant (off-road)",          rate_per_litre: 0.496, effective_from: d(120), display_order: 1, notes: null },
  { id: "ftc-genset",  equipment_type: "Diesel Generators",                      rate_per_litre: 0.496, effective_from: d(120), display_order: 2, notes: null },
  { id: "ftc-heavy",   equipment_type: "Heavy Vehicles on public road (>4.5t)",  rate_per_litre: 0.204, effective_from: d(120), display_order: 3, notes: null },
  { id: "ftc-light",   equipment_type: "Light Vehicles",                          rate_per_litre: 0.000, effective_from: d(120), display_order: 4, notes: null },
];

// ─── Projects ────────────────────────────────────────────────────────
// Kelly Excavation: 3 projects. Metro Cranes: 2 projects.
export const DEMO_PROJECTS: Project[] = [
  // Kelly (client_account_id 1)
  { id: "prj-kelly-1", client_account_id: 1, name: "Mt Atkinson Subdivision",  site_address: "Mt Atkinson, VIC",  start_date: d(80), end_date: null, status: "active", notes: null, created_at: ts(80), updated_at: ts(2) },
  { id: "prj-kelly-2", client_account_id: 1, name: "Cranbourne East Stage 4",   site_address: "Cranbourne East, VIC", start_date: d(60), end_date: null, status: "active", notes: null, created_at: ts(60), updated_at: ts(2) },
  { id: "prj-kelly-3", client_account_id: 1, name: "Pakenham Industrial Pad",   site_address: "Pakenham, VIC",     start_date: d(40), end_date: null, status: "active", notes: null, created_at: ts(40), updated_at: ts(2) },
  // Metro Cranes (client_account_id 2)
  { id: "prj-metro-1", client_account_id: 2, name: "Docklands Tower 2 Lift",    site_address: "Docklands, VIC",    start_date: d(70), end_date: null, status: "active", notes: null, created_at: ts(70), updated_at: ts(2) },
  { id: "prj-metro-2", client_account_id: 2, name: "Box Hill Civic Build",      site_address: "Box Hill, VIC",     start_date: d(50), end_date: null, status: "active", notes: null, created_at: ts(50), updated_at: ts(2) },
];

// ─── Plant Items ─────────────────────────────────────────────────────
// Each item has a unique placa that the transactions will reference.
export const DEMO_PLANT_ITEMS: PlantItem[] = [
  // ── Kelly Excavation fleet ──
  { id: "pi-k-pc220",   client_account_id: 1, placa: "PC220",     name: "Komatsu PC220 (22t Excavator)", equipment_type: "Excavator",       serial_number: "PC220-8847", description: null, photo_url: null, service_notes: null, is_active: true, ftc_rate_id: "ftc-offroad", manufacturer: "Komatsu",  model: "PC220-8",   size: "22t", tank_size_litres: 410, colour: "#f5c518", created_at: ts(80), updated_at: ts(5) },
  { id: "pi-k-sh235",   client_account_id: 1, placa: "SH235",     name: "Sumitomo SH235 (24t Excavator)", equipment_type: "Excavator",      serial_number: "SH235-2241", description: null, photo_url: null, service_notes: null, is_active: true, ftc_rate_id: "ftc-offroad", manufacturer: "Sumitomo", model: "SH235X-7",  size: "24t", tank_size_litres: 430, colour: "#e85d1e", created_at: ts(80), updated_at: ts(5) },
  { id: "pi-k-sh135",   client_account_id: 1, placa: "SH135",     name: "Sumitomo SH135 (15t Excavator)", equipment_type: "Excavator",      serial_number: "SH135-1108", description: null, photo_url: null, service_notes: null, is_active: true, ftc_rate_id: "ftc-offroad", manufacturer: "Sumitomo", model: "SH135X-7",  size: "15t", tank_size_litres: 240, colour: "#c84a14", created_at: ts(80), updated_at: ts(5) },
  { id: "pi-k-svl75",   client_account_id: 1, placa: "SVL75",     name: "Kubota SVL75 Posi-Track",        equipment_type: "Track Loader",   serial_number: "SVL75-9930", description: null, photo_url: null, service_notes: null, is_active: true, ftc_rate_id: "ftc-offroad", manufacturer: "Kubota",   model: "SVL75-2",   size: "3.5t", tank_size_litres: 95,  colour: "#ff7a00", created_at: ts(80), updated_at: ts(5) },
  { id: "pi-k-tipper",  client_account_id: 1, placa: "1KE-3JT",   name: "3-Tonne Tipper",                 equipment_type: "Heavy Vehicle",  serial_number: null,         description: null, photo_url: null, service_notes: null, is_active: true, ftc_rate_id: "ftc-heavy",  manufacturer: "Isuzu",    model: "NPR 75-190", size: "3t", tank_size_litres: 100, colour: "#5e8a3a", created_at: ts(80), updated_at: ts(5) },
  { id: "pi-k-hilux1",  client_account_id: 1, placa: "1KX-7AR",   name: "Toyota Hilux Work Ute (Crew 1)", equipment_type: "Light Vehicle",  serial_number: null,         description: null, photo_url: null, service_notes: null, is_active: true, ftc_rate_id: "ftc-light",  manufacturer: "Toyota",   model: "Hilux SR",  size: "ute", tank_size_litres: 80, colour: "#ffffff", created_at: ts(80), updated_at: ts(5) },
  { id: "pi-k-hilux2",  client_account_id: 1, placa: "1KX-9PB",   name: "Toyota Hilux Work Ute (Crew 2)", equipment_type: "Light Vehicle",  serial_number: null,         description: null, photo_url: null, service_notes: null, is_active: true, ftc_rate_id: "ftc-light",  manufacturer: "Toyota",   model: "Hilux SR",  size: "ute", tank_size_litres: 80, colour: "#dddddd", created_at: ts(80), updated_at: ts(5) },
  { id: "pi-k-tank",    client_account_id: 1, placa: "YT-001",    name: "Yard Tank YT-001 (10,000L)",     equipment_type: "Static Tank",    serial_number: "YT-001",     description: null, photo_url: null, service_notes: "Bunded — yard refuel", is_active: true, ftc_rate_id: "ftc-offroad", manufacturer: null, model: null, size: "10,000L", tank_size_litres: 10000, colour: "#0E1F10", created_at: ts(80), updated_at: ts(5) },

  // ── Metro Cranes fleet ──
  { id: "pi-m-tc1",   client_account_id: 2, placa: "TC-A1",      name: "Tower Crane #1 (Liebherr 280EC-H)", equipment_type: "Tower Crane",    serial_number: "LBH-280-001", description: null, photo_url: null, service_notes: null, is_active: true, ftc_rate_id: "ftc-genset",  manufacturer: "Liebherr", model: "280EC-H 12", size: "280t/m", tank_size_litres: 200, colour: "#e85d1e", created_at: ts(70), updated_at: ts(5) },
  { id: "pi-m-tc2",   client_account_id: 2, placa: "TC-B2",      name: "Tower Crane #2 (Potain MDT 219)",    equipment_type: "Tower Crane",   serial_number: "PTN-MDT-002", description: null, photo_url: null, service_notes: null, is_active: true, ftc_rate_id: "ftc-genset",  manufacturer: "Potain",   model: "MDT 219",     size: "10t",    tank_size_litres: 200, colour: "#c84a14", created_at: ts(70), updated_at: ts(5) },
  { id: "pi-m-gen",   client_account_id: 2, placa: "GEN-150",    name: "150 kVA Site Generator",             equipment_type: "Generator",     serial_number: "FG-Wilson-150", description: null, photo_url: null, service_notes: null, is_active: true, ftc_rate_id: "ftc-genset",  manufacturer: "FG Wilson", model: "P165-3", size: "150 kVA", tank_size_litres: 410, colour: "#ff7a00", created_at: ts(70), updated_at: ts(5) },
  { id: "pi-m-franna", client_account_id: 2, placa: "FRN-25",    name: "Franna AT-25 Pick & Carry Crane",    equipment_type: "Mobile Crane",  serial_number: "FRN-AT25-04", description: null, photo_url: null, service_notes: null, is_active: true, ftc_rate_id: "ftc-heavy",   manufacturer: "Franna",   model: "AT-25",       size: "25t",     tank_size_litres: 240, colour: "#f5c518", created_at: ts(70), updated_at: ts(5) },
];

// ─── Project Assignments (active only — no removed_at) ───────────────
export const DEMO_PROJECT_ASSIGNMENTS: ProjectAssignment[] = [
  // Kelly — Mt Atkinson: PC220, SH235, hilux1
  { id: "pa-1",  project_id: "prj-kelly-1", plant_item_id: "pi-k-pc220",  assigned_at: ts(80), removed_at: null },
  { id: "pa-2",  project_id: "prj-kelly-1", plant_item_id: "pi-k-sh235",  assigned_at: ts(80), removed_at: null },
  { id: "pa-3",  project_id: "prj-kelly-1", plant_item_id: "pi-k-hilux1", assigned_at: ts(80), removed_at: null },
  // Kelly — Cranbourne: SH135, SVL75, tipper, hilux2
  { id: "pa-4",  project_id: "prj-kelly-2", plant_item_id: "pi-k-sh135",  assigned_at: ts(60), removed_at: null },
  { id: "pa-5",  project_id: "prj-kelly-2", plant_item_id: "pi-k-svl75",  assigned_at: ts(60), removed_at: null },
  { id: "pa-6",  project_id: "prj-kelly-2", plant_item_id: "pi-k-tipper", assigned_at: ts(60), removed_at: null },
  { id: "pa-7",  project_id: "prj-kelly-2", plant_item_id: "pi-k-hilux2", assigned_at: ts(60), removed_at: null },
  // Kelly — Pakenham: yard tank only (depot)
  { id: "pa-8",  project_id: "prj-kelly-3", plant_item_id: "pi-k-tank",   assigned_at: ts(40), removed_at: null },
  // Metro — Docklands: TC1, TC2, gen
  { id: "pa-9",  project_id: "prj-metro-1", plant_item_id: "pi-m-tc1",    assigned_at: ts(70), removed_at: null },
  { id: "pa-10", project_id: "prj-metro-1", plant_item_id: "pi-m-tc2",    assigned_at: ts(70), removed_at: null },
  { id: "pa-11", project_id: "prj-metro-1", plant_item_id: "pi-m-gen",    assigned_at: ts(70), removed_at: null },
  // Metro — Box Hill: Franna
  { id: "pa-12", project_id: "prj-metro-2", plant_item_id: "pi-m-franna", assigned_at: ts(50), removed_at: null },
];

// ─── Plant Tags ──────────────────────────────────────────────────────
export const DEMO_PLANT_TAGS: PlantTag[] = [
  { id: "tag-priority", client_account_id: 1, name: "High-priority",  colour: "#e85d1e" },
  { id: "tag-service",  client_account_id: 1, name: "Service due",    colour: "#c0392b" },
  { id: "tag-yard",     client_account_id: 1, name: "Yard refuel",    colour: "#0E1F10" },
  { id: "tag-jib",      client_account_id: 2, name: "Jib lift ready", colour: "#e85d1e" },
  { id: "tag-night",    client_account_id: 2, name: "Night shift",    colour: "#0f8a5e" },
];

export const DEMO_PLANT_ITEM_TAGS: PlantItemTag[] = [
  { plant_item_id: "pi-k-pc220",   tag_id: "tag-priority" },
  { plant_item_id: "pi-k-pc220",   tag_id: "tag-service" },
  { plant_item_id: "pi-k-sh235",   tag_id: "tag-priority" },
  { plant_item_id: "pi-k-tank",    tag_id: "tag-yard" },
  { plant_item_id: "pi-m-tc1",     tag_id: "tag-jib" },
  { plant_item_id: "pi-m-tc2",     tag_id: "tag-jib" },
  { plant_item_id: "pi-m-gen",     tag_id: "tag-night" },
];

// ─── Per-plant monthly fuel usage profile (litres/month, target) ─────
// Kelly = 20,000 L/mo total. Metro Cranes = 10,000 L/mo total.
const PLANT_PROFILE: Record<string, { customer: string; monthlyL: number; perDeliveryMin: number; perDeliveryMax: number; depotOnly?: boolean }> = {
  // Kelly (sums to 20,000 L/mo)
  "PC220":   { customer: "Kelly Excavation", monthlyL: 4800, perDeliveryMin: 350, perDeliveryMax: 410 },
  "SH235":   { customer: "Kelly Excavation", monthlyL: 5200, perDeliveryMin: 380, perDeliveryMax: 430 },
  "SH135":   { customer: "Kelly Excavation", monthlyL: 3000, perDeliveryMin: 200, perDeliveryMax: 240 },
  "SVL75":   { customer: "Kelly Excavation", monthlyL: 1100, perDeliveryMin: 75,  perDeliveryMax: 95 },
  "1KE-3JT": { customer: "Kelly Excavation", monthlyL: 850,  perDeliveryMin: 80,  perDeliveryMax: 100 },
  "1KX-7AR": { customer: "Kelly Excavation", monthlyL: 350,  perDeliveryMin: 60,  perDeliveryMax: 80 },
  "1KX-9PB": { customer: "Kelly Excavation", monthlyL: 350,  perDeliveryMin: 60,  perDeliveryMax: 80 },
  "YT-001":  { customer: "Kelly Excavation", monthlyL: 4350, perDeliveryMin: 4000, perDeliveryMax: 6000, depotOnly: true },
  // Metro Cranes (sums to 10,000 L/mo)
  "TC-A1":   { customer: "Metro Cranes",     monthlyL: 2100, perDeliveryMin: 160, perDeliveryMax: 200 },
  "TC-B2":   { customer: "Metro Cranes",     monthlyL: 2100, perDeliveryMin: 160, perDeliveryMax: 200 },
  "GEN-150": { customer: "Metro Cranes",     monthlyL: 4400, perDeliveryMin: 350, perDeliveryMax: 410 },
  "FRN-25":  { customer: "Metro Cranes",     monthlyL: 1400, perDeliveryMin: 180, perDeliveryMax: 240 },
};

const SHOWCASE_SITE: Record<string, string> = {
  "PC220":   "Mt Atkinson",
  "SH235":   "Mt Atkinson",
  "SH135":   "Cranbourne East",
  "SVL75":   "Cranbourne East",
  "1KE-3JT": "Cranbourne East",
  "1KX-7AR": "Mt Atkinson",
  "1KX-9PB": "Cranbourne East",
  "YT-001":  "Pakenham Yard",
  "TC-A1":   "Docklands",
  "TC-B2":   "Docklands",
  "GEN-150": "Docklands",
  "FRN-25":  "Box Hill",
};

// ─── Transactions: per-plant volume, last 90 days ────────────────────
// Builds deliveries that hit the monthly L target per plant. Placas link
// each transaction back to a plant_item, projects, FTC, etc.
function generateTransactions(buyPrices: BuyPrice[]): Transaction[] {
  const txns: Transaction[] = [];
  const CUSTOMER_MARGINS: Record<string, number> = {
    "Kelly Excavation": 18, "Metro Cranes": 20,
    "Citywide Earthworks": 22, "Peninsula Logistics": 16, "Bayside Transport": 20,
    "Southern Cross Mining": 25, "Greenfield Agriculture": 15, "Harbour Freight Co": 19,
    "Westfield Plant Hire": 23, "Oakridge Civil": 17, "Murray Valley Haulage": 21, "Pacific Drilling": 20,
  };

  // Generate for showcase plant items (drives deliveries with placas)
  Object.entries(PLANT_PROFILE).forEach(([placa, prof]) => {
    // Number of deliveries needed across 90 days = (3 * monthlyL) / avg per-delivery
    const avgPerDelivery = (prof.perDeliveryMin + prof.perDeliveryMax) / 2;
    const targetDeliveries = Math.max(1, Math.round((3 * prof.monthlyL) / avgPerDelivery));
    let totalDelivered = 0;
    const targetTotal = 3 * prof.monthlyL;

    for (let i = 0; i < targetDeliveries; i++) {
      // Spread across 90 days roughly uniformly with some jitter
      const day = Math.min(89, Math.max(0, Math.round((i / targetDeliveries) * 89 + (Math.random() - 0.5) * 4)));
      const dateStr = d(day);
      const bp = buyPrices.find(p => p.price_date === dateStr);
      const baseBuy = bp ? bp.price_per_litre : 1.48;

      // Last delivery: top up to target
      const remaining = targetTotal - totalDelivered;
      const remainingDeliveries = targetDeliveries - i;
      let qty: number;
      if (remainingDeliveries === 1) {
        qty = Math.max(prof.perDeliveryMin, Math.round(remaining));
      } else {
        qty = rand(prof.perDeliveryMin, prof.perDeliveryMax);
      }
      totalDelivered += qty;

      const margin = CUSTOMER_MARGINS[prof.customer] ?? 20;
      const noise = 0.99 + Math.random() * 0.02;
      const ppu = (baseBuy / (1 - margin / 100)) * noise;
      const total = qty * ppu;
      const driver = pick(DRIVERS);
      const truck = pick(TRUCKS);
      const location = SHOWCASE_SITE[placa] || pick(LOCATIONS);
      const hour = rand(5, 18);

      txns.push({
        id: txId++,
        fecha: ts(day, hour),
        date: dateStr,
        estacion: location,
        nombre_flota: null,
        nombre_cliente1: prof.customer,
        identificador_cliente1: null,
        ciudad: location,
        cantidad: qty,
        cantidad_neta: qty * 0.98,
        producto: "Diesel",
        nombre_vendedor: driver,
        placa,
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
  });

  // Background deliveries for the smaller customers (admin breadth)
  for (let day = 0; day < 90; day++) {
    const deliveries = rand(2, 5);
    const dateStr = d(day);
    const bp = buyPrices.find(p => p.price_date === dateStr);
    const baseBuy = bp ? bp.price_per_litre : 1.48;

    for (let j = 0; j < deliveries; j++) {
      const customer = CUSTOMERS[2 + Math.floor(Math.random() * (CUSTOMERS.length - 2))];
      const qty = rand(300, 2400);
      const margin = CUSTOMER_MARGINS[customer] ?? 20;
      const noise = 0.99 + Math.random() * 0.02;
      const ppu = (baseBuy / (1 - margin / 100)) * noise;
      const total = qty * ppu;
      txns.push({
        id: txId++,
        fecha: ts(day, rand(5, 18)),
        date: dateStr,
        estacion: pick(LOCATIONS),
        nombre_flota: null,
        nombre_cliente1: customer,
        identificador_cliente1: null,
        ciudad: pick(LOCATIONS),
        cantidad: qty,
        cantidad_neta: qty * 0.98,
        producto: "Diesel",
        nombre_vendedor: pick(DRIVERS),
        placa: null,
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

function generateBuyPrices(): BuyPrice[] {
  const prices: BuyPrice[] = [];
  let price = 1.42;
  for (let day = 89; day >= 0; day--) {
    price += (Math.random() - 0.48) * 0.03;
    price = Math.max(1.28, Math.min(1.65, price));
    prices.push({
      id: `bp-${day}`, price_date: d(day),
      price_per_litre: parseFloat(price.toFixed(4)),
      supplier: "Ampol", notes: null, created_at: ts(day),
    });
  }
  return prices.reverse();
}

function generateTGP(): TerminalGatePrice[] {
  const prices: TerminalGatePrice[] = [];
  let cpl = 155;
  for (let day = 29; day >= 0; day--) {
    cpl += (Math.random() - 0.48) * 2;
    cpl = Math.max(140, Math.min(170, cpl));
    prices.push({
      id: `tgp-${day}`, price_date: d(day), location: "Melbourne", product: "Diesel",
      price_cpl: parseFloat(cpl.toFixed(2)),
      price_per_litre: parseFloat((cpl / 100).toFixed(4)),
      source: "AIP", created_at: ts(day),
    });
  }
  return prices.reverse();
}

function generateCustomerPricing(): CustomerPricing[] {
  const pricing: CustomerPricing[] = [];
  const margins = [18, 20, 22, 16, 20, 25, 15, 19, 23, 17, 21, 20];
  CUSTOMERS.forEach((_, i) => {
    const id = i + 1;
    const m = margins[i % margins.length];
    pricing.push(
      { id: `cp-${id}-1`, client_account_id: id, margin_percent: m, payment_terms: "14 days", weekly_volume_tier: "0-500",       min_litres: 0,    max_litres: 500,  pricing_type: "margin", notes: null, created_at: ts(30), updated_at: ts(5) },
      { id: `cp-${id}-2`, client_account_id: id, margin_percent: Math.max(12, m - 3), payment_terms: "14 days", weekly_volume_tier: "500-1,000",   min_litres: 500,  max_litres: 1000, pricing_type: "margin", notes: null, created_at: ts(30), updated_at: ts(5) },
      { id: `cp-${id}-3`, client_account_id: id, margin_percent: Math.max(10, m - 5), payment_terms: "14 days", weekly_volume_tier: "1,000-2,000", min_litres: 1000, max_litres: 2000, pricing_type: "margin", notes: null, created_at: ts(30), updated_at: ts(5) },
    );
  });
  return pricing;
}

// ─── Demo Users ──────────────────────────────────────────────────────
export const DEMO_USERS = [
  { id: "u1", user_id: "u1", role: "admin",  full_name: "Alex Morgan",   email: "alex@demo.com",            client_account_id: null, company_name: null },
  { id: "u2", user_id: "u2", role: "admin",  full_name: "Jordan Lee",    email: "jordan@demo.com",          client_account_id: null, company_name: null },
  { id: "u3", user_id: "u3", role: "client", full_name: "Sean Kelly",    email: "sean@kellyexcavation.com.au", client_account_id: 1, company_name: "Kelly Excavation" },
  { id: "u4", user_id: "u4", role: "client", full_name: "Maria Russo",   email: "maria@metrocranes.com.au",    client_account_id: 2, company_name: "Metro Cranes" },
  { id: "u5", user_id: "u5", role: "client", full_name: "David Kim",     email: "david@citywideearth.com.au",  client_account_id: 3, company_name: "Citywide Earthworks" },
  { id: "u6", user_id: "u6", role: "driver", full_name: "Jake Mitchell", email: "jake@driver.com",          client_account_id: null, company_name: null },
  { id: "u7", user_id: "u7", role: "driver", full_name: "Sarah Chen",    email: "sarah@driver.com",         client_account_id: null, company_name: null },
  { id: "u8", user_id: "u8", role: "driver", full_name: "Tom Bradley",   email: "tom@driver.com",           client_account_id: null, company_name: null },
];

export const DEMO_ACTIVITY = [
  { id: "a1", user_id: "u1", action: "login",     metadata: {},                          created_at: ts(0, 8),  full_name: "Alex Morgan",   email: "alex@demo.com" },
  { id: "a2", user_id: "u6", action: "login",     metadata: {},                          created_at: ts(0, 6),  full_name: "Jake Mitchell", email: "jake@driver.com" },
  { id: "a3", user_id: "u3", action: "login",     metadata: {},                          created_at: ts(0, 9),  full_name: "Sean Kelly",    email: "sean@kellyexcavation.com.au" },
  { id: "a4", user_id: "u1", action: "export",    metadata: { type: "transactions_csv" }, created_at: ts(1, 14), full_name: "Alex Morgan",   email: "alex@demo.com" },
  { id: "a5", user_id: "u7", action: "login",     metadata: {},                          created_at: ts(1, 5),  full_name: "Sarah Chen",    email: "sarah@driver.com" },
  { id: "a6", user_id: "u4", action: "page_view", metadata: { page: "portal" },           created_at: ts(1, 10), full_name: "Maria Russo",   email: "maria@metrocranes.com.au" },
  { id: "a7", user_id: "u1", action: "login",     metadata: {},                          created_at: ts(2, 8),  full_name: "Alex Morgan",   email: "alex@demo.com" },
];

export const DEMO_CLIENT_ACCOUNTS = CUSTOMERS.map((name, i) => ({
  id: i + 1,
  company_name: name,
  contact_email: `accounts@${name.toLowerCase().replace(/\s+/g, "")}.com.au`,
  contact_name: DEMO_USERS.find(u => u.company_name === name)?.full_name || null,
  contact_phone: `04${rand(10, 99)} ${rand(100, 999)} ${rand(100, 999)}`,
  speedsol_name: name,
  speedsol_names: [name],
  is_active: true,
  auth_user_id: null,
  created_at: ts(60),
  updated_at: ts(5),
}));

export const DEMO_SYNC_LOG = {
  id: 1, synced_at: ts(0, 7), status: "success",
  records_fetched: 312, records_upserted: 312, error_message: null,
};

export const DEMO_QUOTES = [
  { id: "q1", customer_name: "Kelly Excavation", customer_email: "sean@kellyexcavation.com.au", customer_phone: "0412 345 678",
    volume_litres: 6000, buy_price_per_litre: 1.45, margin_percent: 12, sell_price_per_litre: 1.6477,
    total_ex_gst: 9886.36, total_inc_gst: 10875.0, notes: "Mt Atkinson — bulk yard tank fill",
    status: "sent", sent_at: ts(2, 10), valid_until: d(-1), created_at: ts(3, 9) },
  { id: "q2", customer_name: "Metro Cranes", customer_email: "maria@metrocranes.com.au", customer_phone: "0408 221 990",
    volume_litres: 4000, buy_price_per_litre: 1.46, margin_percent: 11, sell_price_per_litre: 1.6404,
    total_ex_gst: 6561.80, total_inc_gst: 7217.98, notes: "Docklands generator + tower crane refuel",
    status: "draft", sent_at: null, valid_until: d(0), created_at: ts(1, 14) },
];

export const DEMO_PRICING_TIERS = [
  { id: "pt-1", tier_name: "Small",  min_litres: 0,    max_litres: 500,  margin_percent: 12, created_at: ts(30) },
  { id: "pt-2", tier_name: "Medium", min_litres: 500,  max_litres: 2000, margin_percent: 10, created_at: ts(30) },
  { id: "pt-3", tier_name: "Large",  min_litres: 2000, max_litres: 5000, margin_percent: 8,  created_at: ts(30) },
  { id: "pt-4", tier_name: "Bulk",   min_litres: 5000, max_litres: null, margin_percent: 6,  created_at: ts(30) },
];

export const DEMO_SCHEDULED_DELIVERIES = [
  { id: "sd-1", client_account_id: 1, site_name: "Mt Atkinson",      scheduled_date: d(-1),  estimated_litres: 800,  notes: "Top up SH235 + PC220",       status: "scheduled", created_at: ts(1), client_accounts: { company_name: "Kelly Excavation" } },
  { id: "sd-2", client_account_id: 1, site_name: "Cranbourne East",  scheduled_date: d(-3),  estimated_litres: 600,  notes: "SH135 + Posi-Track",         status: "scheduled", created_at: ts(1), client_accounts: { company_name: "Kelly Excavation" } },
  { id: "sd-3", client_account_id: 1, site_name: "Pakenham Yard",    scheduled_date: d(-6),  estimated_litres: 5000, notes: "Yard tank YT-001 bulk drop", status: "scheduled", created_at: ts(1), client_accounts: { company_name: "Kelly Excavation" } },
  { id: "sd-4", client_account_id: 2, site_name: "Docklands",        scheduled_date: d(-2),  estimated_litres: 600,  notes: "Generator overnight run",    status: "scheduled", created_at: ts(1), client_accounts: { company_name: "Metro Cranes" } },
  { id: "sd-5", client_account_id: 2, site_name: "Box Hill",         scheduled_date: d(-5),  estimated_litres: 240,  notes: "Franna refuel before lift",  status: "scheduled", created_at: ts(1), client_accounts: { company_name: "Metro Cranes" } },
];

function generatePumpReadingsFromTxns(txns: Transaction[]) {
  const readings: any[] = [];
  for (let day = 0; day < 14; day++) {
    const dateStr = d(day);
    const dayTxns = txns.filter(t => t.date === dateStr);
    const dayTotal = dayTxns.reduce((sum, t) => sum + (t.cantidad || 0), 0);
    if (dayTotal === 0) continue;
    const varianceFactor = 0.985 + Math.random() * 0.03;
    const adjustedTotal = Math.round(dayTotal * varianceFactor);
    const numReadings = rand(1, 3);
    let remaining = adjustedTotal;
    for (let j = 0; j < numReadings; j++) {
      const isLast = j === numReadings - 1;
      const litres = isLast ? remaining : Math.round(remaining * (0.3 + Math.random() * 0.4));
      remaining -= litres;
      readings.push({
        id: `pr-${day}-${j}`, reading_date: dateStr, litres,
        driver_id: `u${rand(6, 8)}`,
        notes: j === 0 && day % 3 === 0 ? "Morning fill at Ampol Dandenong" : null,
        created_at: ts(day, 6 + j * 4),
      });
    }
  }
  return readings;
}

export const DEMO_RECON_ALERTS = [
  { id: "ra-1", alert_date: d(1), alert_type: "high_variance", values: { variance_pct: 1.1, variance_litres: 28 }, status: "new",      suggested_action: "Check pump calibration",                created_at: ts(1), resolved_at: null,    resolved_by: null },
  { id: "ra-2", alert_date: d(3), alert_type: "missing_pump",  values: { date: d(3) },                              status: "new",      suggested_action: "Request driver to submit reading",       created_at: ts(3), resolved_at: null,    resolved_by: null },
  { id: "ra-3", alert_date: d(7), alert_type: "unusual_volume", values: { volume: 5100, avg: 4200 },                status: "resolved", suggested_action: null,                                     created_at: ts(7), resolved_at: ts(6), resolved_by: "u1" },
];

export const DEMO_RECON_SETTINGS = {
  id: 1, variance_threshold_pct: 2, variance_threshold_litres: 50,
  alert_sensitivity: "medium", calibration_factor: 0,
  auto_weekly_report: true, report_email: "admin@paccfuel.com", updated_at: ts(5),
};

export const DEMO_FUEL_INTAKE_LOGS = [
  { id: "fil-1", driver_user_id: "u6", litres_entered: 3200, log_date: d(0), photo_path: null, bowser_retail_price: 1.85, notes: "Ampol Dandenong", created_at: ts(0, 7) },
  { id: "fil-2", driver_user_id: "u6", litres_entered: 2800, log_date: d(0), photo_path: null, bowser_retail_price: 1.84, notes: "Ampol Altona",    created_at: ts(0, 14) },
];

let _cache: ReturnType<typeof _generate> | null = null;
function _generate() {
  const buyPrices = generateBuyPrices();
  const transactions = generateTransactions(buyPrices);
  return {
    transactions,
    buyPrices,
    tgp: generateTGP(),
    customerPricing: generateCustomerPricing(),
    pumpReadings: generatePumpReadingsFromTxns(transactions),
  };
}
export function getDemoData() {
  if (!_cache) _cache = _generate();
  return _cache;
}
