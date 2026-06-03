import { useState, useRef } from "react";
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
import { Plus, Search, Edit2, Trash2, Camera, X as XIcon } from "lucide-react";
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
  photoUrl: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

function resizeImageToBase64(file: File, maxPx = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxPx) { h = Math.round(h * maxPx / w); w = maxPx; } }
        else { if (h > maxPx) { w = Math.round(w * maxPx / h); h = maxPx; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ProductPhotoField({ value, onChange }: { value?: string; onChange: (url: string | undefined) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const b64 = await resizeImageToBase64(file);
      onChange(b64);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {value ? (
        <div className="relative">
          <img src={value} alt="Photo produit" className="w-16 h-16 rounded-lg object-cover border border-border shadow-sm" />
          <button type="button"
            onClick={() => onChange(undefined)}
            className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center shadow">
            <XIcon className="w-2.5 h-2.5" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
          {loading ? (
            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          ) : (
            <>
              <Camera className="w-5 h-5 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground text-center leading-tight">Ajouter<br/>photo</span>
            </>
          )}
        </div>
      )}
      {!value && (
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={loading}>
          {loading ? "Chargement…" : "Choisir une image"}
        </Button>
      )}
    </div>
  );
}

function ProductForm({
  form,
  onSubmit,
  isPending,
  submitLabel,
}: {
  form: ReturnType<typeof useForm<ProductFormValues>>;
  onSubmit: (v: ProductFormValues) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="photoUrl" render={({ field }) => (
          <FormItem>
            <FormLabel>Photo (optionnel)</FormLabel>
            <FormControl>
              <ProductPhotoField value={field.value} onChange={field.onChange} />
            </FormControl>
          </FormItem>
        )} />
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
          <Button type="submit" disabled={isPending}>{submitLabel}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

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

  const defaultValues: ProductFormValues = {
    name: "", category: "", salePrice: 0, purchasePrice: 0,
    stock: 0, lowStockThreshold: 5, barcode: "", photoUrl: undefined,
  };

  const addForm = useForm<ProductFormValues>({ resolver: zodResolver(productSchema), defaultValues });
  const editForm = useForm<ProductFormValues>({ resolver: zodResolver(productSchema), defaultValues });

  const onAdd = (values: ProductFormValues) => {
    createProduct.mutate({ data: values as ProductInput }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        setIsAddOpen(false);
        addForm.reset(defaultValues);
        toast({ title: "Produit ajouté avec succès" });
      },
    });
  };

  const onEdit = (values: ProductFormValues) => {
    if (!editingProduct) return;
    updateProduct.mutate({ id: editingProduct.id, data: values as ProductInput }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        setEditingProduct(null);
        editForm.reset(defaultValues);
        toast({ title: "Produit modifié avec succès" });
      },
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Voulez-vous vraiment supprimer ce produit ?")) {
      deleteProduct.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          toast({ title: "Produit supprimé" });
        },
      });
    }
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    editForm.reset({
      name: product.name,
      category: product.category,
      salePrice: product.salePrice,
      purchasePrice: product.purchasePrice,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold || 5,
      barcode: product.barcode || "",
      photoUrl: product.photoUrl || undefined,
    });
  };

  return (
    <div className="space-y-6 bg-background">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Produits</h1>
          <p className="text-muted-foreground text-sm">Gérez votre catalogue de produits</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) addForm.reset(defaultValues); }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" /> Nouveau Produit</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ajouter un produit</DialogTitle>
            </DialogHeader>
            <ProductForm form={addForm} onSubmit={onAdd} isPending={createProduct.isPending} submitLabel="Enregistrer" />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input className="pl-9" placeholder="Rechercher par nom..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-border">
          {isLoading && <div className="p-6 text-center text-muted-foreground text-sm">Chargement…</div>}
          {products?.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-4">
              {p.photoUrl ? (
                <img src={p.photoUrl} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-border" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Camera className="w-5 h-5 text-muted-foreground opacity-40" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.category}</p>
                <p className="text-sm font-bold text-primary">{formatCurrency(p.salePrice)}</p>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <Badge variant={p.stock <= 0 ? "destructive" : p.stock <= (p.lowStockThreshold || 5) ? "secondary" : "outline"} className="text-xs">
                  {p.stock}
                </Badge>
                <div className="flex gap-1">
                  <Dialog open={editingProduct?.id === p.id} onOpenChange={(open) => !open && setEditingProduct(null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Edit2 className="w-3.5 h-3.5" /></Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90dvh] overflow-y-auto">
                      <DialogHeader><DialogTitle>Modifier produit</DialogTitle></DialogHeader>
                      <ProductForm form={editForm} onSubmit={onEdit} isPending={updateProduct.isPending} submitLabel="Mettre à jour" />
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Photo</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Prix de vente</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
              )}
              {products?.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Camera className="w-4 h-4 text-muted-foreground opacity-30" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell className="text-right font-medium text-primary">{formatCurrency(p.salePrice)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={p.stock <= 0 ? "destructive" : p.stock <= (p.lowStockThreshold || 5) ? "secondary" : "outline"}>
                      {p.stock}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog open={editingProduct?.id === p.id} onOpenChange={(open) => !open && setEditingProduct(null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit2 className="w-4 h-4" /></Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[90dvh] overflow-y-auto">
                        <DialogHeader><DialogTitle>Modifier produit</DialogTitle></DialogHeader>
                        <ProductForm form={editForm} onSubmit={onEdit} isPending={updateProduct.isPending} submitLabel="Mettre à jour" />
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
