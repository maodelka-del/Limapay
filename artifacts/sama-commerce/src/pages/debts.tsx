import { useState } from "react";
import { useListDebts, useAddDebtPayment, Debt, ListDebtsStatus } from "@workspace/api-client-react";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Debts() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: debts } = useListDebts({ 
    status: statusFilter === "all" ? undefined : (statusFilter as ListDebtsStatus) 
  });
  
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const addPayment = useAddDebtPayment();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handlePayment = () => {
    if (!selectedDebt || !paymentAmount) return;
    const amount = Number(paymentAmount);
    if (amount <= 0 || amount > selectedDebt.remainingAmount) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }

    addPayment.mutate({ id: selectedDebt.id, data: { amount } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
        setSelectedDebt(null);
        setPaymentAmount("");
        toast({ title: "Paiement enregistré" });
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="destructive">Impayé</Badge>;
      case 'partial': return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Partiel</Badge>;
      case 'paid': return <Badge variant="outline" className="text-primary border-primary">Payé</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dettes</h1>
          <p className="text-muted-foreground">Gestion des créances clients</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value={ListDebtsStatus.pending}>Impayé</SelectItem>
              <SelectItem value={ListDebtsStatus.partial}>Partiel</SelectItem>
              <SelectItem value={ListDebtsStatus.paid}>Payé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead className="text-right">Montant Initial</TableHead>
              <TableHead className="text-right">Reste à Payer</TableHead>
              <TableHead className="text-center">Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debts?.map(d => (
              <TableRow key={d.id}>
                <TableCell>{formatShortDate(d.createdAt)}</TableCell>
                <TableCell className="font-medium">{d.customerName}</TableCell>
                <TableCell>{d.customerPhone}</TableCell>
                <TableCell className="text-right">{formatCurrency(d.originalAmount)}</TableCell>
                <TableCell className="text-right font-bold text-destructive">{formatCurrency(d.remainingAmount)}</TableCell>
                <TableCell className="text-center">{getStatusBadge(d.status)}</TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={d.status === 'paid'}
                    onClick={() => setSelectedDebt(d)}
                  >
                    Encaisser
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {debts?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Aucune dette trouvée</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedDebt} onOpenChange={(open) => !open && setSelectedDebt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encaisser un paiement</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Client</p>
              <p className="font-medium">{selectedDebt?.customerName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Reste à payer</p>
              <p className="font-bold text-xl text-destructive">{formatCurrency(selectedDebt?.remainingAmount || 0)}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Montant payé (FCFA)</label>
              <Input 
                type="number" 
                value={paymentAmount} 
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder="Ex: 5000"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => setPaymentAmount(selectedDebt?.remainingAmount.toString() || "")}>
                  Solder tout
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDebt(null)}>Annuler</Button>
            <Button onClick={handlePayment} disabled={addPayment.isPending || !paymentAmount}>
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
