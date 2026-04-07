export interface SOPSection {
  id: string;
  title: string;
  subsections: {
    title: string;
    content: string[];
  }[];
}

export interface ClientSite {
  client: string;
  site: string;
  address: string;
  contact: string;
  phone: string;
  uhf?: string;
  preferredDays: string;
  codes: { code: string; description: string }[];
  notes: string[];
}

export const SOP_SECTIONS: SOPSection[] = [
  {
    id: "welcome",
    title: "Welcome & Core Values",
    subsections: [
      {
        title: "Our Mission",
        content: [
          "At PACC FUEL, safety is our highest priority. Nothing is more important than ensuring every team member goes home safely at the end of the day.",
          "Please never put yourself in a position where you could be injured or exposed to unnecessary risk. If something feels unsafe, stop immediately, reassess, and contact the office or operations.",
        ],
      },
      {
        title: "Core Values",
        content: [
          "1. Safety — Every task, every site, every moment — safety comes first. No delivery, deadline, or customer request is worth an injury.",
          "2. Reliability — Clients depend on us. We follow procedures, operate consistently, and communicate clearly.",
          "3. Punctuality — We respect our clients' time and project schedules. Arriving when we say we will is part of our brand.",
          "4. Efficiency — We work in a structured, organised, and methodical way. Efficiency reduces errors, reduces risk, and supports sustainable growth.",
          "5. Friendliness — We represent PACC FUEL on every site. A positive, respectful attitude builds trust and long-term relationships.",
        ],
      },
    ],
  },
  {
    id: "start-of-day",
    title: "1. Start of Day",
    subsections: [
      {
        title: "1.1 Arrive at Yard — 421 Hammond Rd, Dandenong South",
        content: [
          "Enter gate with code 9825",
          "Conduct a full walk-around inspection, checking:",
          "• Tyres & wheel nuts",
          "• Lights & indicators",
          "• Hoses, nozzles, gates, reel",
          "• Fuel level",
          "• Any visible damage",
          "• Safety equipment (spill kit, PPE, fire extinguisher, cones)",
        ],
      },
      {
        title: "1.2 Complete Pre-Start",
        content: [
          "Log into Assignar.",
          "Complete the daily pre-start checklist and sign off.",
          "Note any defects and report if required before leaving the yard.",
        ],
      },
    ],
  },
  {
    id: "daily-schedule",
    title: "2. Review Daily Schedule",
    subsections: [
      {
        title: "2.1 Open OptimoRoute",
        content: [
          "Log into OptimoRoute.",
          "Review the full list of scheduled deliveries for the day.",
          "Check locations, notes, volumes, and any special instructions.",
        ],
      },
      {
        title: '2.2 Go "On Duty"',
        content: [
          'Press "Start / On Duty" within OptimoRoute to begin your shift.',
        ],
      },
    ],
  },
  {
    id: "communication",
    title: "3. Communication With Sites",
    subsections: [
      {
        title: "3.1 Before First Delivery",
        content: [
          "Call the first customer/site contact. Confirm:",
          "• ETA",
          "• Any site changes due to weather, access issues, or delays",
          "• Machinery location on site",
          "• Any updated fuel requirements",
        ],
      },
      {
        title: "3.2 Ongoing Deliveries",
        content: [
          "Before leaving each job, call the next scheduled site. Confirm ETA and any changes they need.",
          "If a customer requests a change, contact the office so the route can be updated.",
        ],
      },
    ],
  },
  {
    id: "refuelling",
    title: "4. Refuelling the Truck (Depot Fill)",
    subsections: [
      {
        title: "Fill Times",
        content: [
          "You will fill the truck at one of three possible times:",
          "• Morning — before starting deliveries",
          "• End of shift — after completing all jobs",
          "• Opportunistically — if passing Dandenong depot during the day",
          "Choose the most efficient option based on the daily route.",
        ],
      },
    ],
  },
  {
    id: "onsite-delivery",
    title: "5. Onsite Delivery Procedure",
    subsections: [
      {
        title: "5.1 Arrival",
        content: [
          "Ring ahead (already done before departing the previous site).",
          "On arrival, locate the customer contact.",
        ],
      },
      {
        title: "5.2 Preparing to Deliver",
        content: [
          "Identify the correct OptimoRoute job item codes.",
          "Open SpeedSol (fuel delivery app).",
          "Ensure the truck's Bluetooth is connected to SpeedSol.",
        ],
      },
      {
        title: "5.3 Delivering Fuel",
        content: [
          "For each individual plant item:",
          "• Select or input the correct item code",
          "• Press Start",
          "• Fill the item",
          "• Press Stop",
          "• Move to the next item",
          "• Repeat until all plant is filled",
        ],
      },
      {
        title: "5.4 Completion",
        content: [
          "Confirm with site contact that all requested items have been filled.",
          "Ask if they expect any changes for future deliveries.",
          "Provide a reminder of the standard run schedule (e.g., Mon/Wed/Fri).",
        ],
      },
    ],
  },
  {
    id: "end-of-job",
    title: "6. End of Job",
    subsections: [
      {
        title: "Mark Complete",
        content: [
          "Mark the job as Completed in OptimoRoute.",
          "Input required notes (if applicable).",
          "Proceed to the next site and repeat communication + delivery steps.",
        ],
      },
    ],
  },
  {
    id: "end-of-day",
    title: "7. End of Day",
    subsections: [
      {
        title: "7.1 Return to Yard",
        content: [
          "Refuel the truck at the depot if required.",
          "Park safely in an allocated position.",
          "Complete end-of-day walkaround if appropriate.",
        ],
      },
      {
        title: "7.2 Sign Off",
        content: [
          "Close route in OptimoRoute.",
          "Complete any required notes or reporting.",
          "Log off duty.",
        ],
      },
    ],
  },
  {
    id: "vehicle-maintenance",
    title: "9. Vehicle Cleaning & Maintenance",
    subsections: [
      {
        title: "9.1 Daily (In-Shift)",
        content: [
          "Wipe down all interior surfaces.",
          "Keep cab clean and organised.",
        ],
      },
      {
        title: "9.2 Weekly",
        content: [
          "Take the truck through the truck wash once per week.",
          "Check and top up: engine oil, coolant, water, windscreen washer fluid, power steering fluid.",
          "Verify toolboxes are clean, organised, stocked, and locked.",
          "Inspect fuel hoses, nozzles, and reel for wear.",
          "Check Bluetooth connection module for SpeedSol.",
          "Verify spill kit is present.",
        ],
      },
      {
        title: "9.3 Monthly",
        content: [
          "Fire Extinguishers — check gauge is green, inspect for damage/rust/loose pins/expired tags, ensure bracket is secure.",
          "First Aid Kit — confirm stocked and unopened, replace missing or expired components.",
          "Spill Kit — check absorbent pads, socks, PPE, disposal bags are present. Replace used or missing components.",
        ],
      },
    ],
  },
  {
    id: "site-safety",
    title: "11. Site Safety Protocols",
    subsections: [
      {
        title: "Truck Safety",
        content: [
          "Turn on flashing beacon when entering any site, yard, quarry, or construction area.",
          "Keep beacon on at all times while moving or operating on site.",
          "Maintain awareness of people, plant, and traffic at all times.",
          "Follow all site speed limits and traffic management directions.",
          "If anything is wrong, unsafe, or not functioning — report to office immediately.",
        ],
      },
      {
        title: "UHF Communication",
        content: [
          "Upon entering site, switch on UHF radio.",
          'Call up on the site\'s designated UHF channel: "Fuel truck entering site, requesting contact with site supervisor."',
          "Confirm your location, which machines need refuelling, and any access restrictions.",
          "Confirm plant is switched off before refuelling.",
        ],
      },
      {
        title: "Elevated/Hard-to-Reach Plant",
        content: [
          "Position hose in a safe, reachable location before climbing.",
          "Always use three points of contact when climbing.",
          "Replace nozzle securely before climbing down.",
        ],
      },
      {
        title: "PPE Requirements",
        content: [
          "Wear correct PPE: high-vis, boots, hard hat, gloves, safety glasses.",
          "Set truck in a safe, stable position before refuelling.",
          "Keep minimum clearance from moving plant and exclusion zones.",
          "Never refuel a machine that is running (unless generator — confirm with site controller).",
        ],
      },
      {
        title: "Hazard Reporting",
        content: [
          "Stop work if any unsafe condition is observed.",
          "Report hazards or incidents to the office immediately.",
          "Do not operate the truck if a critical safety item fails, a hose/nozzle is damaged, or a spill kit/extinguisher is missing.",
        ],
      },
    ],
  },
  {
    id: "depot-refuelling",
    title: "Refuelling at Pacific Fuel Depot (Pump 17)",
    subsections: [
      {
        title: "Location & Setup",
        content: [
          "Location: 64 Ordish Road, Dandenong South",
          "Bowser: Pump 17 (API connection + Scully plug)",
          "Pull up to Pump 17, position truck on the right-hand side.",
          "Park straight, apply handbrake, turn the truck off.",
          "Grab the Pacific Fuel card (above sun visor).",
        ],
      },
      {
        title: "Connection Procedure",
        content: [
          "1. Connect Scully Plug FIRST — lift safety latch, pull pin, remove cap, connect firmly.",
          "2. Connect API Fuel Hose — align, push, listen for solid click, fully open valve.",
          "3. Activate Pump Terminal — Press 1 (Fuel) → 17 (Bowser) → Enter → 1 (Odometer) → Enter reading → PIN: 2020 → Tap Pacific Fuel card.",
          "4. Preset 5000 litres → turn side switch ON → fuel begins flowing.",
          "5. Stay with bowser during filling — do not leave.",
        ],
      },
      {
        title: "Disconnection (Reverse Order)",
        content: [
          "Turn side switch OFF.",
          "Close the API valve fully.",
          "Disconnect API hose → hang back on bowser holder.",
          "Disconnect Scully plug → replace caps on both truck + bowser.",
          "Insert pin and close safety latch on Pump 17.",
          "Press 2 at terminal to print receipt. If printer is out, photo the screen and send to WhatsApp group.",
          "Return card to sun visor.",
        ],
      },
    ],
  },
  {
    id: "optimoroute-guide",
    title: "OptimoRoute Driver Guide",
    subsections: [
      {
        title: "Start of Shift",
        content: [
          "Turn on the PACC FUEL phone.",
          "Open the OptimoRoute Driver App.",
          "Ensure: mobile reception, location services ON, battery above 30%.",
          'Tap "Start Day" if prompted.',
        ],
      },
      {
        title: "Navigation & Job Details",
        content: [
          "Tap Navigate → choose Google Maps → follow GPS → return to OptimoRoute on site.",
          "Every stop includes a clear note: Code, Machine, UHF, Contact.",
          "Use the exact code in SpeedSol — no searching required.",
        ],
      },
      {
        title: "Completing Jobs",
        content: [
          "After refuelling: Tap Complete → add notes if needed → Tap Done.",
          "The next job loads automatically.",
          "Add photos if dispatch has asked for evidence.",
        ],
      },
      {
        title: "If a Client Calls You Directly",
        content: [
          "If a client asks to reschedule, speed up, add a machine, or change job order:",
          'Send to PACC Fuel WhatsApp Group immediately: "Client on site wants to reschedule / speed up — please review."',
          "The office will update OptimoRoute and re-plan the day.",
        ],
      },
      {
        title: "End of Day",
        content: [
          'Tap "Finish Day" in OptimoRoute.',
          "Confirm all jobs are complete.",
          "Charge the phone overnight.",
        ],
      },
      {
        title: "Quick Tips",
        content: [
          "All plant codes are already written in your job notes — no searching required.",
          "Keep Bluetooth ON for the pump.",
          "If the app freezes, close and reopen OptimoRoute — the route is saved.",
          "Use the hard-copy code sheet in the truck if the phone drops reception.",
        ],
      },
    ],
  },
];

