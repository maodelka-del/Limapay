import { useListProducts, useUpdateProduct } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Stock() {
  const { data: products } = useListProducts();
  const updateProduct = useUpdateProduct();
  const queryClient = useQueryClient();

  const handleStockAdj = (id: number, currentStock: number, delta: number) => {
    const newStock = Math.max(0, currentStock + delta);
    updateProduct.mutate({ id, data: { stock: newStock } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/products"] })
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">État du Stock</h1>
        <p className="text-muted-foreground">Ajustement rapide des inventaires</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-center">Niveau</TableHead>
              <TableHead className="text-right">Stock Actuel</TableHead>
              <TableHead className="text-center">Ajustement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products?.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.category}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={p.stock <= 0 ? 'destructive' : p.stock <= (p.lowStockThreshold || 5) ? 'secondary' : 'outline'}>
                    {p.stock <= 0 ? 'Rupture' : p.stock <= (p.lowStockThreshold || 5) ? 'Faible' : 'Normal'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-lg">{p.stock}</TableCell>
                <TableCell>
                  <div className="flex justify-center items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleStockAdj(p.id, p.stock, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleStockAdj(p.id, p.stock, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
