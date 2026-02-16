import { subDays, format, addHours, addMinutes } from "date-fns";

export interface Transaction {
  id: number;
  fecha: string; // ISO timestamp
  date: string; // yyyy-MM-dd derived
  estacion: string;
  nombre_flota: string;
  nombre_cliente1: string;
  identificador_cliente1: string;
  ciudad: string;
  cantidad: number;
  cantidad_neta: number;
  producto: string;
  nombre_vendedor: string;
  placa: string;
  totalizador_bruto: number;
  factura: number;
  forma_de_pago: string;
  ppu: number;
  dinero_total: number;
  id_surtidor: number;
  surtidor: string;
  manguera: string;
}

export const customerList = [
  { name: "GEARON DANDENONG", code: "GRONDANDUTE", weight: 1.6 },
  { name: "BK ENGINEERING", code: "BKENG01", weight: 0.8 },
  { name: "MELBCON CIVIL", code: "MELBCIV01", weight: 0.7 },
  { name: "CPB CONTRACTORS", code: "CPB001", weight: 1.4 },
  { name: "FULTON HOGAN", code: "FH001", weight: 0.9 },
  { name: "BMD CONSTRUCTIONS", code: "BMD001", weight: 0.8 },
  { name: "WINSLOW INFRA", code: "WIN001", weight: 0.6 },
  { name: "SYMAL GROUP", code: "SYM001", weight: 1.5 },
  { name: "RAW ROAD AND RAIL", code: "RAW001", weight: 0.7 },
  { name: "MOIT CONSTRUCTIONS", code: "MOIT001", weight: 0.5 },
];

export const truckList = [
  { name: "PACC Truck 1", capacity: 8000, plate: "PACCTRUCK1", weight: 0.50 },
  { name: "PACC Truck 2", capacity: 5000, plate: "PACCTRUCK2", weight: 0.35 },
  { name: "PACC Truck 3", capacity: 4000, plate: "PACCTRUCK3", weight: 0.15 },
];

export const driverList = [
  { name: "DRIVER 1", weight: 0.70 },
  { name: "DRIVER 2", weight: 0.30 },
];

const locations = [
  "Dandenong", "Hallam", "Cranbourne", "Pakenham", "Officer", "Berwick",
  "Narre Warren", "Clayton", "Moorabbin", "Springvale", "Cheltenham",
  "Frankston", "Carrum Downs", "Seaford", "Scoresby", "Rowville",
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function weightedPick<T extends { weight: number }>(arr: T[], rand: number): T {
  const total = arr.reduce((s, a) => s + a.weight, 0);
  let cum = 0;
  for (const item of arr) {
    cum += item.weight / total;
    if (rand < cum) return item;
  }
  return arr[arr.length - 1];
}

function generateTransactions(): Transaction[] {
  const txns: Transaction[] = [];
  let seed = 42;
  let invoiceNum = 100001;
  const today = new Date();

  // Totaliser per truck
  const totalisers: Record<string, number> = {
    "PACC Truck 1": 450000,
    "PACC Truck 2": 280000,
    "PACC Truck 3": 150000,
  };

  // Base PPU that drifts weekly
  let basePPU = 1.82;

  for (let dayOffset = 60; dayOffset >= 0; dayOffset--) {
    const date = subDays(today, dayOffset);
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 0) continue;
    if (dayOfWeek === 6 && seededRandom(seed++) > 0.3) continue;

    // Weekly PPU drift
    if (dayOfWeek === 1) {
      basePPU = Math.round((1.75 + seededRandom(seed++) * 0.20) * 100) / 100;
    }

    const numDeliveries = Math.floor(seededRandom(seed++) * 26) + 15; // 15-40

    for (let i = 0; i < numDeliveries; i++) {
      const customer = weightedPick(customerList, seededRandom(seed++));
      const truck = weightedPick(truckList, seededRandom(seed++));
      const driver = weightedPick(driverList, seededRandom(seed++));
      const location = locations[Math.floor(seededRandom(seed++) * locations.length)];

      // Most 200-800, occasional large fills
      let cantidad: number;
      const sizeRand = seededRandom(seed++);
      if (sizeRand > 0.9) {
        cantidad = Math.round((1500 + seededRandom(seed++) * 1500) / 10) * 10;
      } else {
        cantidad = Math.round((80 + seededRandom(seed++) * 720) / 10) * 10;
      }

      const ppu = Math.round((basePPU + (seededRandom(seed++) - 0.5) * 0.06) * 100) / 100;
      const cantidadNeta = Math.round(cantidad * (0.98 + seededRandom(seed++) * 0.02));
      const dineroTotal = Math.round(cantidad * ppu * 100) / 100;

      totalisers[truck.name] = (totalisers[truck.name] || 0) + cantidad;

      const hour = Math.floor(seededRandom(seed++) * 11) + 5; // 5am-4pm
      const minute = Math.floor(seededRandom(seed++) * 60);
      const txTime = addMinutes(addHours(new Date(date.getFullYear(), date.getMonth(), date.getDate()), hour), minute);

      txns.push({
        id: txns.length + 1,
        fecha: txTime.toISOString(),
        date: format(date, "yyyy-MM-dd"),
        estacion: truck.name,
        nombre_flota: "PACC Fuel",
        nombre_cliente1: customer.name,
        identificador_cliente1: customer.code,
        ciudad: location,
        cantidad,
        cantidad_neta: cantidadNeta,
        producto: "DIESEL",
        nombre_vendedor: driver.name,
        placa: truck.plate,
        totalizador_bruto: Math.round(totalisers[truck.name]),
        factura: invoiceNum++,
        forma_de_pago: seededRandom(seed++) > 0.15 ? "Account" : "Cash",
        ppu,
        dinero_total: dineroTotal,
        id_surtidor: 1,
        surtidor: "PACC Civil LCRiQ",
        manguera: "PACC Civil Diesel Hose",
      });
    }
  }

  return txns.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export const transactions: Transaction[] = generateTransactions();

export type DateRange = "today" | "week" | "month" | "custom";

export function filterByDateRange(
  txns: Transaction[],
  range: DateRange,
  customStart?: Date,
  customEnd?: Date
): Transaction[] {
  const today = new Date();
  let start: Date;
  let end: Date = today;

  switch (range) {
    case "today":
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      break;
    case "week":
      start = subDays(today, 7);
      break;
    case "month":
      start = subDays(today, 30);
      break;
    case "custom":
      start = customStart || subDays(today, 30);
      end = customEnd || today;
      break;
    default:
      start = subDays(today, 30);
  }

  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  return txns.filter((t) => t.date >= startStr && t.date <= endStr);
}

export function getPreviousPeriodTransactions(
  txns: Transaction[],
  range: DateRange
): Transaction[] {
  const today = new Date();
  let days: number;

  switch (range) {
    case "today": days = 1; break;
    case "week": days = 7; break;
    case "month": days = 30; break;
    default: days = 30;
  }

  const start = subDays(today, days * 2);
  const end = subDays(today, days);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  return txns.filter((t) => t.date >= startStr && t.date <= endStr);
}
