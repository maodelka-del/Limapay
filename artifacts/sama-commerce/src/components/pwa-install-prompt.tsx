import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem("pwa_prompt_dismissed") === "1";
  });
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const isIOSDevice =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window.navigator as any).standalone;
    setIsIOS(isIOSDevice);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
    dismiss();
  };

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa_prompt_dismissed", "1");
  };

  if (dismissed) return null;

  if (isIOS && !showIOSHint) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-50 md:bottom-6 md:left-auto md:right-6 md:w-80">
        <div className="bg-card border border-border rounded-xl shadow-2xl p-4 flex items-start gap-3">
          <div className="bg-primary/10 rounded-lg p-2 flex-shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Installer LIMAPAY</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Appuyez sur <strong>Partager</strong> puis <strong>Sur l'écran d'accueil</strong>
            </p>
          </div>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 md:bottom-6 md:left-auto md:right-6 md:w-80">
      <div className="bg-card border border-primary/30 rounded-xl shadow-2xl p-4 flex items-center gap-3">
        <div className="bg-primary/10 rounded-lg p-2 flex-shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Installer LIMAPAY</p>
          <p className="text-xs text-muted-foreground">Accès rapide depuis votre écran d'accueil</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="sm" onClick={handleInstall} className="h-8 text-xs px-3">
            Installer
          </Button>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
