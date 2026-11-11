import { Link } from "react-router-dom";
export function RatesMissingNotice({ unpricedLitres, unpricedCustomers, ratesMissing }: { unpricedLitres: number; unpricedCustomers: number; ratesMissing: boolean }) {
  if (!ratesMissing) return null;
  return <div className="text-warning border-y border-border py-3 text-sm flex flex-wrap gap-2 items-center"><strong>Rates missing</strong><span>{unpricedLitres.toLocaleString("en-AU", { maximumFractionDigits: 2 })} unpriced litres, {unpricedCustomers} customers. Revenue and profit are incomplete.</span><Link className="underline" to="/customers?tab=pricing">Client Pricing</Link></div>;
}