import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { transactions, customers, filterByDateRange } from "@/data/mockData";
import { format, parseISO } from "date-fns";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { range } = useDateRange();

  const customer = customers.find((c) => c.id === id);
  const filtered = useMemo(
    () => filterByDateRange(transactions, range).filter((t) => t.customerId === id),
    [range, id]
  );

  // Volume by project
  const projectData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => {
      map[t.projectName] = (map[t.projectName] || 0) + t.litres;
    });
    return Object.entries(map).map(([name, litres]) => ({ name, litres }));
  }, [filtered]);

  // Daily trend
  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => {
      map[t.date] = (map[t.date] || 0) + t.litres;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, litres]) => ({ date: format(parseISO(date), "dd MMM"), litres }));
  }, [filtered]);

  if (!customer) return <div className="p-8 text-muted-foreground">Customer not found.</div>;

  const tooltipStyle = {
    backgroundColor: "hsl(217 33% 17%)",
    border: "1px solid hsl(217 33% 25%)",
    borderRadius: "8px",
    color: "hsl(210 40% 98%)",
    fontSize: 12,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <button
        onClick={() => navigate("/customers")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </button>

      <h1 className="text-xl font-bold">{customer.name}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Volume by project */}
        <div className="glass-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">Volume by Project</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} width={140} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]} />
                <Bar dataKey="litres" fill="hsl(25 95% 53%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Delivery trend */}
        <div className="glass-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">Delivery History</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]} />
                <Line type="monotone" dataKey="litres" stroke="hsl(25 95% 53%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="glass-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">Recent Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Project</th>
                <th className="pb-2 pr-4">Truck</th>
                <th className="pb-2 pr-4 text-right">Litres</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 15).map((t) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2.5 pr-4 whitespace-nowrap">{format(parseISO(t.date), "dd MMM")} {t.time}</td>
                  <td className="py-2.5 pr-4 truncate max-w-[200px]">{t.projectName}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">{t.truckName}</td>
                  <td className="py-2.5 pr-4 text-right font-medium">{t.litres.toLocaleString()}L</td>
                  <td className="py-2.5 text-right font-medium">${t.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
