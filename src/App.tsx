import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { DateRangeProvider } from "@/hooks/useDateRange";
import { DemoProvider } from "@/hooks/useDemo";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import Overview from "./pages/Overview";
import Customers from "./pages/Customers";
import CustomerHub from "./pages/CustomerHub";
import Performance from "./pages/Performance";
import Transactions from "./pages/Transactions";
import Finance from "./pages/Finance";
import DeliveryDocket from "./pages/DeliveryDocket";
import CustomerPortal from "./pages/CustomerPortal";
import DriverPortal from "./pages/DriverPortal";
import Admin from "./pages/Admin";
import Operations from "./pages/Operations";
import Reconciliation from "./pages/Reconciliation";
import TagDeliveries from "./pages/TagDeliveries";
import Outreach from "./pages/Outreach";
import TruckPortal from "./pages/TruckPortal";

import Dispatch from "./pages/Dispatch";
import Suppliers from "./pages/Suppliers";
import MarketIntelligence from "./pages/MarketIntelligence";
import CRM from "./pages/CRM";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import BrandCheck from "./pages/BrandCheck";
import { DemoBanner } from "./components/DemoBanner";
import { ScrollToTop } from "./components/ScrollToTop";

const queryClient = new QueryClient();

function DemoAwareRoutes() {
  const [params] = useSearchParams();
  const isDemo = params.get("demo") === "true";

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/brand-check" element={<BrandCheck />} />
      <Route path="/docket/multi" element={<DeliveryDocket />} />
      <Route path="/docket/:id" element={<DeliveryDocket />} />
      {/* In demo mode, portal/driver get the sidebar Layout */}
      {isDemo ? (
        <>
        <Route path="/operations" element={<Operations />} />
        <Route path="/operations/customers/:name" element={<CustomerHub />} />
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:name" element={<CustomerHub />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/finance" element={<Finance />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/dispatch" element={<Dispatch />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/market" element={<MarketIntelligence />} />
                <Route path="/admin/tag-deliveries" element={<TagDeliveries />} />
                <Route path="/trucks" element={<TruckPortal />} />
                <Route path="/portal" element={<CustomerPortal />} />
                <Route path="/portal/deliveries" element={<CustomerPortal forcedTab="Deliveries" />} />
                <Route path="/portal/fleet" element={<CustomerPortal forcedTab="Fleet" />} />
                <Route path="/portal/reports" element={<CustomerPortal forcedTab="Reports" />} />
                <Route path="/portal/profile" element={<CustomerPortal forcedTab="Profile" />} />
                <Route path="/portal/help" element={<CustomerPortal forcedTab="Help" />} />
                <Route path="/driver" element={<DriverPortal />} />
                <Route path="/admin/outreach" element={<Outreach />} />
                <Route path="/crm" element={<CRM />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          }
        />
        </>
      ) : (
        <>
          <Route path="/portal" element={<CustomerPortal />} />
          <Route path="/portal/deliveries" element={<CustomerPortal forcedTab="Deliveries" />} />
          <Route path="/portal/fleet" element={<CustomerPortal forcedTab="Fleet" />} />
          <Route path="/portal/reports" element={<CustomerPortal forcedTab="Reports" />} />
          <Route path="/portal/profile" element={<CustomerPortal forcedTab="Profile" />} />
          <Route path="/portal/help" element={<CustomerPortal forcedTab="Help" />} />
          <Route path="/driver" element={<DriverPortal />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/operations/customers/:name" element={<CustomerHub />} />
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<Overview />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/customers/:name" element={<CustomerHub />} />
                  <Route path="/performance" element={<Performance />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/finance" element={<Finance />} />
                   <Route path="/admin" element={<Admin />} />
                   <Route path="/dispatch" element={<Dispatch />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/market" element={<MarketIntelligence />} />
                  <Route path="/admin/tag-deliveries" element={<TagDeliveries />} />
                  <Route path="/trucks" element={<TruckPortal />} />
                  <Route path="/admin/outreach" element={<Outreach />} />
                  <Route path="/crm" element={<CRM />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            }
          />
        </>
      )}
    </Routes>
  );
}

type UserRole = "admin" | "client" | "driver" | "operations" | null;

const PUBLIC_PATHS = ["/login", "/landing", "/reset-password"];
const ALWAYS_PUBLIC_PATHS = ["/landing"];

async function getUserRole(userId: string): Promise<UserRole> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error) return null;

  return (data?.role as UserRole) || null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const isDemo = params.get("demo") === "true";

  // In demo mode, skip auth entirely
  useEffect(() => {
    if (isDemo) {
      setRole("admin");
      setLoading(false);
      return;
    }

    const redirectSignedOut = (path: string) => {
      if (!PUBLIC_PATHS.includes(path) && !path.startsWith("/docket")) {
        navigate(path === "/" ? "/landing" : "/login", { replace: true });
      }
    };

    const redirectByRole = (userRole: UserRole, path: string) => {
      // Always allow viewing the public marketing page
      if (ALWAYS_PUBLIC_PATHS.includes(path)) return;
      if (userRole === "client" && !path.startsWith("/portal") && !path.startsWith("/docket")) {
        navigate("/portal", { replace: true });
      }
      if (userRole === "driver" && !path.startsWith("/driver") && !path.startsWith("/docket")) {
        navigate("/driver", { replace: true });
      }
      if (userRole === "operations" && !path.startsWith("/operations") && !path.startsWith("/docket")) {
        navigate("/operations", { replace: true });
      }
    };

    const loadRole = async (userId: string, path: string) => {
      const userRole = await getUserRole(userId);
      setRole(userRole);
      setLoading(false);
      redirectByRole(userRole, path);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentPath = window.location.pathname;
      if (!session) {
        setRole(null);
        setLoading(false);
        redirectSignedOut(currentPath);
        return;
      }
      void loadRole(session.user.id, currentPath);
    });

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentPath = window.location.pathname;
      if (!session) {
        setRole(null);
        setLoading(false);
        redirectSignedOut(currentPath);
        return;
      }
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        await supabase.auth.signOut();
        setRole(null);
        setLoading(false);
        redirectSignedOut(currentPath);
        return;
      }
      await loadRole(user.id, currentPath);
    };

    checkAuth();
    return () => subscription.unsubscribe();
  }, [isDemo]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  // Not logged in — allow public pages
  if (!role && !isDemo) {
    if (PUBLIC_PATHS.includes(location.pathname) || location.pathname.startsWith("/docket")) {
      return <>{children}</>;
    }
    if (location.pathname === "/") {
      return <Navigate to="/landing" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  const isPublicAuthPath = PUBLIC_PATHS.includes(location.pathname);

  // /landing is the canonical marketing URL — always render it, regardless of session
  if (ALWAYS_PUBLIC_PATHS.includes(location.pathname)) {
    return <>{children}</>;
  }

  if (role === "admin" && isPublicAuthPath) {
    return <Navigate to="/" replace />;
  }

  if (!isDemo) {
    if (role === "client") {
      if (location.pathname.startsWith("/portal") || location.pathname.startsWith("/docket")) {
        return <>{children}</>;
      }
      return <Navigate to="/portal" replace />;
    }
    if (role === "driver") {
      if (location.pathname.startsWith("/driver") || location.pathname.startsWith("/docket")) {
        return <>{children}</>;
      }
      return <Navigate to="/driver" replace />;
    }
    if (role === "operations") {
      if (location.pathname.startsWith("/operations") || location.pathname.startsWith("/docket")) {
        return <>{children}</>;
      }
      return <Navigate to="/operations" replace />;
    }
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DemoProvider>
          <AuthGate>
            <DateRangeProvider>
              <ScrollToTop />
              <DemoBanner />
              <DemoAwareRoutes />
            </DateRangeProvider>
          </AuthGate>
        </DemoProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