export const CLIENT_SITES: ClientSite[] = [
  {
    client: "Yarra Contracting",
    site: "West Gate Tunnel Project (WGTP)",
    address: "2 Parker St, Footscray",
    contact: "JJ",
    phone: "0437 885 012",
    preferredDays: "2–3 days per week. Phone ahead.",
    codes: [
      { code: "YARRAWEST2TEX", description: "2 Tonne Excavator" },
      { code: "YARRAWEST3TROLL", description: "3T Roller" },
      { code: "YARRAWEST5TEX", description: "5 Tonne Excavator" },
      { code: "YARRAWEST8TEX", description: "8 Tonne Excavator" },
      { code: "YARRAWESTEXTRA", description: "Anything Not Coded" },
      { code: "YARRAWESTSKID", description: "Skid Steer / Bobcat" },
      { code: "YARRAWESTTIP", description: "Tip Truck" },
      { code: "YARRAWESTWATER", description: "Water Truck" },
    ],
    notes: [
      "Deliveries under 35L incur a low volume fee — notify the office.",
      "Wait times over 10 min incur a wait fee (every 15 min extra). Notify the office of any delays.",
    ],
  },
  {
    client: "Tycorp",
    site: "Burnley",
    address: "53 Gibdon St, Burnley 3121",
    contact: "Andrew Schling",
    phone: "0411 877 225",
    preferredDays: "2× per week. Phone a day in advance.",
    codes: [
      { code: "TYBURNGEN1", description: "Large Generator" },
      { code: "TYBURNGEN2", description: "Large Generator" },
    ],
    notes: [
      "Deliveries under 35L incur a low volume fee — notify the office.",
      "Wait times over 10 min incur a wait fee. Notify the office of any delays.",
    ],
  },
  {
    client: "Melbourne Commercial Plumbing (MCP)",
    site: "Ravenhall",
    address: "18 Momentum Way, Ravenhall",
    contact: "Conor",
    phone: "0421 523 275",
    preferredDays: "Mon/Wed/Fri. RDO week: Tue/Thu/Fri PM. Ring ahead.",
    codes: [
      { code: "MCPRAVE14TEX", description: "14T Excavator" },
      { code: "MCPRAVE23TEX", description: "23T Excavator" },
      { code: "MCPRAVE25TEX", description: "25T Excavator" },
      { code: "MCPRAVE2TEX", description: "2T Excavator" },
      { code: "MCPRAVE30TEX", description: "30T Excavator" },
      { code: "MCPRAVE38TEX", description: "38T Excavator" },
      { code: "MCPRAVE5TEX", description: "5T Excavator" },
      { code: "MCPRAVELOAD", description: "Front End Loader" },
      { code: "MCPRAVEOTHER", description: "Misc Items" },
      { code: "MCPRAVESKID", description: "Skid Steer / Bobcat" },
      { code: "MCPRAVEUTE", description: "Ute Tank" },
    ],
    notes: [
      "Deliveries under 35L incur a low volume fee — notify the office.",
      "Wait times over 10 min incur a wait fee. Notify the office of any delays.",
    ],
  },
  {
    client: "Melbourne Commercial Plumbing (MCP)",
    site: "Melbourne Airport",
    address: "25 Macedon Way, Melbourne Airport",
    contact: "Brydon",
    phone: "0404 708 002",
    preferredDays: "Mon/Wed/Fri. RDO week: Tue/Thu/Fri PM. Ring ahead.",
    codes: [
      { code: "MCPAIR14TEX", description: "14T Excavator" },
      { code: "MCPAIR25TEX", description: "25T Excavator" },
      { code: "MCPAIR5TEX", description: "5T Excavator" },
      { code: "MCPAIREXTRA", description: "Misc" },
      { code: "MCPAIRSKID", description: "Skid Steer / Bobcat" },
    ],
    notes: [
      "Deliveries under 35L incur a low volume fee — notify the office.",
      "Wait times over 10 min incur a wait fee. Notify the office of any delays.",
    ],
  },
  {
    client: "Keller",
    site: "St Kilda Road",
    address: "437 St Kilda Road, Melbourne",
    contact: "Corey",
    phone: "0404 708 002",
    preferredDays: "Mon/Wed/Fri. RDO week: Tue/Thu/Fri PM. Ring ahead.",
    codes: [
      { code: "KLRSTK22TEX", description: "22T Excavator" },
      { code: "KLRSTKCONCRETE", description: "Concrete Pump" },
      { code: "KLRSTKCRANE", description: "Crawler Crane" },
      { code: "KLRSTKEXTRA", description: "Misc (Jerry Cans etc)" },
      { code: "KLRSTKPILING", description: "Piling Rig" },
    ],
    notes: [
      "Deliveries under 35L incur a low volume fee — notify the office.",
      "Wait times over 10 min incur a wait fee. Notify the office of any delays.",
    ],
  },
  {
    client: "Keller",
    site: "Sturt St",
    address: "135 Sturt St, Southbank",
    contact: "Gavin",
    phone: "0423 000 122",
    preferredDays: "Mon/Wed/Fri. RDO week: Tue/Thu/Fri PM. Ring ahead.",
    codes: [
      { code: "KLRSTURT13TEX", description: "13T Excavator" },
      { code: "KLRSTURTCONCRETE", description: "Concrete Pump" },
      { code: "KLRSTURTCRANE", description: "Crawler Crane" },
      { code: "KLRSTURTEX", description: "15T Excavator" },
      { code: "KLRSTURTPILING1", description: "Piling Rig" },
      { code: "KLRSTURTPILING2", description: "Piling Rig" },
    ],
    notes: [
      "Deliveries under 35L incur a low volume fee — notify the office.",
      "Wait times over 10 min incur a wait fee. Notify the office of any delays.",
    ],
  },
  {
    client: "Ironside",
    site: "Albert Road",
    address: "50 Albert Rd, South Melbourne",
    contact: "Jack Bennett",
    phone: "0407 506 975",
    preferredDays: "2× days per week. Ring ahead.",
    codes: [
      { code: "ISALB", description: "General" },
      { code: "ISALBGENERATOR", description: "Generator" },
    ],
    notes: [
      "Deliveries under 35L incur a low volume fee — notify the office.",
      "Wait times over 10 min incur a wait fee. Notify the office of any delays.",
    ],
  },
  {
    client: "Ironside",
    site: "Alphington",
    address: "60 Chandler Hwy, Alphington",
    contact: "Eric",
    phone: "0409 614 111",
    preferredDays: "2× days per week. Ring ahead.",
    codes: [
      { code: "ISALPHEX01", description: "Plant ID on Asset" },
      { code: "ISALPHEX02", description: "Plant ID on Asset" },
      { code: "ISALPHEX03", description: "Plant ID on Asset" },
      { code: "ISALPHEX04", description: "Plant ID on Asset" },
      { code: "ISALPHEX05", description: "Plant ID on Asset" },
      { code: "ISALPHEXTRA", description: "Misc" },
    ],
    notes: [
      "Deliveries under 35L incur a low volume fee — notify the office.",
      "Wait times over 10 min incur a wait fee. Notify the office of any delays.",
    ],
  },
  {
    client: "Fulton Hogan",
    site: "Pakenham",
    address: "Soldiers Road, Pakenham (turn right at roundabout of Healesville–Koo Wee Rup Rd & Halls Rd, follow towards FDC site)",
    contact: "Luke",
    phone: "0468 456 834",
    preferredDays: "2× days per week. Ring ahead.",
    codes: [
      { code: "FHOGPAK326", description: "Check Plant ID" },
      { code: "FHOGPAK327", description: "Check Plant ID" },
      { code: "FHOGPAK330", description: "Check Plant ID" },
      { code: "FHOGPAK340", description: "Check Plant ID" },
      { code: "FHOGPAK349", description: "Check Plant ID" },
      { code: "FHOGPAK355", description: "Check Plant ID" },
      { code: "FHOGPAKGEN", description: "Generator" },
      { code: "FHOGPAKHIRE20TEX", description: "20T Excavator (ask client)" },
      { code: "FHOGPAKLOAD", description: "Front End Loader" },
    ],
    notes: [
      "Deliveries under 35L incur a low volume fee — notify the office.",
      "Wait times over 10 min incur a wait fee. Notify the office of any delays.",
    ],
  },
];
