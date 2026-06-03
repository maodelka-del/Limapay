import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";

interface QrScannerProps {
  onResult: (result: string) => void;
  onError?: (error: string) => void;
  active: boolean;
}

export default function QrScanner({ onResult, onError, active }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [status, setStatus] = useState<"idle" | "loading" | "scanning" | "error">("idle");

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const scan = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scan);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (code) {
      onResult(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(scan);
  }, [onResult]);

  useEffect(() => {
    if (!active) {
      stopStream();
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => {
            setStatus("scanning");
            rafRef.current = requestAnimationFrame(scan);
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus("error");
          onError?.(err.message);
        }
      });
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [active, scan, stopStream, onError]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-square">
      <video
        ref={videoRef}
        muted
        playsInline
        className="w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span className="text-white text-sm animate-pulse">Ouverture caméra...</span>
        </div>
      )}
      {status === "scanning" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 border-4 border-white/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <span className="text-red-400 text-sm text-center px-4">
            Caméra inaccessible.<br />Vérifiez les permissions.
          </span>
        </div>
      )}
    </div>
  );
}
