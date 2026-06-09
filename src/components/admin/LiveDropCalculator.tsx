import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
// Both suppliers feed in inc-GST. We show and calc everything inc-GST.

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
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Record<string, BuyRow | null>>({});
  const [supplier, setSupplier] = useState<string>("Pro Fusion");
  const [err, setErr] = useState<string | null>(null);

  const [manualBuy, setManualBuy] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("quote");
  const [litres, setLitres] = useState<number | null>(3000);

  const [target, setTarget] = useState<Target>("cpl");
  const [targetCpl, setTargetCpl] = useState<number | null>(27);
  const [targetPct, setTargetPct] = useState<number | null>(15);
  const [sellInput, setSellInput] = useState<number | null>(1.82);

  const [driveMin, setDriveMin] = useState<number | null>(20);
  const speed = 40; // km/h average
  const truckPerKm = 0.65;

  // Client + payment terms
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [paymentTerms, setPaymentTerms] = useState<number | null>(null);
  const [savingTerms, setSavingTerms] = useState(false);

  useEffect(() => {
    (async () => {
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
  const todayMel = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
  const stale = !priceRow || priceRow.price_date < todayMel;

  const r = useMemo(() => {
    const dm = n(driveMin);
    const truckKm = (dm / 60) * speed * 2; // round trip
    const truckCost = truckKm * truckPerKm;
    let sell = n(sellInput);
    if (mode === "quote") {
      sell =
        target === "cpl"
          ? buy + n(targetCpl) / 100
          : n(targetPct) < 100
          ? buy / (1 - n(targetPct) / 100)
          : buy;
    }
    const cpl = sell - buy;
    const pct = sell > 0 ? (cpl / sell) * 100 : 0;
    const revenue = n(litres) * sell;
    const gm = n(litres) * cpl;
    const contribution = gm - truckCost;
    return { sell, cpl, pct, revenue, gm, truckCost, contribution };
  }, [mode, buy, litres, target, targetCpl, targetPct, sellInput, driveMin]);

  const money = (n: number) =>
    isFinite(n) ? "$" + Math.round(n).toLocaleString("en-AU") : "$0";

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
              Live supplier buy price feeds in from Viva TGP (Pro Fusion) and supplier email scraping (Pacific). Admin only. All prices shown inc-GST.
            </p>
          </div>

          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Today's buy ({supplier}) · inc-GST
            </div>
            {loading ? (
              <div className="text-muted-foreground mt-1">…</div>
            ) : (
              <>
                <div className="text-4xl font-bold text-accent leading-tight mt-1">
                  {buy ? `$${buy.toFixed(4)}` : "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {priceRow
                    ? `${priceRow.supplier} · effective ${priceRow.price_date}`
                    : "no price loaded"}
                </div>
                {stale && (
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

        {/* Supplier picker */}
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
                <span className="ml-2 opacity-70 text-xs">
                  ${Number(rows[s]!.price_per_litre).toFixed(3)}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Manual override */}
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
          <Stat label="Truck cost" value={money(r.truckCost)} sub={`${((n(driveMin) / 60) * speed * 2).toFixed(0)} km @ $${truckPerKm}/km`} />
          <Stat label="Buy used" value={`$${buy.toFixed(4)}`} sub={manualBuy !== null ? "manual" : supplier} />
          {paymentTerms != null && (
            <Stat
              label="Payment terms"
              value={paymentTerms === 0 ? "COD" : `${paymentTerms} days`}
              sub={selectedClient ? selectedClient.company_name : "one-off"}
            />
          )}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Driver wage excluded (full-time). Contribution is before yard, insurance, rego, software and admin overheads. Admin tool — never client-facing.
      </p>
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