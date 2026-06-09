import LiveDropCalculator from "@/components/admin/LiveDropCalculator";
import { PageHeader } from "@/components/PageHeader";

export default function Pricing() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Price a Drop"
        subtitle="Live buy-price-aware quoting calculator (admin only)"
        showPeriod={false}
      />
      <LiveDropCalculator />
    </div>
  );
}