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
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

type UserRole = "admin" | "client" | null;

function AuthGate({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setRole(null);
        setLoading(false);
        if (location.pathname !== "/login") {
          navigate("/login", { replace: true });
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

      if (userRole === "client" && !location.pathname.startsWith("/portal")) {
        navigate("/portal", { replace: true });
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && location.pathname !== "/login") {
        setRole(null);
        navigate("/login", { replace: true });
      } else if (session) {
        // Re-check role on auth change
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single()
          .then(({ data }) => {
            const r = (data?.role as UserRole) || null;
            setRole(r);
            if (r === "client" && !window.location.pathname.startsWith("/portal")) {
              navigate("/portal", { replace: true });
            }
          });
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  // Not logged in — only show login page
  if (!role && location.pathname !== "/login") {
    return <Navigate to="/login" replace />;
  }

  // Client role — only allow portal routes
  if (role === "client") {
    if (location.pathname.startsWith("/portal")) {
      return <>{children}</>;
    }
    return <Navigate to="/portal" replace />;
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
              <Route path="/portal" element={<CustomerPortal />} />
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
                      <Route path="/docket/multi" element={<DeliveryDocket />} />
                      <Route path="/docket/:id" element={<DeliveryDocket />} />
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
