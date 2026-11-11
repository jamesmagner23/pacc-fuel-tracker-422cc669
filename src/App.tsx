import { useEffect, useState, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { DateRangeProvider } from "@/hooks/useDateRange";
import { DemoProvider } from "@/hooks/useDemo";
const Layout = lazy(() => import("@/components/Layout").then(module => ({ default: module.Layout })));
import { supabase } from "@/integrations/supabase/client";
const Overview = lazy(() => import("./pages/Overview"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerHub = lazy(() => import("./pages/CustomerHub"));
const Performance = lazy(() => import("./pages/Performance"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Finance = lazy(() => import("./pages/Finance"));
const DeliveryDocket = lazy(() => import("./pages/DeliveryDocket"));
const CustomerPortal = lazy(() => import("./pages/CustomerPortal"));
const DriverPortal = lazy(() => import("./pages/DriverPortal"));
const Admin = lazy(() => import("./pages/Admin"));
const Operations = lazy(() => import("./pages/Operations"));
const Reconciliation = lazy(() => import("./pages/Reconciliation"));
const TagDeliveries = lazy(() => import("./pages/TagDeliveries"));
const Outreach = lazy(() => import("./pages/Outreach"));
const TruckPortal = lazy(() => import("./pages/TruckPortal"));

const Dispatch = lazy(() => import("./pages/Dispatch"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const MarketIntelligence = lazy(() => import("./pages/MarketIntelligence"));
const CRM = lazy(() => import("./pages/CRM"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Sales = lazy(() => import("./pages/Sales"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
import LandingPage from "./pages/LandingPage";
const NotFound = lazy(() => import("./pages/NotFound"));
const BrandCheck = lazy(() => import("./pages/BrandCheck"));
import { DemoBanner } from "./components/DemoBanner";
import { HelmetProvider } from "react-helmet-async";
import { alwaysPublicPaths, isKnownRoute } from "@/lib/publicRoutes";
const LegalPage = lazy(() => import("./pages/LegalPage"));
import { ScrollToTop } from "./components/ScrollToTop";

const queryClient = new QueryClient();

function LegacyPortalRedirect() {
  const location = useLocation();
  const target = location.pathname.replace(/^\/portal\/client(?:\/|$)/, "/portal/").replace(/\/$/, "");
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}

function DemoAwareRoutes() {
  const [params] = useSearchParams();
  const isDemo = params.get("demo") === "true";

  const location = useLocation();
  if (!isKnownRoute(location.pathname)) return <NotFound />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/privacy" element={<LegalPage kind="privacy" />} />
      <Route path="/terms" element={<LegalPage kind="terms" />} />
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
                <Route path="/admin/:tab" element={<Admin />} />
                <Route path="/dispatch" element={<Dispatch />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/market" element={<MarketIntelligence />} />
                <Route path="/admin/tag-deliveries" element={<TagDeliveries />} />
                <Route path="/admin/pricing" element={<Pricing />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/trucks" element={<TruckPortal />} />
                <Route path="/portal" element={<CustomerPortal />} />
          <Route path="/portal/overview" element={<CustomerPortal forcedTab="Overview" />} />
          <Route path="/portal/signed-dockets" element={<CustomerPortal forcedTab="SignedDockets" />} />
          <Route path="/portal/client/*" element={<LegacyPortalRedirect />} />
                <Route path="/portal/deliveries" element={<CustomerPortal forcedTab="Deliveries" />} />
                <Route path="/portal/fleet" element={<CustomerPortal forcedTab="Fleet" />} />
                <Route path="/portal/projects" element={<CustomerPortal forcedTab="Projects" />} />
                <Route path="/portal/reports" element={<CustomerPortal forcedTab="Reports" />} />
                <Route path="/portal/profile" element={<CustomerPortal forcedTab="Profile" />} />
                <Route path="/portal/help" element={<CustomerPortal forcedTab="Help" />} />
                <Route path="/driver" element={<DriverPortal />} />
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
          <Route path="/portal/overview" element={<CustomerPortal forcedTab="Overview" />} />
          <Route path="/portal/signed-dockets" element={<CustomerPortal forcedTab="SignedDockets" />} />
          <Route path="/portal/client/*" element={<LegacyPortalRedirect />} />
          <Route path="/portal/deliveries" element={<CustomerPortal forcedTab="Deliveries" />} />
          <Route path="/portal/fleet" element={<CustomerPortal forcedTab="Fleet" />} />
          <Route path="/portal/projects" element={<CustomerPortal forcedTab="Projects" />} />
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
                <Route path="/admin/:tab" element={<Admin />} />
                   <Route path="/dispatch" element={<Dispatch />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/market" element={<MarketIntelligence />} />
                  <Route path="/admin/tag-deliveries" element={<TagDeliveries />} />
                  <Route path="/admin/pricing" element={<Pricing />} />
                  <Route path="/sales" element={<Sales />} />
                  <Route path="/trucks" element={<TruckPortal />} />
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

const PUBLIC_PATHS = ["/login", "/landing", "/reset-password", "/privacy", "/terms"];
const ALWAYS_PUBLIC_PATHS = alwaysPublicPaths;

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
      if (!isKnownRoute(path)) return;
      if (!PUBLIC_PATHS.includes(path) && !path.startsWith("/docket")) {
        navigate(path === "/" ? "/landing" : "/login", { replace: true });
      }
    };

    const redirectByRole = (userRole: UserRole, path: string) => {
      // Always allow viewing the public marketing page
      if (ALWAYS_PUBLIC_PATHS.includes(path) || !isKnownRoute(path)) return;
      if (userRole === "client" && !path.startsWith("/portal") && !path.startsWith("/docket")) {
        navigate("/portal", { replace: true });
      }
      if (userRole === "driver" && !path.startsWith("/driver") && !path.startsWith("/docket")) {
        // Drivers are also allowed into Sales / Price a Drop (with guardrails).
        if (
          path.startsWith("/sales") ||
          path.startsWith("/admin/pricing")
        ) return;
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

  if (!isKnownRoute(location.pathname) || ALWAYS_PUBLIC_PATHS.includes(location.pathname)) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  // Not logged in - allow public pages
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

  // /landing is the canonical marketing URL - always render it, regardless of session
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
      if (
        location.pathname.startsWith("/driver") ||
        location.pathname.startsWith("/docket") ||
        location.pathname.startsWith("/sales") ||
        location.pathname.startsWith("/admin/pricing")
      ) {
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
  <HelmetProvider>
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
              <Suspense fallback={<div role="status" className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading...</div>}>
                <DemoAwareRoutes />
              </Suspense>
            </DateRangeProvider>
          </AuthGate>
        </DemoProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
