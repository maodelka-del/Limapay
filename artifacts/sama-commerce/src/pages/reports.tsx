import { useListSales } from "@workspace/api-client-react";
import { exportSalesReport } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download } from "lucide-react";

export default function Reports() {
  const { data: allSales } = useListSales();

  const handleExportSales = () => {
    if (allSales) {
      exportSalesReport(allSales, "Toutes les ventes");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Rapports</h1>
        <p className="text-muted-foreground">Générez et téléchargez vos rapports d'activité</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Rapport des Ventes</CardTitle>
            <CardDescription>Historique complet des transactions et encaissements</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={handleExportSales} disabled={!allSales}>
              <Download className="w-4 h-4 mr-2" />
              Télécharger PDF
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>État des Stocks</CardTitle>
            <CardDescription>Inventaire actuel, ruptures et produits faibles</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => alert("Non implémenté dans cet aperçu")}>
              <Download className="w-4 h-4 mr-2" />
              Télécharger PDF
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Créances Clients</CardTitle>
            <CardDescription>Liste des dettes impayées et partielles par client</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => alert("Non implémenté dans cet aperçu")}>
              <Download className="w-4 h-4 mr-2" />
              Télécharger PDF
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
