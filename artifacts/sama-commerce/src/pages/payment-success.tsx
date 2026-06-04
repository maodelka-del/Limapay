import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(5);

  // Read optional query params from DiamanoPay redirect
  const params = new URLSearchParams(window.location.search);
  const txnId = params.get("transaction_id") ?? params.get("txn_id") ?? params.get("id");
  const status = params.get("status") ?? "success";

  const isFailed =
    status === "failed" ||
    status === "FAILED" ||
    status === "cancelled" ||
    status === "CANCELLED";

  useEffect(() => {
    if (isFailed) return; // don't auto-redirect on failure
    const timer = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(timer);
          setLocation("/");
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isFailed, setLocation]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl border border-border p-8 text-center">
        {isFailed ? (
          <>
            <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <span className="text-4xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold text-destructive mb-2">Paiement échoué</h1>
            <p className="text-muted-foreground text-sm mb-6">
              La transaction n'a pas pu être finalisée. Veuillez réessayer.
            </p>
            {txnId && (
              <p className="text-xs text-muted-foreground mb-4">Réf : {txnId}</p>
            )}
            <Button className="w-full" onClick={() => setLocation("/")}>
              Retour à la caisse
            </Button>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-green-700 mb-2">Paiement confirmé !</h1>
            <p className="text-muted-foreground text-sm mb-2">
              La transaction a bien été enregistrée.
            </p>
            {txnId && (
              <p className="text-xs text-muted-foreground mb-4">Réf : {txnId}</p>
            )}
            <div className="mb-6 text-sm text-muted-foreground">
              Retour automatique dans <span className="font-bold text-primary">{countdown}s</span>…
            </div>
            <Button className="w-full" onClick={() => setLocation("/")}>
              Retour à la caisse maintenant
            </Button>
          </>
        )}

        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs font-bold text-primary">LIMAPAY</p>
          <p className="text-[10px] text-muted-foreground">Gestion commerciale</p>
        </div>
      </div>
    </div>
  );
}
