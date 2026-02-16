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
            <Navigate to="/" replace />
          ) : user ? (
            <PortalRoot />
          ) : (
            <Navigate to="/portal/login" replace />
          )
        } />

        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Admin routes - require admin auth */}
        <Route path="/" element={user && role === "admin" ? <Layout><Overview /></Layout> : <Navigate to="/portal/login" replace />} />
        <Route path="/customers" element={user && role === "admin" ? <Layout><Customers /></Layout> : <Navigate to="/portal/login" replace />} />
        <Route path="/customers/:name" element={user && role === "admin" ? <Layout><CustomerDetail /></Layout> : <Navigate to="/portal/login" replace />} />
        <Route path="/trucks" element={user && role === "admin" ? <Layout><Trucks /></Layout> : <Navigate to="/portal/login" replace />} />
        <Route path="/drivers" element={user && role === "admin" ? <Layout><Drivers /></Layout> : <Navigate to="/portal/login" replace />} />
        <Route path="/transactions" element={user && role === "admin" ? <Layout><Transactions /></Layout> : <Navigate to="/portal/login" replace />} />
        <Route path="/client-management" element={user && role === "admin" ? <Layout><ClientManagement /></Layout> : <Navigate to="/portal/login" replace />} />
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
