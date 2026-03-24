import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DateRangeProvider } from "@/hooks/useDateRange";
import { Layout } from "@/components/Layout";
import Overview from "./pages/Overview";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Performance from "./pages/Performance";
import Transactions from "./pages/Transactions";
import Finance from "./pages/Finance";
import DeliveryDocket from "./pages/DeliveryDocket";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DateRangeProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:name" element={<CustomerDetail />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/docket/multi" element={<DeliveryDocket />} />
              <Route path="/docket/:id" element={<DeliveryDocket />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </DateRangeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
