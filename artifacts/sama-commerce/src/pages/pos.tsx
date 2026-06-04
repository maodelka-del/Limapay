import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  useListProducts,
  useCreateSale,
  useListCustomers,
  useCreateDebt,
  useInitiateDiamondPay,
  useGetDiamondPayStatus,
  Product,
  SaleInputPaymentMethod,
  SaleInput,
  DiamondPayInitInputOperator,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import {
  Search, Plus, Minus, Trash2, Printer, CheckCircle2, QrCode,
  ShoppingCart, CreditCard, ChevronUp, X, Loader2, AlertCircle, ExternalLink,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface CartItem extends Product { cartQty: number }
type MobileOperator = "wave" | "orange_money" | "free_money";

const OPERATORS: Record<MobileOperator, { label: string; color: string; activeBg: string; cardCls: string; icon: string }> = {
  wave:         { label: "Wave",         color: "text-blue-700",   activeBg: "bg-blue-600",   cardCls: "border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800",   icon: "〜" },
  orange_money: { label: "Orange Money", color: "text-orange-600", activeBg: "bg-orange-500", cardCls: "border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800", icon: "⊙" },
  free_money:   { label: "Free Money",   color: "text-purple-700", activeBg: "bg-purple-600", cardCls: "border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800",  icon: "◈" },
};

export default function POS() {
  const [search, setSearch] = useState("");
  const { data: products } = useListProducts({ search });
  const [cart, setCart] = useState<CartItem[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createSale = useCreateSale();

  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // Cash modal
  const [isCashOpen, setIsCashOpen] = useState(false);
  const [amountGiven, setAmountGiven] = useState("");
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Mobile payment modal
  const [mobileOperator, setMobileOperator] = useState<MobileOperator | null>(null);

  // DiamondPay state
  const [diamondTxnId, setDiamondTxnId] = useState<string | null>(null);
  const [diamondQrUrl, setDiamondQrUrl] = useState<string | null>(null);
  const [diamondPaymentUrl, setDiamondPaymentUrl] = useState<string | null>(null);
  const [diamondLoading, setDiamondLoading] = useState(false);
  const [diamondError, setDiamondError] = useState<string | null>(null);
  const [saleCreatingFromPoll, setSaleCreatingFromPoll] = useState(false);

  const initiateDiamondPay = useInitiateDiamondPay();

  // Poll DiamondPay status every 3s while transaction is pending
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: diamondStatus } = useGetDiamondPayStatus(diamondTxnId ?? "", {
    query: {
      enabled: !!diamondTxnId && !saleCreatingFromPoll,
      refetchInterval: 3000,
    } as any,
  });

  // Credit modal
  const [isCreditOpen, setIsCreditOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const { data: customers } = useListCustomers();
  const createDebt = useCreateDebt();

  // Receipt
  const [receiptSaleId, setReceiptSaleId] = useState<number | null>(null);
  const [receiptItems, setReceiptItems] = useState<CartItem[]>([]);
  const [receiptTotal, setReceiptTotal] = useState(0);
  const [receiptMethod, setReceiptMethod] = useState("");
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const totalAmount = useMemo(() => cart.reduce((s, i) => s + i.salePrice * i.cartQty, 0), [cart]);
  const cartCount  = useMemo(() => cart.reduce((s, i) => s + i.cartQty, 0), [cart]);
  const changeAmount = useMemo(() => {
    const g = Number(amountGiven) || 0;
    return g > totalAmount ? g - totalAmount : 0;
  }, [amountGiven, totalAmount]);

  useEffect(() => { if (isCashOpen) { setAmountGiven(""); setTimeout(() => amountInputRef.current?.focus(), 50); } }, [isCashOpen]);

  // Auto-complete sale when DiamondPay confirms payment
  useEffect(() => {
    if (!diamondStatus || !mobileOperator || saleCreatingFromPoll) return;

    if (diamondStatus.status === "confirmed") {
      setSaleCreatingFromPoll(true);
      const snap = [...cart];
      createSale.mutate(
        {
          data: {
            items: cart.map(i => ({ productId: i.id, quantity: i.cartQty })),
            paymentMethod: mobileOperator as unknown as SaleInputPaymentMethod,
            totalAmount,
            amountPaid: totalAmount,
            diamondPayTransactionId: diamondStatus.transactionId,
          },
        },
        {
          onSuccess: s => {
            setSaleCreatingFromPoll(false);
            handleSaleSuccess(s.id, snap, totalAmount, OPERATORS[mobileOperator].label);
            resetDiamondState();
          },
          onError: () => setSaleCreatingFromPoll(false),
        }
      );
    } else if (diamondStatus.status === "failed") {
      setDiamondError("Paiement échoué. Réessayez.");
      setDiamondTxnId(null);
    } else if (diamondStatus.status === "expired") {
      setDiamondError("Transaction expirée. Réinitialisez.");
      setDiamondTxnId(null);
    }
  }, [diamondStatus?.status]);

  const resetDiamondState = () => {
    setDiamondTxnId(null);
    setDiamondQrUrl(null);
    setDiamondPaymentUrl(null);
    setDiamondLoading(false);
    setDiamondError(null);
    setSaleCreatingFromPoll(false);
  };

  // ── Cart helpers ──────────────────────────────────────
  const addToCart = (product: Product) => {
    if (product.stock <= 0) { toast({ title: "Stock épuisé", variant: "destructive" }); return; }
    setCart(prev => {
      const ex = prev.find(p => p.id === product.id);
      if (ex) {
        if (ex.cartQty >= product.stock) { toast({ title: "Stock insuffisant", variant: "destructive" }); return prev; }
        return prev.map(p => p.id === product.id ? { ...p, cartQty: p.cartQty + 1 } : p);
      }
      return [...prev, { ...product, cartQty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => setCart(prev =>
    prev.map(p => {
      if (p.id !== id) return p;
      const n = p.cartQty + delta;
      if (n > p.stock) { toast({ title: "Stock insuffisant", variant: "destructive" }); return p; }
      return { ...p, cartQty: n };
    }).filter(p => p.cartQty > 0)
  );

  const removeFromCart = (id: number) => setCart(prev => prev.filter(p => p.id !== id));
  const clearCart = () => setCart([]);

  // ── Sale success ──────────────────────────────────────
  const handleSaleSuccess = useCallback((saleId: number, items: CartItem[], total: number, method: string) => {
    setReceiptSaleId(saleId); setReceiptItems(items); setReceiptTotal(total); setReceiptMethod(method);
    setIsReceiptOpen(true); clearCart(); setIsCashOpen(false); setMobileOperator(null);
    setIsCreditOpen(false); setIsCartDrawerOpen(false); setAmountGiven(""); setSelectedCustomerId(null);
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  }, [queryClient]);

  // ── Cash ─────────────────────────────────────────────
  const submitCashSale = () => {
    if (Number(amountGiven) < totalAmount) { toast({ title: "Montant insuffisant", variant: "destructive" }); return; }
    const snap = [...cart];
    createSale.mutate({ data: { items: cart.map(i => ({ productId: i.id, quantity: i.cartQty })), paymentMethod: SaleInputPaymentMethod.cash, totalAmount, amountPaid: Number(amountGiven) } },
      { onSuccess: s => handleSaleSuccess(s.id, snap, totalAmount, "Espèces") });
  };

  // ── Open mobile modal → initiate DiamondPay immediately ──
  const openMobileModal = (op: MobileOperator) => {
    setMobileOperator(op);
    resetDiamondState();
    setDiamondLoading(true);

    initiateDiamondPay.mutate(
      { data: { amount: totalAmount, operator: op as DiamondPayInitInputOperator } },
      {
        onSuccess: txn => {
          setDiamondTxnId(txn.transactionId);
          setDiamondQrUrl(txn.qrCodeUrl ?? null);
          setDiamondPaymentUrl(txn.paymentUrl ?? null);
          setDiamondLoading(false);
          if (txn.paymentUrl) {
            window.open(txn.paymentUrl, "_blank");
          }
        },
        onError: (err: unknown) => {
          setDiamondLoading(false);
          const msg = (err as { message?: string })?.message ?? "Erreur DiamondPay inconnue";
          setDiamondError(msg);
        },
      }
    );
  };

  // ── Manual confirm (backup) ───────────────────────────
  const submitMobileSaleManual = () => {
    if (!mobileOperator) return;
    const snap = [...cart];
    createSale.mutate(
      {
        data: {
          items: cart.map(i => ({ productId: i.id, quantity: i.cartQty })),
          paymentMethod: mobileOperator as unknown as SaleInputPaymentMethod,
          totalAmount,
          amountPaid: totalAmount,
          ...(diamondTxnId ? { diamondPayTransactionId: diamondTxnId } : {}),
        } as SaleInput,
      },
      {
        onSuccess: s => {
          handleSaleSuccess(s.id, snap, totalAmount, OPERATORS[mobileOperator].label);
          resetDiamondState();
        },
      }
    );
  };

  // ── Retry DiamondPay initiation ───────────────────────
  const retryDiamondPay = () => {
    if (!mobileOperator) return;
    resetDiamondState();
    openMobileModal(mobileOperator);
  };

  // ── Credit ───────────────────────────────────────────
  const submitCreditSale = () => {
    if (!selectedCustomerId) { toast({ title: "Veuillez sélectionner un client", variant: "destructive" }); return; }
    const snap = [...cart];
    createSale.mutate({ data: { items: cart.map(i => ({ productId: i.id, quantity: i.cartQty })), paymentMethod: SaleInputPaymentMethod.credit, totalAmount, amountPaid: 0, customerId: selectedCustomerId } }, {
      onSuccess: s => createDebt.mutate({ data: { customerId: selectedCustomerId!, saleId: s.id, originalAmount: totalAmount } }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/debts"] }); handleSaleSuccess(s.id, snap, totalAmount, "Crédit"); }
      })
    });
  };

  // ── Cart panel content (shared desktop + drawer) ─────
  const CartPanel = ({ compact = false }: { compact?: boolean }) => (
    <>
      <ScrollArea className={compact ? "flex-1 px-4 py-2" : "flex-1 p-4"}>
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground py-10 gap-3">
            <ShoppingCart className="w-10 h-10 opacity-20" />
            <p className="text-sm">Cliquez sur un produit</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-sm">{item.name}</p>
                  <p className="text-muted-foreground text-xs">{formatCurrency(item.salePrice)} × {item.cartQty}</p>
                  <p className="font-bold text-sm text-primary">{formatCurrency(item.salePrice * item.cartQty)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                  <div className="w-6 text-center font-bold text-sm">{item.cartQty}</div>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive ml-1" onClick={() => removeFromCart(item.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Totals + payment buttons */}
      <div className={`${compact ? "px-4 py-3" : "p-4"} bg-muted/20 border-t border-border space-y-3`}>
        <div className="flex justify-between items-end">
          <span className="text-muted-foreground font-medium text-sm">TOTAL</span>
          <span className="text-3xl font-black text-foreground">{formatCurrency(totalAmount)}</span>
        </div>

        {/* Mobile money via DiamondPay */}
        <div className="grid grid-cols-3 gap-2">
          {(["wave", "orange_money", "free_money"] as MobileOperator[]).map(op => (
            <button key={op} disabled={cart.length === 0}
              onClick={() => openMobileModal(op)}
              className={`flex flex-col items-center justify-center gap-0.5 h-16 rounded-lg border-2 font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${OPERATORS[op].cardCls}`}>
              <span className="text-xl leading-none">{OPERATORS[op].icon}</span>
              <span className="text-[10px] leading-tight text-center">{OPERATORS[op].label}</span>
              <QrCode className="w-3 h-3 opacity-50" />
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button className="h-12 font-bold text-sm" disabled={cart.length === 0} onClick={() => setIsCashOpen(true)}>
            💵 Espèces
          </Button>
          <Button variant="outline" className="h-12 font-bold text-sm" disabled={cart.length === 0} onClick={() => setIsCreditOpen(true)}>
            <CreditCard className="w-4 h-4 mr-1" /> Crédit
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3rem)] lg:h-screen flex flex-col md:flex-row gap-0 md:gap-3 overflow-hidden">

      {/* ── Products column ─────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-card rounded-none md:rounded-lg border-0 md:border border-border shadow-none md:shadow-sm overflow-hidden">
        <div className="p-3 md:p-4 border-b border-border bg-muted/10 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              className="pl-9 h-11 text-base bg-background"
              placeholder="Rechercher un produit…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-2 md:p-3 pb-24 md:pb-4">
            {products?.map(product => (
              <Card key={product.id}
                className={`cursor-pointer hover:border-primary transition-all active:scale-95 select-none touch-manipulation ${product.stock <= 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => addToCart(product)}>
                <CardContent className="p-2.5 md:p-3 flex flex-col h-full items-center text-center gap-1">
                  <div className="w-full flex justify-end">
                    {product.stock <= 0
                      ? <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Rupture</Badge>
                      : product.stock <= (product.lowStockThreshold || 5)
                        ? <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-[10px] px-1.5 py-0">Faible</Badge>
                        : <Badge variant="outline" className="text-primary border-primary/20 text-[10px] px-1.5 py-0">Stock</Badge>}
                  </div>
                  <h3 className="font-bold text-xs md:text-sm line-clamp-2 leading-tight flex-1">{product.name}</h3>
                  <div className="text-base md:text-lg font-black text-primary leading-none">{formatCurrency(product.salePrice)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── Desktop/Tablet cart sidebar ──────────────── */}
      <div className="hidden md:flex w-80 lg:w-96 flex-col bg-card rounded-lg border border-border shadow-sm overflow-hidden flex-shrink-0">
        <div className="p-3 md:p-4 border-b border-border bg-primary text-primary-foreground flex justify-between items-center shrink-0">
          <h2 className="font-bold text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Panier
          </h2>
          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-white/60 hover:text-white text-xs underline">Vider</button>
            )}
            <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
              {cartCount} art.
            </Badge>
          </div>
        </div>
        <CartPanel />
      </div>

      {/* ── Mobile: sticky bottom bar ─────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t-2 border-primary shadow-2xl">
        {cart.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-muted-foreground text-sm gap-2">
            <ShoppingCart className="w-4 h-4 opacity-40" />
            <span>Sélectionnez des produits</span>
          </div>
        ) : (
          <button
            onClick={() => setIsCartDrawerOpen(true)}
            className="w-full flex items-center justify-between px-4 h-16 active:bg-primary/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-black text-sm">
                {cartCount}
              </div>
              <span className="font-semibold text-sm text-foreground">{cartCount} article{cartCount > 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-primary">{formatCurrency(totalAmount)}</span>
              <div className="bg-primary text-white rounded-full p-1.5">
                <ChevronUp className="w-4 h-4" />
              </div>
            </div>
          </button>
        )}
      </div>

      {/* ── Mobile cart drawer ────────────────────────── */}
      <Drawer open={isCartDrawerOpen} onOpenChange={setIsCartDrawerOpen}>
        <DrawerContent className="max-h-[92dvh] flex flex-col">
          <DrawerHeader className="bg-primary text-primary-foreground py-3 px-4 shrink-0 rounded-t-[10px]">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-white flex items-center gap-2 text-base">
                <ShoppingCart className="w-4 h-4" /> Panier ({cartCount} article{cartCount > 1 ? "s" : ""})
              </DrawerTitle>
              <div className="flex items-center gap-3">
                {cart.length > 0 && (
                  <button onClick={clearCart} className="text-white/60 hover:text-white text-xs underline">Vider</button>
                )}
                <button onClick={() => setIsCartDrawerOpen(false)} className="text-white/80 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </DrawerHeader>
          <div className="flex-1 flex flex-col overflow-hidden">
            <CartPanel compact />
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Cash Modal ─────────────────────────────────── */}
      <Dialog open={isCashOpen} onOpenChange={setIsCashOpen}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="text-center">💵 Paiement Espèces</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">À payer</p>
              <p className="text-5xl font-black text-primary">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Montant reçu (FCFA)</label>
              <Input ref={amountInputRef} type="number" inputMode="numeric"
                className="text-center text-2xl h-14 font-bold"
                value={amountGiven} onChange={e => setAmountGiven(e.target.value)} />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]
                .filter(v => v >= totalAmount).slice(0, 8).map(v => (
                  <button key={v} onClick={() => setAmountGiven(String(v))}
                    className={`h-10 rounded-md border text-xs font-bold transition-colors hover:bg-primary hover:text-primary-foreground ${amountGiven === String(v) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                    {formatCurrency(v)}
                  </button>
                ))}
            </div>
            {Number(amountGiven) >= totalAmount && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">Monnaie à rendre</p>
                <p className="text-3xl font-black text-green-600">{formatCurrency(changeAmount)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCashOpen(false)}>Annuler</Button>
            <Button onClick={submitCashSale}
              disabled={createSale.isPending || Number(amountGiven) < totalAmount} className="px-8">
              {createSale.isPending ? "Validation…" : "✓ Valider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DiamondPay / Mobile payment modal ─────────── */}
      <Dialog open={!!mobileOperator} onOpenChange={open => { if (!open) { setMobileOperator(null); resetDiamondState(); } }}>
        <DialogContent className="sm:max-w-md mx-4">
          {mobileOperator && (
            <>
              <DialogHeader>
                <DialogTitle className={`text-center text-xl ${OPERATORS[mobileOperator].color}`}>
                  {OPERATORS[mobileOperator].icon} {OPERATORS[mobileOperator].label}
                  <span className="block text-xs text-muted-foreground font-normal mt-1">via DiamondPay</span>
                </DialogTitle>
              </DialogHeader>

              <div className="text-center mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Montant</p>
                <p className="text-4xl font-black">{formatCurrency(totalAmount)}</p>
              </div>

              <div className="flex flex-col items-center gap-4 py-2 min-h-[220px] justify-center">

                {/* Loading */}
                {diamondLoading && (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-sm">Génération du paiement DiamondPay…</p>
                  </div>
                )}

                {/* Error */}
                {diamondError && !diamondLoading && (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <AlertCircle className="w-10 h-10 text-destructive" />
                    <p className="text-sm text-destructive text-center font-medium">{diamondError}</p>
                    <Button variant="outline" size="sm" onClick={retryDiamondPay}>
                      Réessayer
                    </Button>
                  </div>
                )}

                {/* Payment URL (redirect flow) */}
                {!diamondLoading && !diamondError && diamondPaymentUrl && (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="w-full p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                      <ExternalLink className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-sm text-blue-800 font-medium">Page de paiement ouverte</p>
                      <p className="text-xs text-blue-600 mt-1">Le client complète le paiement sur DiamondPay</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => window.open(diamondPaymentUrl, "_blank")}
                      className="text-blue-600 border-blue-300">
                      <ExternalLink className="w-3 h-3 mr-1" /> Ré-ouvrir le lien
                    </Button>
                    {diamondTxnId && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Vérification du paiement…
                      </div>
                    )}
                  </div>
                )}

                {/* QR Code flow */}
                {!diamondLoading && !diamondError && !diamondPaymentUrl && diamondQrUrl && (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <p className="text-sm text-muted-foreground text-center">
                      Le client scanne ce QR avec {OPERATORS[mobileOperator].label}
                    </p>
                    <div className="p-3 bg-white rounded-xl border-2 border-border shadow-sm">
                      <img src={diamondQrUrl} alt="QR DiamondPay" className="w-48 h-48" />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Vérification automatique du paiement…
                    </div>
                  </div>
                )}

                {/* Confirmed by poll (in progress creating sale) */}
                {saleCreatingFromPoll && (
                  <div className="flex flex-col items-center gap-3">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                    <p className="text-sm text-green-700 font-medium">Paiement confirmé ! Enregistrement…</p>
                  </div>
                )}

              </div>

              <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => { setMobileOperator(null); resetDiamondState(); }}>
                  Annuler
                </Button>
                <Button
                  onClick={submitMobileSaleManual}
                  disabled={createSale.isPending || saleCreatingFromPoll || diamondLoading}
                  className={`px-6 text-white ${OPERATORS[mobileOperator].activeBg} hover:opacity-90`}
                >
                  {createSale.isPending || saleCreatingFromPoll ? "Enregistrement…" : "✓ Confirmer paiement reçu"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Credit modal ──────────────────────────────── */}
      <Dialog open={isCreditOpen} onOpenChange={setIsCreditOpen}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle><CreditCard className="inline w-5 h-5 mr-2 text-primary" />Vente à crédit</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Montant de la dette</p>
              <p className="text-4xl font-black text-destructive">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Client *</label>
              <select className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedCustomerId || ""} onChange={e => setSelectedCustomerId(Number(e.target.value))}>
                <option value="" disabled>-- Sélectionner un client --</option>
                {customers?.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreditOpen(false)}>Annuler</Button>
            <Button onClick={submitCreditSale} disabled={createSale.isPending || createDebt.isPending || !selectedCustomerId} className="px-8">
              {createSale.isPending || createDebt.isPending ? "Validation…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Receipt modal ─────────────────────────────── */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-center flex flex-col items-center gap-2">
              <CheckCircle2 className="w-14 h-14 text-green-500" />
              <span className="text-green-700">Vente confirmée !</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="text-center pb-3 border-b border-dashed border-border space-y-1">
              <p className="font-bold text-lg">LIMAPAY</p>
              <p className="text-sm text-muted-foreground">Ticket #{receiptSaleId}</p>
              <p className="text-xs text-muted-foreground">{new Date().toLocaleString("fr-SN")}</p>
              <Badge variant="outline" className="text-xs mt-1">{receiptMethod}</Badge>
            </div>
            <div className="space-y-1.5 py-2 border-b border-dashed border-border">
              {receiptItems.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.cartQty}× {item.name}</span>
                  <span className="font-medium">{formatCurrency(item.salePrice * item.cartQty)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-1 font-black text-xl">
              <span>TOTAL</span>
              <span className="text-primary">{formatCurrency(receiptTotal)}</span>
            </div>
          </div>
          <DialogFooter className="sm:justify-center flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsReceiptOpen(false)}>Fermer</Button>
            <Button className="flex-1" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
