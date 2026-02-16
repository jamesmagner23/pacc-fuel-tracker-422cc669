import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DateRangeProvider } from "@/hooks/useDateRange";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import Overview from "./pages/Overview";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Trucks from "./pages/Trucks";
import Drivers from "./pages/Drivers";
import Transactions from "./pages/Transactions";
import ClientManagement from "./pages/admin/ClientManagement";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalRoot from "./pages/portal/PortalRoot";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  // If authenticated client tries to access admin routes, redirect to portal
  if (user && role === "client") {
    return (
      <Routes>
        <Route path="/portal/login" element={<Navigate to="/portal" replace />} />
        <Route path="/portal/*" element={<PortalRoot />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    );
  }

  // If authenticated admin tries /portal, show redirect message
  // Unauthenticated users can access everything (admin dashboard has no auth gate currently)
  return (
    <DateRangeProvider>
      <Routes>
        {/* Portal routes */}
        <Route path="/portal/login" element={user ? <Navigate to="/portal" replace /> : <PortalLogin />} />
        <Route path="/portal/*" element={
          user && role === "admin" ? (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
              <div className="text-center space-y-3">
                <p className="text-muted-foreground">This is the client portal.</p>
                <a href="/" className="text-primary text-sm hover:underline">Go to admin dashboard →</a>
              </div>
            </div>
          ) : user ? (
            <PortalRoot />
          ) : (
            <Navigate to="/portal/login" replace />
          )
        } />

        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Admin routes */}
        <Route path="/" element={<Layout><Overview /></Layout>} />
        <Route path="/customers" element={<Layout><Customers /></Layout>} />
        <Route path="/customers/:name" element={<Layout><CustomerDetail /></Layout>} />
        <Route path="/trucks" element={<Layout><Trucks /></Layout>} />
        <Route path="/drivers" element={<Layout><Drivers /></Layout>} />
        <Route path="/transactions" element={<Layout><Transactions /></Layout>} />
        <Route path="/client-management" element={<Layout><ClientManagement /></Layout>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </DateRangeProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
