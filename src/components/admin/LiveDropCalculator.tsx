import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Mode = "quote" | "check";
type Target = "cpl" | "pct";
type BuyRow = {
  supplier: string;
  price_per_litre: number;
  price_date: string;
  notes: string | null;
};

const SUPPLIERS = ["Pro Fusion", "Pacific"] as const;
// Pro Fusion feeds in inc-GST (from Viva TGP). Pacific is supplied ex-GST.
// Normalise everything to ex-GST for margin maths.
const GST_INCLUSIVE: Record<string, boolean> = {
  "Pro Fusion": true,
  Pacific: false,
};
const toExGst = (supplierName: string, price: number) =>
  GST_INCLUSIVE[supplierName] ? price / 1.1 : price;

export default function LiveDropCalculator() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Record<string, BuyRow | null>>({});
  const [supplier, setSupplier] = useState<string>("Pro Fusion");
  const [err, setErr] = useState<string | null>(null);

  const [manualBuy, setManualBuy] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("quote");
  const [litres, setLitres] = useState(3000);

  const [target, setTarget] = useState<Target>("cpl");
  const [targetCpl, setTargetCpl] = useState(27);
  const [targetPct, setTargetPct] = useState(15);
  const [sellInput, setSellInput] = useState(1.82);

  const [driveMin, setDriveMin] = useState(20);
  const speed = 40; // km/h average
  const truckPerKm = 0.65;

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

  const priceRow = rows[supplier] ?? null;
  const rawBuy = priceRow ? Number(priceRow.price_per_litre) : 0;
  const buy = manualBuy ?? (priceRow ? toExGst(supplier, rawBuy) : 0);
  const todayMel = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
  const stale = !priceRow || priceRow.price_date < todayMel;

  const r = useMemo(() => {
    const truckKm = (driveMin / 60) * speed * 2; // round trip
    const truckCost = truckKm * truckPerKm;
    let sell = sellInput;
    if (mode === "quote") {
      sell =
        target === "cpl"
          ? buy + targetCpl / 100
          : targetPct < 100
          ? buy / (1 - targetPct / 100)
          : buy;
    }
    const cpl = sell - buy;
    const pct = sell > 0 ? (cpl / sell) * 100 : 0;
    const revenue = litres * sell;
    const gm = litres * cpl;
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
              Live supplier buy price feeds in from Viva TGP (Pro Fusion) and supplier email scraping (Pacific). Admin only.
              {" "}Pro Fusion is inc-GST and Pacific is ex-GST; both shown ex-GST.
            </p>
          </div>

          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Today's buy ({supplier})
              {" "}· ex-GST
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
                  ${toExGst(s, Number(rows[s]!.price_per_litre)).toFixed(3)}
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
            <Input
              type="number"
              step="0.0001"
              value={manualBuy}
              onChange={(e) => setManualBuy(parseFloat(e.target.value) || 0)}
              className="w-32"
            />
          )}
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
            <Input
              type="number"
              value={litres}
              onChange={(e) => setLitres(parseFloat(e.target.value) || 0)}
              className="text-xl font-semibold mt-1"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Drive each way (min)
            </Label>
            <Input
              type="number"
              value={driveMin}
              onChange={(e) => setDriveMin(parseFloat(e.target.value) || 0)}
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
                <Input
                  type="number"
                  value={targetCpl}
                  onChange={(e) =>
                    setTargetCpl(parseFloat(e.target.value) || 0)
                  }
                  className="text-xl font-semibold mt-1"
                />
              </div>
            ) : (
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Margin (% of sell)
                </Label>
                <Input
                  type="number"
                  value={targetPct}
                  onChange={(e) =>
                    setTargetPct(parseFloat(e.target.value) || 0)
                  }
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
            <Input
              type="number"
              step="0.001"
              value={sellInput}
              onChange={(e) => setSellInput(parseFloat(e.target.value) || 0)}
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
            <div className="text-sm text-muted-foreground mt-1">per litre (ex-GST)</div>
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
          <Stat label="Truck cost" value={money(r.truckCost)} sub={`${((driveMin / 60) * speed * 2).toFixed(0)} km @ $${truckPerKm}/km`} />
          <Stat label="Buy used" value={`$${buy.toFixed(4)}`} sub={manualBuy !== null ? "manual" : supplier} />
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