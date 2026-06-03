import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  CreditCard,
  History,
  FileBarChart,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { href: "/", label: "Caisse", icon: ShoppingCart, accent: true },
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/produits", label: "Produits", icon: Package },
  { href: "/stock", label: "Stock", icon: Boxes },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/dettes", label: "Dettes", icon: CreditCard },
  { href: "/ventes", label: "Ventes", icon: History },
  { href: "/rapports", label: "Rapports", icon: FileBarChart },
];

interface AppLayoutProps {
  children: React.ReactNode;
  fullscreen?: boolean;
}

export function AppLayout({ children, fullscreen = false }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  return (
    <SidebarProvider>
      <div className="min-h-[100dvh] flex w-full bg-muted/20 overflow-hidden">
        <Sidebar className="border-r border-border bg-card">
          <SidebarHeader className="p-4 border-b border-border">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="bg-primary text-primary-foreground p-1 rounded-md">
                <ShoppingCart className="w-5 h-5" />
              </span>
              LIMAPAY
            </h2>
            <div className="mt-1 text-sm text-muted-foreground truncate">{user.shopName}</div>
          </SidebarHeader>

          <SidebarContent className="p-2">
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.href}
                    tooltip={item.label}
                    className={
                      item.accent && location === item.href
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                        : item.accent
                        ? "font-semibold"
                        : ""
                    }
                  >
                    <Link href={item.href} className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-border">
            <div className="flex flex-col gap-3">
              <div className="text-sm">
                <p className="font-medium text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={logout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile header */}
          <header className="h-14 lg:hidden flex items-center px-4 border-b border-border bg-card shrink-0 sticky top-0 z-20">
            <SidebarTrigger className="-ml-2" />
            <h1 className="ml-2 font-bold text-lg text-primary">LIMAPAY</h1>
            {location === "/" && (
              <span className="ml-auto text-xs text-muted-foreground bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                Caisse
              </span>
            )}
          </header>

          {/* Content */}
          <div
            className={
              fullscreen
                ? "flex-1 overflow-hidden p-2 md:p-3"
                : "flex-1 overflow-auto p-4 md:p-6 lg:p-8 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
            }
          >
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
