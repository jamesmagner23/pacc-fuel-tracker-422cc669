import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { DateRangeProvider } from "@/hooks/useDateRange";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import Overview from "./pages/Overview";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Performance from "./pages/Performance";
import Transactions from "./pages/Transactions";
import Finance from "./pages/Finance";
import DeliveryDocket from "./pages/DeliveryDocket";
import CustomerPortal from "./pages/CustomerPortal";
import DriverPortal from "./pages/DriverPortal";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

type UserRole = "admin" | "client" | "driver" | null;

function AuthGate({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Set up auth listener FIRST (before getSession)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !["/login", "/landing", "/reset-password"].includes(location.pathname) && !location.pathname.startsWith("/docket")) {
        setRole(null);
        setLoading(false);
        navigate("/login", { replace: true });
      } else if (session) {
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single()
          .then(({ data }) => {
            const r = (data?.role as UserRole) || null;
            setRole(r);
            setLoading(false);
            if (r === "client" && !window.location.pathname.startsWith("/portal") && !window.location.pathname.startsWith("/docket")) {
              navigate("/portal", { replace: true });
            }
            if (r === "driver" && !window.location.pathname.startsWith("/driver") && !window.location.pathname.startsWith("/docket")) {
              navigate("/driver", { replace: true });
            }
          });
      }
    });

    // Then check existing session
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setRole(null);
        setLoading(false);
        const publicPaths = ["/login", "/landing", "/reset-password"];
        if (!publicPaths.includes(location.pathname) && !location.pathname.startsWith("/docket")) {
          if (location.pathname === "/") {
            navigate("/landing", { replace: true });
          } else {
            navigate("/login", { replace: true });
          }
        }
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      const userRole = (roleData?.role as UserRole) || null;
      setRole(userRole);
      setLoading(false);

      if (userRole === "client" && !location.pathname.startsWith("/portal") && !location.pathname.startsWith("/docket")) {
        navigate("/portal", { replace: true });
      }
      if (userRole === "driver" && !location.pathname.startsWith("/driver") && !location.pathname.startsWith("/docket")) {
        navigate("/driver", { replace: true });
      }
    };

    checkAuth();

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  // Not logged in — allow public pages
  if (!role) {
    const publicPaths = ["/login", "/landing", "/reset-password"];
    if (publicPaths.includes(location.pathname) || location.pathname.startsWith("/docket")) {
      return <>{children}</>;
    }
    if (location.pathname === "/") {
      return <Navigate to="/landing" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // Client role — allow portal + docket routes
  if (role === "client") {
    if (location.pathname.startsWith("/portal") || location.pathname.startsWith("/docket")) {
      return <>{children}</>;
    }
    return <Navigate to="/portal" replace />;
  }

  // Driver role — allow driver + docket routes
  if (role === "driver") {
    if (location.pathname.startsWith("/driver") || location.pathname.startsWith("/docket")) {
      return <>{children}</>;
    }
    return <Navigate to="/driver" replace />;
  }

  // Admin or login page — render normally
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthGate>
          <DateRangeProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/portal" element={<CustomerPortal />} />
              <Route path="/driver" element={<DriverPortal />} />
              <Route path="/docket/multi" element={<DeliveryDocket />} />
              <Route path="/docket/:id" element={<DeliveryDocket />} />
              <Route
                path="/*"
                element={
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Overview />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/customers/:name" element={<CustomerDetail />} />
                      <Route path="/performance" element={<Performance />} />
                      <Route path="/transactions" element={<Transactions />} />
                      <Route path="/finance" element={<Finance />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Layout>
                }
              />
            </Routes>
          </DateRangeProvider>
        </AuthGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
