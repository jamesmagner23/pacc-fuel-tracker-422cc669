import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Mail, ShieldAlert } from "lucide-react";
import OutreachComposer from "@/components/outreach/OutreachComposer";
import { useUserRole } from "@/hooks/useUserRole";
import { RequestApprovalDialog } from "@/components/sales/RequestApprovalDialog";
import { PriceStatusBanner } from "@/components/sales/PriceStatusBanner";
import {
  tierForLitres,
  computeSellFromGpPct,
  computeSellFromCpl,
  deriveMetrics,
  priceStatus,
  clampToFloor,
  fmtMoney0,
} from "@/lib/pricing";
import { logSalesActivity } from "@/hooks/useSalesActivity";

type Mode = "quote" | "check";
type Target = "cpl" | "pct";
type BuyRow = {
  supplier: string;
  price_per_litre: number;
  price_date: string;
  notes: string | null;
};
type ClientRow = {
  id: number;
  company_name: string;
  payment_terms_days: number | null;
};

const SUPPLIERS = ["Pro Fusion", "Pacific"] as const;
// Both suppliers feed in inc-GST already (Pro Fusion = Viva TGP − 1.5c inc-GST,
// Pacific = scraped from supplier email inc-GST). Show as-is, no conversion.

const PAYMENT_TERM_OPTIONS = [0, 7, 14, 21, 30, 45, 60] as const;

/** Allow inputs to be cleared (empty) while still typing a clean number. */
function NumberField({
  value,
  onChange,
  step,
  className,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      placeholder={placeholder}
      value={value === null || Number.isNaN(value) ? "" : value}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(null);
        const n = parseFloat(raw);
        onChange(Number.isFinite(n) ? n : null);
      }}
      className={className}
    />
  );
}
const n = (v: number | null) => (v === null || !Number.isFinite(v) ? 0 : v);

