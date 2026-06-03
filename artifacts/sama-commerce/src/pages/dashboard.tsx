import { 
  useGetDashboardSummary, 
  useGetTopProducts, 
  useGetStockAlerts,
  useListSales
} from "@workspace/api-client-react";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AlertTriangle, TrendingUp, PackageSearch, CreditCard, ShoppingCart } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: topProducts, isLoading: isLoadingTopProducts } = useGetTopProducts();
  const { data: stockAlerts, isLoading: isLoadingStockAlerts } = useGetStockAlerts();
  const { data: recentSales, isLoading: isLoadingRecentSales } = useListSales({ limit: 5 });

  if (isLoadingSummary || isLoadingTopProducts || isLoadingStockAlerts || isLoadingRecentSales) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground">Aperçu de votre activité commerciale</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary text-primary-foreground border-primary-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Revenus du jour</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary-foreground/80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.revenueToday || 0)}</div>
            <p className="text-xs text-primary-foreground/80 mt-1">
              {summary?.salesToday} ventes aujourd'hui
            </p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Revenus de la semaine</CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(summary?.revenueWeek || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.salesWeek} ventes cette semaine
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Panier moyen</CardTitle>
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(summary?.averageBasket || 0)}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Dettes totales</CardTitle>
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(summary?.totalDebtAmount || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              À recouvrer
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Sales */}
        <Card className="lg:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Ventes récentes</CardTitle>
            <CardDescription>Les 5 dernières ventes effectuées.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSales?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      Aucune vente récente
                    </TableCell>
                  </TableRow>
                ) : (
                  recentSales?.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{formatShortDate(sale.createdAt)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(sale.totalAmount)}</TableCell>
                      <TableCell className="capitalize">{sale.paymentMethod}</TableCell>
                      <TableCell>
                        <Badge variant={sale.status === 'completed' ? 'default' : 'secondary'}>
                          {sale.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Products & Alerts */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Produits les plus vendus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>
                ) : (
                  topProducts?.map((product, index) => (
                    <div key={product.productId} className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-secondary/20 text-secondary-foreground flex items-center justify-center font-bold text-sm mr-3">
                        {index + 1}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">{product.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.totalQuantity} vendus
                        </p>
                      </div>
                      <div className="font-medium text-sm">
                        {formatCurrency(product.totalRevenue)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {(stockAlerts?.lowStock.length || 0) > 0 || (stockAlerts?.outOfStock.length || 0) > 0 ? (
            <Card className="border-destructive shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Alertes de stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 bg-destructive/10 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-destructive">{stockAlerts?.outOfStock.length || 0}</div>
                    <div className="text-xs font-medium text-destructive">En rupture</div>
                  </div>
                  <div className="flex-1 bg-secondary/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-secondary-foreground">{stockAlerts?.lowStock.length || 0}</div>
                    <div className="text-xs font-medium text-secondary-foreground">Stock faible</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
