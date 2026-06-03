import { useListSales } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Sales() {
  const { data: sales } = useListSales();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Historique des Ventes</h1>
        <p className="text-muted-foreground">Consultez toutes les transactions réalisées</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Heure</TableHead>
              <TableHead>N° Ticket</TableHead>
              <TableHead>Articles</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead className="text-center">Paiement</TableHead>
              <TableHead className="text-center">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales?.map(s => (
              <TableRow key={s.id}>
                <TableCell>{formatDate(s.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs">#{s.id.toString().padStart(6, '0')}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {s.items.map(i => `${i.quantity}x ${i.productName}`).join(", ")}
                </TableCell>
                <TableCell className="text-right font-bold text-foreground">{formatCurrency(s.totalAmount)}</TableCell>
                <TableCell className="text-center capitalize">
                  {{ cash: 'Espèces', wave: 'Wave', orange_money: 'Orange Money', free_money: 'Free Money', diamondpay: 'DiamondPay', credit: 'Crédit' }[s.paymentMethod] ?? s.paymentMethod}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={s.status === 'completed' ? 'default' : 'secondary'}>
                    {s.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