export default function LiveDropCalculator() {
  const { data: role } = useUserRole();
  const isDriver = role === "driver";
  const isAdmin = role === "admin" || !role; // default admin if role missing
  const isRep = isDriver; // rep view = driver

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Record<string, BuyRow | null>>({});
  const [supplier, setSupplier] = useState<string>("Pro Fusion");
  const [err, setErr] = useState<string | null>(null);

  const [manualBuy, setManualBuy] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("quote");
  const [litres, setLitres] = useState<number | null>(3000);

  const [target, setTarget] = useState<Target>("cpl");
  const [targetCpl, setTargetCpl] = useState<number | null>(27);
  const [targetPct, setTargetPct] = useState<number | null>(20);
  const [sellInput, setSellInput] = useState<number | null>(1.82);
  const [clampWarning, setClampWarning] = useState<string | null>(null);
  const [clientEstablished, setClientEstablished] = useState(false);
  const [ownerOverride, setOwnerOverride] = useState(false); // admin manual override past soft rules

  const [driveMin, setDriveMin] = useState<number | null>(20);
  const speed = 40; // km/h average

  // Truck cost build-up. Driver wage is standardised at $60/hr normal,
  // $90/hr for overtime (1.5×). Admins can still type a custom number.
  const [wageMode, setWageMode] = useState<"normal" | "ot" | "custom">("normal");
  const [driverWage, setDriverWage] = useState<number | null>(60);
  const [loadMin, setLoadMin] = useState<number | null>(30);            // loading + unloading minutes per drop
  const [truckLper100, setTruckLper100] = useState<number | null>(38); // truck diesel consumption L/100km
  const [truckDieselPrice, setTruckDieselPrice] = useState<number | null>(1.85); // $/L inc-GST burnt by the truck
  const [maintPerKm, setMaintPerKm] = useState<number | null>(0.25);    // tyres + servicing + rego + insurance per km

  const setWagePreset = (m: "normal" | "ot" | "custom") => {
    setWageMode(m);
    if (m === "normal") setDriverWage(60);
    else if (m === "ot") setDriverWage(90);
  };

  // Client + payment terms
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [paymentTerms, setPaymentTerms] = useState<number | null>(null);
  const [savingTerms, setSavingTerms] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [customerNameInput, setCustomerNameInput] = useState("");
  const [customerEmailInput, setCustomerEmailInput] = useState("");

  useEffect(() => {
    (async () => {
      const todayMelbourne = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
      const { data, error } = await supabase
        .from("buy_prices")
        .select("supplier, price_per_litre, price_date, notes")
        .in("supplier", SUPPLIERS as unknown as string[])
        .order("price_date", { ascending: false })
        .limit(50);
      if (error) {
        setErr(error.message);
      } else {
        const latest: Record<string, BuyRow | null> = {};
        for (const r of data || []) {
          if (!latest[r.supplier]) latest[r.supplier] = r as BuyRow;
        }
        setRows(latest);
        // Rep view: auto-pick cheapest supplier and lock the picker.
        const supplierEntries = Object.entries(latest).filter(([_, v]) => v) as [string, BuyRow][];
        if (supplierEntries.length) {
          supplierEntries.sort((a, b) => a[1].price_per_litre - b[1].price_per_litre);
          setSupplier(supplierEntries[0][0]);
        }
      }
      setLoading(false);
    })();
  }, []);

  // Load clients (for payment terms lookup)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("client_accounts")
        .select("id, company_name, payment_terms_days")
        .eq("is_active", true)
        .order("company_name");
      setClients((data || []) as ClientRow[]);
    })();
  }, []);

  // When a client is picked, default payment terms from their saved value
  useEffect(() => {
    if (clientId === null) {
      setPaymentTerms(null);
      return;
    }
    const c = clients.find((x) => x.id === clientId);
    setPaymentTerms(c?.payment_terms_days ?? null);
  }, [clientId, clients]);

  const selectedClient = clients.find((c) => c.id === clientId) || null;
  const termsChanged =
    selectedClient && (selectedClient.payment_terms_days ?? null) !== (paymentTerms ?? null);

  const saveTermsForClient = async () => {
    if (!selectedClient) return;
    setSavingTerms(true);
    const { error } = await supabase
      .from("client_accounts")
      .update({ payment_terms_days: paymentTerms })
      .eq("id", selectedClient.id);
    setSavingTerms(false);
    if (!error) {
      setClients((prev) =>
        prev.map((c) =>
          c.id === selectedClient.id ? { ...c, payment_terms_days: paymentTerms } : c
        )
      );
    }
  };

  const priceRow = rows[supplier] ?? null;
  const rawBuy = priceRow ? Number(priceRow.price_per_litre) : 0;
  const buy = manualBuy ?? rawBuy;
  const buyExGst = buy / 1.1;
  const todayMel = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
  const stale = !priceRow || priceRow.price_date < todayMel;

  // Auto-select tier target when litres change (only if user is on % target mode).
  useEffect(() => {
    const tier = tierForLitres(n(litres));
    if (target === "pct" && !tier.custom) {
      setTargetPct(tier.targetGpPct);
    }
    // Reset clamp warning when litres change
    setClampWarning(null);
  }, [litres]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = useMemo(() => {
    const dm = n(driveMin);
    const truckKm = (dm / 60) * speed * 2; // round trip
    const driveHours = (dm * 2) / 60;
    const totalHours = driveHours + n(loadMin) / 60;
    const wageCost = totalHours * n(driverWage);
    const truckFuelCost = (truckKm * n(truckLper100) / 100) * n(truckDieselPrice);
    const maintCost = truckKm * n(maintPerKm);
    const truckCost = wageCost + truckFuelCost + maintCost;
    let sell = n(sellInput);
    if (mode === "quote") {
      sell = target === "cpl"
        ? computeSellFromCpl(buy, n(targetCpl))
        : computeSellFromGpPct(buy, n(targetPct));
    }
    const metrics = deriveMetrics({ buy, sell, litres: n(litres), truckCost });
    const revenue = n(litres) * sell;
    return {
      sell,
      cpl: sell - buy,
      pct: metrics.gpPct,
      markupPct: metrics.markupPct,
      revenue,
      gm: metrics.grossMargin$,
      truckCost,
      contribution: metrics.contribution$,
      truckKm, totalHours, wageCost, truckFuelCost, maintCost,
    };
  }, [mode, buy, litres, target, targetCpl, targetPct, sellInput, driveMin,
      driverWage, loadMin, truckLper100, truckDieselPrice, maintPerKm]);

  const status = useMemo(() => priceStatus({
    buy,
    sell: r.sell,
    litres: n(litres),
    termsDays: paymentTerms,
    clientEstablished,
    isAdmin,
  }), [buy, r.sell, litres, paymentTerms, clientEstablished, isAdmin]);

  // Clamp user-typed % target up to the floor (informational — real block is in status).
  useEffect(() => {
    if (mode !== "quote" || target !== "pct") return;
    if (targetPct == null) return;
    const c = clampToFloor(targetPct, status.floorPct);
    if (c.clamped && targetPct < status.floorPct) {
      setTargetPct(status.floorPct);
      setClampWarning(`Raised to floor of ${status.floorPct.toFixed(0)}% GP for the selected terms/volume.`);
    }
  }, [targetPct, status.floorPct, mode, target]);

  const money = (n: number) =>
    isFinite(n) ? "$" + Math.round(n).toLocaleString("en-AU") : "$0";

  const canSend = status.canSend || (isAdmin && ownerOverride);

  const handleEmailRate = async () => {
    await logSalesActivity({
      client_name: customerNameInput || selectedClient?.company_name || "one-off",
      client_email: customerEmailInput || null,
      litres: n(litres),
      terms_days: paymentTerms,
      sell_price_per_litre: r.sell,
      buy_price_per_litre: buy,
      gp_pct: r.pct,
      status: (isAdmin && ownerOverride && !status.canSend) ? "overridden" : "emailed_rate",
      source: "price_a_drop",
      metadata: { level: status.level, floorPct: status.floorPct, tier: status.tier.label },
    });
    setComposerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header / live buy price */}
      <Card className="p-6 bg-card border-border">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              PACC Energy · Internal
            </div>
            <h2 className="text-2xl font-semibold text-foreground mt-1">
              Price a Drop
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {isRep
                ? "Live pricing calculator. Buy figure auto-selects the cheapest available supply."
                : "Live buy prices: Pro Fusion = Viva Melbourne TGP − 1.5c (inc-GST). Pacific = scraped from supplier email (inc-GST). Admin only."}
            </p>
          </div>

          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {isRep ? "Buy" : `Buy price (${supplier})`}
            </div>
            {loading ? (
              <div className="text-muted-foreground mt-1">…</div>
            ) : (
              <>
                <div className="text-4xl font-bold text-accent leading-tight mt-1">
                  {buy ? `$${buy.toFixed(4)}` : "—"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">inc-GST</div>
                <div className="text-sm text-muted-foreground tabular-nums mt-1">
                  {buy ? `$${buyExGst.toFixed(4)}` : "—"} <span className="text-[10px]">ex-GST</span>
                </div>
                {priceRow && !isRep && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{priceRow.supplier}</span>
                    <span>·</span>
                    <span>effective {priceRow.price_date}</span>
                  </div>
                )}
                {priceRow && isRep && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    <span>effective {priceRow.price_date}</span>
                  </div>
                )}
                {stale && !isRep && (
                  <Badge variant="destructive" className="mt-2">
                    stale — no price for today
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>

        {err && (
          <div className="mt-4 text-sm text-destructive">{err}</div>
        )}

        {/* Supplier picker — admin only */}
        {!isRep && (
          <div className="mt-5 flex gap-2">
            {SUPPLIERS.map((s) => (
              <Button
                key={s}
                variant={supplier === s ? "default" : "outline"}
                size="sm"
                onClick={() => setSupplier(s)}
              >
                {s}
                {rows[s] && (
                  <span className="ml-2 opacity-70 text-[10px] tabular-nums flex flex-col leading-tight">
                    <span>${Number(rows[s]!.price_per_litre).toFixed(4)} inc</span>
                    <span>${(Number(rows[s]!.price_per_litre) / 1.1).toFixed(4)} ex · {rows[s]!.price_date}</span>
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}

        {/* Manual override — admin only */}
        {!isRep && (
          <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={manualBuy !== null}
                onChange={(e) =>
                  setManualBuy(e.target.checked ? buy || 1.55 : null)
                }
              />
              Override buy price manually
            </label>
            {manualBuy !== null && (
              <NumberField
                value={manualBuy}
                step="0.0001"
                onChange={(v) => setManualBuy(v)}
                className="w-32"
              />
            )}
          </div>
        )}
      </Card>

      {/* Customer + payment terms */}
      <Card className="p-6 bg-card border-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Customer
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              Pick a repeat client to pull their payment terms, or leave blank for a one-off.
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Client
            </Label>
            <Select
              value={clientId === null ? "__none" : String(clientId)}
              onValueChange={(v) => setClientId(v === "__none" ? null : Number(v))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select client…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">One-off / not listed</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.company_name}
                    {c.payment_terms_days != null ? ` · ${c.payment_terms_days}d` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Payment terms (days)
            </Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {PAYMENT_TERM_OPTIONS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={paymentTerms === d ? "default" : "outline"}
                  onClick={() => setPaymentTerms(d)}
                >
                  {d === 0 ? "COD" : `${d}d`}
                </Button>
              ))}
              <NumberField
                value={paymentTerms}
                onChange={(v) => setPaymentTerms(v)}
                placeholder="Custom"
                className="w-24"
              />
            </div>
            {selectedClient && termsChanged && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Saved: {selectedClient.payment_terms_days != null ? `${selectedClient.payment_terms_days}d` : "—"}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs"
                  disabled={savingTerms}
                  onClick={saveTermsForClient}
                >
                  {savingTerms ? "Saving…" : `Save as default for ${selectedClient.company_name}`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {(["quote", "check"] as Mode[]).map((m) => (
          <Button
            key={m}
            variant={mode === m ? "default" : "outline"}
            className="flex-1"
            onClick={() => setMode(m)}
          >
            {m === "quote" ? "Price a drop" : "Check a price"}
          </Button>
        ))}
      </div>

      {/* Inputs */}
      <Card className="p-6 bg-card border-border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Litres
            </Label>
            <NumberField
              value={litres}
              onChange={setLitres}
              className="text-xl font-semibold mt-1"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Drive each way (min)
            </Label>
            <NumberField
              value={driveMin}
              onChange={setDriveMin}
              className="text-xl font-semibold mt-1"
            />
          </div>
        </div>

        {/* Truck cost build-up */}
        <div className="pt-2 border-t border-border">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Truck cost build-up
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="col-span-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Driver $/hr</Label>
              <div className="flex gap-1 mt-1">
                {([
                  { k: "normal" as const, l: "Normal $60" },
                  { k: "ot" as const, l: "OT $90" },
                  ...(isDriver ? [] : [{ k: "custom" as const, l: "Custom" }]),
                ]).map((opt) => (
                  <button
                    key={opt.k}
                    type="button"
                    onClick={() => setWagePreset(opt.k)}
                    className={cn(
                      "text-[11px] px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors",
                      wageMode === opt.k
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
              {wageMode === "custom" && !isDriver && (
                <NumberField value={driverWage} step="0.5" onChange={setDriverWage} className="mt-1.5" />
              )}
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Load/unload min</Label>
              <NumberField value={loadMin} onChange={setLoadMin} className="mt-1" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Truck L/100km</Label>
              <NumberField value={truckLper100} step="0.5" onChange={setTruckLper100} className="mt-1" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Diesel $/L</Label>
              <NumberField value={truckDieselPrice} step="0.01" onChange={setTruckDieselPrice} className="mt-1" />
            </div>
            {!isDriver && (
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Tyres+maint $/km</Label>
                <NumberField value={maintPerKm} step="0.01" onChange={setMaintPerKm} className="mt-1" />
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Driver wage standardised at $60/hr normal, $90/hr OT (1.5×). Maint covers tyres, servicing, rego, insurance per km. Yard/admin overhead excluded.
          </p>
        </div>

        {mode === "quote" ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              {(["cpl", "pct"] as Target[]).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={target === t ? "secondary" : "ghost"}
                  className="flex-1"
                  onClick={() => setTarget(t)}
                >
                  {t === "cpl" ? "Target cents/L" : "Target % margin"}
                </Button>
              ))}
            </div>
            {target === "cpl" ? (
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Margin (cents per litre)
                </Label>
                <NumberField
                  value={targetCpl}
                  onChange={setTargetCpl}
                  className="text-xl font-semibold mt-1"
                />
              </div>
            ) : (
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Margin (% of sell)
                </Label>
                <NumberField
                  value={targetPct}
                  onChange={setTargetPct}
                  className="text-xl font-semibold mt-1"
                />
              </div>
            )}
          </div>
        ) : (
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Your sell price ($/L)
            </Label>
            <NumberField
              value={sellInput}
              step="0.001"
              onChange={setSellInput}
              className="text-xl font-semibold mt-1"
            />
          </div>
        )}
      </Card>

      {/* Result */}
      <Card className={cn("p-6 border-border", "bg-gradient-to-br from-accent/15 to-card")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {mode === "quote" ? "Quote this price" : "Your margin"}
            </div>
            <div className="text-5xl font-bold text-foreground leading-none mt-2">
              ${r.sell.toFixed(3)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">per litre (inc-GST)</div>
          </div>
          <div className="md:text-right">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Contribution to you
            </div>
            <div
              className={cn(
                "text-4xl font-bold leading-none mt-2",
                r.contribution >= 0 ? "text-accent" : "text-destructive"
              )}
            >
              {money(r.contribution)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {r.pct.toFixed(1)}% · {(r.cpl * 100).toFixed(1)}¢/L
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Stat label="Total quote" value={money(r.revenue)} />
          <Stat label="Gross margin" value={money(r.gm)} />
          <Stat
            label="Truck cost"
            value={money(r.truckCost)}
            sub={`${r.truckKm.toFixed(0)} km · ${r.totalHours.toFixed(1)}h`}
          />
          <Stat label="Buy used" value={`$${buy.toFixed(4)}`} sub={manualBuy !== null ? "manual" : supplier} />
          {paymentTerms != null && (
            <Stat
              label="Payment terms"
              value={paymentTerms === 0 ? "COD" : `${paymentTerms} days`}
              sub={selectedClient ? selectedClient.company_name : "one-off"}
            />
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4 text-sm">
          <Stat label="· Driver wage" value={money(r.wageCost)} sub={`${r.totalHours.toFixed(1)}h @ $${n(driverWage)}/hr`} />
          <Stat label="· Truck fuel" value={money(r.truckFuelCost)} sub={`${(r.truckKm * n(truckLper100) / 100).toFixed(1)} L @ $${n(truckDieselPrice).toFixed(2)}`} />
          <Stat label="· Tyres + maint" value={money(r.maintCost)} sub={`${r.truckKm.toFixed(0)} km @ $${n(maintPerKm).toFixed(2)}/km`} />
        </div>

        <div className="mt-6 pt-4 border-t border-border space-y-3">
          {/* Client established toggle */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-muted-foreground">
              <input
                type="checkbox"
                checked={clientEstablished}
                onChange={(e) => setClientEstablished(e.target.checked)}
              />
              Established client (unlock sub-tier floors on 2,500 L+ drops)
            </label>
            <span className="text-muted-foreground">
              Sell inc-GST: <span className="text-foreground font-semibold">${r.sell.toFixed(4)}/L</span>
              &nbsp;·&nbsp;{r.pct.toFixed(1)}% GP · markup {r.markupPct.toFixed(1)}% · {(r.cpl * 100).toFixed(1)}¢/L
            </span>
          </div>

          {clampWarning && (
            <div className="text-[11px] text-amber-300">{clampWarning}</div>
          )}

          <PriceStatusBanner status={status} />

          {/* Customer capture (used for logging + composer + rep approval request) */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={customerNameInput}
              onChange={(e) => setCustomerNameInput(e.target.value)}
              placeholder={selectedClient ? selectedClient.company_name : "Customer name"}
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none"
            />
            <input
              value={customerEmailInput}
              onChange={(e) => setCustomerEmailInput(e.target.value)}
              placeholder="Email (optional)"
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none"
            />
          </div>

          {/* Admin manual override checkbox — appears only when blocked and admin */}
          {isAdmin && !status.canSend && (
            <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer">
              <input
                type="checkbox"
                checked={ownerOverride}
                onChange={(e) => setOwnerOverride(e.target.checked)}
              />
              Owner override — I accept the risk and want to send anyway (logged)
            </label>
          )}

          <div className="flex justify-end gap-2">
            {isRep && !status.canSend ? (
              <Button
                onClick={() => {
                  if (!customerNameInput && !selectedClient) return;
                  setApprovalOpen(true);
                }}
                disabled={!r.sell || r.sell <= 0 || (!customerNameInput && !selectedClient)}
              >
                <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Request admin approval
              </Button>
            ) : (
              <Button
                onClick={handleEmailRate}
                disabled={!canSend || !r.sell || r.sell <= 0}
              >
                <Mail className="w-3.5 h-3.5 mr-1.5" /> Email this rate
              </Button>
            )}
          </div>

          <RequestApprovalDialog
            open={approvalOpen}
            onClose={() => setApprovalOpen(false)}
            preset={{
              customer_name: customerNameInput || selectedClient?.company_name || "",
              customer_email: customerEmailInput || null,
              litres: n(litres),
              buy_price_per_litre: buy,
              sell_price_per_litre: r.sell,
              margin_pct: r.pct,
              payment_terms_days: paymentTerms,
              supplier: isRep ? null : (manualBuy !== null ? "manual" : supplier),
              breach_reasons: [status.message],
            }}
          />
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Contribution is after driver, truck fuel and per-km wear. Yard rent, office, software and admin overheads still excluded. Admin tool — never client-facing.
      </p>

      <OutreachComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        defaultCategory="cold"
        sellPricePerLitre={r.sell}
        company={selectedClient?.company_name}
      />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold text-foreground mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}