import { useState } from "react";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, ProductInput, Product } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const productSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  category: z.string().min(2, "Catégorie requise"),
  salePrice: z.coerce.number().min(0, "Prix invalide"),
  purchasePrice: z.coerce.number().min(0, "Prix invalide"),
  stock: z.coerce.number().min(0, "Stock invalide"),
  lowStockThreshold: z.coerce.number().min(0).optional().default(5),
  barcode: z.string().optional(),
});

export default function Products() {
  const [search, setSearch] = useState("");
  const { data: products, isLoading } = useListProducts({ search });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      category: "",
      salePrice: 0,
      purchasePrice: 0,
      stock: 0,
      lowStockThreshold: 5,
      barcode: "",
    },
  });

  const onSubmit = (values: z.infer<typeof productSchema>) => {
    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, data: values }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          setEditingProduct(null);
          form.reset();
          toast({ title: "Produit modifié avec succès" });
        }
      });
    } else {
      createProduct.mutate({ data: values }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          setIsAddOpen(false);
          form.reset();
          toast({ title: "Produit ajouté avec succès" });
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Voulez-vous vraiment supprimer ce produit ?")) {
      deleteProduct.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          toast({ title: "Produit supprimé" });
        }
      });
    }
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      category: product.category,
      salePrice: product.salePrice,
      purchasePrice: product.purchasePrice,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold || 5,
      barcode: product.barcode || "",
    });
  };

  return (
    <div className="space-y-6 bg-background">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produits</h1>
          <p className="text-muted-foreground">Gérez votre catalogue de produits</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if(!open) form.reset(); }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2"/> Nouveau Produit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un produit</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nom</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Catégorie</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="salePrice" render={({ field }) => (
                    <FormItem><FormLabel>Prix de vente</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                    <FormItem><FormLabel>Prix d'achat</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="stock" render={({ field }) => (
                    <FormItem><FormLabel>Stock initial</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (
                    <FormItem><FormLabel>Seuil d'alerte</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="barcode" render={({ field }) => (
                  <FormItem><FormLabel>Code-barres (optionnel)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter>
                  <Button type="submit" disabled={createProduct.isPending}>Enregistrer</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              className="pl-9" 
              placeholder="Rechercher par nom..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Prix de vente</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell className="text-right font-medium text-primary">{formatCurrency(p.salePrice)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={p.stock <= 0 ? 'destructive' : p.stock <= (p.lowStockThreshold || 5) ? 'secondary' : 'outline'}>
                      {p.stock}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog open={editingProduct?.id === p.id} onOpenChange={(open) => !open && setEditingProduct(null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit2 className="w-4 h-4" /></Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Modifier produit</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 text-left">
                            <FormField control={form.control} name="name" render={({ field }) => (
                              <FormItem><FormLabel>Nom</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="category" render={({ field }) => (
                              <FormItem><FormLabel>Catégorie</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-4">
                              <FormField control={form.control} name="salePrice" render={({ field }) => (
                                <FormItem><FormLabel>Prix de vente</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                              )} />
                              <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                                <FormItem><FormLabel>Prix d'achat</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                              )} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <FormField control={form.control} name="stock" render={({ field }) => (
                                <FormItem><FormLabel>Stock actuel</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                              )} />
                              <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (
                                <FormItem><FormLabel>Seuil d'alerte</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                              )} />
                            </div>
                            <FormField control={form.control} name="barcode" render={({ field }) => (
                              <FormItem><FormLabel>Code-barres (optionnel)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <DialogFooter>
                              <Button type="submit" disabled={updateProduct.isPending}>Mettre à jour</Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
