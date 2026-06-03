import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout";
import { Spinner } from "@/components/ui/spinner";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import POS from "@/pages/pos";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import Stock from "@/pages/stock";
import Customers from "@/pages/customers";
import Debts from "@/pages/debts";
import Sales from "@/pages/sales";
import Reports from "@/pages/reports";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, fullscreen = false, ...rest }: any) {
  return (
    <Route
      {...rest}
      component={() => {
        const { user, isLoading } = useAuth();
        if (isLoading) {
          return (
            <div className="min-h-screen flex items-center justify-center">
              <Spinner className="w-8 h-8 text-primary" />
            </div>
          );
        }
        if (!user) return null;
        return (
          <AppLayout fullscreen={fullscreen}>
            <Component />
          </AppLayout>
        );
      }}
    />
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      {/* Caisse = page d'accueil */}
      <ProtectedRoute path="/" component={POS} fullscreen />

      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/produits" component={Products} />
      <ProtectedRoute path="/stock" component={Stock} />
      <ProtectedRoute path="/clients" component={Customers} />
      <ProtectedRoute path="/dettes" component={Debts} />
      <ProtectedRoute path="/ventes" component={Sales} />
      <ProtectedRoute path="/rapports" component={Reports} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
