import { subDays, format, addHours, addMinutes } from "date-fns";

export interface Customer {
  id: string;
  name: string;
  projects: Project[];
}

export interface Project {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
}

export interface Truck {
  id: string;
  name: string;
  model: string;
  capacity: number;
}

export interface Transaction {
  id: string;
  date: string;
  time: string;
  customerId: string;
  customerName: string;
  projectId: string;
  projectName: string;
  truckId: string;
  truckName: string;
  driver: string;
  litres: number;
  pricePerLitre: number;
  total: number;
}

export const customers: Customer[] = [
  { id: "c1", name: "Symal Group", projects: [] },
  { id: "c2", name: "Raw Road & Rail", projects: [] },
  { id: "c3", name: "CPB Contractors", projects: [] },
  { id: "c4", name: "BMD Group", projects: [] },
  { id: "c5", name: "Winslow Infrastructure", projects: [] },
  { id: "c6", name: "Fulton Hogan", projects: [] },
  { id: "c7", name: "McConnell Dowell", projects: [] },
  { id: "c8", name: "Melbcon Civil", projects: [] },
];

const projectNames: Record<string, string[]> = {
  c1: ["Moonee Valley Racecourse", "Monash Freeway Upgrade"],
  c2: ["West Gate Tunnel - Zone 3", "Metro Tunnel - Arden"],
  c3: ["Suburban Rail Loop - Cheltenham", "North East Link - Section A"],
  c4: ["Hallam Bypass Upgrade", "Western Ring Road Widening"],
  c5: ["Port of Melbourne Expansion"],
  c6: ["M80 Resurfacing - Tullamarine", "Princes Freeway Maintenance"],
  c7: ["Cross Yarra Partnership", "Level Crossing Removal - Clayton"],
  c8: ["Doncaster Busway Extension"],
};

let projectIdCounter = 1;
customers.forEach((c) => {
  c.projects = (projectNames[c.id] || []).map((name) => ({
    id: `p${projectIdCounter++}`,
    name,
    customerId: c.id,
    customerName: c.name,
  }));
});

export const allProjects: Project[] = customers.flatMap((c) => c.projects);

export const trucks: Truck[] = [
  { id: "t1", name: "Truck 1", model: "Hino 500", capacity: 5000 },
  { id: "t2", name: "Truck 2", model: "Isuzu FVZ", capacity: 8000 },
  { id: "t3", name: "Truck 3", model: "Fuso Fighter", capacity: 4000 },
];

const drivers = ["Jake Mitchell", "Sam Nguyen", "Ben Taylor", "Chris O'Brien", "Liam Parker"];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateTransactions(): Transaction[] {
  const txns: Transaction[] = [];
  let seed = 42;
  const today = new Date();

  for (let dayOffset = 45; dayOffset >= 0; dayOffset--) {
    const date = subDays(today, dayOffset);
    const dayOfWeek = date.getDay();

    // Skip most Sundays, occasional Saturdays
    if (dayOfWeek === 0) continue;
    if (dayOfWeek === 6 && seededRandom(seed++) > 0.3) continue;

    // 3-8 deliveries per day
    const numDeliveries = Math.floor(seededRandom(seed++) * 6) + 3;

    for (let i = 0; i < numDeliveries; i++) {
      const customer = customers[Math.floor(seededRandom(seed++) * customers.length)];
      const project = customer.projects[Math.floor(seededRandom(seed++) * customer.projects.length)];
      const truck = trucks[Math.floor(seededRandom(seed++) * trucks.length)];
      const driver = drivers[Math.floor(seededRandom(seed++) * drivers.length)];

      const litres = Math.round((seededRandom(seed++) * 2800 + 200) / 50) * 50;
      const pricePerLitre = Math.round((1.75 + seededRandom(seed++) * 0.20) * 100) / 100;

      const hour = Math.floor(seededRandom(seed++) * 10) + 6; // 6am - 4pm
      const minute = Math.floor(seededRandom(seed++) * 60);
      const txTime = addMinutes(addHours(new Date(date.setHours(0, 0, 0, 0)), hour), minute);

      txns.push({
        id: `tx${txns.length + 1}`,
        date: format(date, "yyyy-MM-dd"),
        time: format(txTime, "HH:mm"),
        customerId: customer.id,
        customerName: customer.name,
        projectId: project.id,
        projectName: project.name,
        truckId: truck.id,
        truckName: `${truck.name} — ${truck.model}`,
        driver,
        litres,
        pricePerLitre,
        total: Math.round(litres * pricePerLitre * 100) / 100,
      });
    }
  }

  return txns.sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
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
