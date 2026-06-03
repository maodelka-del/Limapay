import { DashboardSummary } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// We're importing hooks but omitting some exports to focus on quick updates
import { useGetDashboardSummary, useListSales, useListProducts, useListDebts } from "@workspace/api-client-react";

export function exportSalesReport(sales: any[], period: string) {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text("Rapport des Ventes", 14, 22);
  doc.setFontSize(11);
  doc.text(`Période: ${period}`, 14, 30);
  
  const tableData = sales.map(sale => [
    new Date(sale.createdAt).toLocaleDateString('fr-SN'),
    sale.id.toString(),
    formatCurrency(sale.totalAmount),
    sale.paymentMethod,
    sale.status
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Date', 'ID Vente', 'Montant', 'Paiement', 'Statut']],
    body: tableData,
  });

  doc.save(`rapport_ventes_${period.replace(/\s+/g, '_')}.pdf`);
}
