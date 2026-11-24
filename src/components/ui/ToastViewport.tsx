"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

export type ToastTone = "success" | "info" | "error";

export interface ToastPayload {
  title: string;
  description?: string;
  tone?: ToastTone;
}

interface ToastItem extends ToastPayload {
  id: number;
  tone: ToastTone;
}

const TOAST_EVENT = "campus-lunita:toast";

/** Dispara una notificación flotante instantánea desde cualquier componente cliente. */
export function emitToast(payload: ToastPayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}

/** Pila global de toasts con cierre automático suave y soporte accesible. */
export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let seq = 1;
    function onToast(ev: Event) {
      const custom = ev as CustomEvent<ToastPayload>;
      const detail = custom.detail;
      if (!detail?.title) return;
      const id = seq++;
      const tone: ToastTone = detail.tone ?? "success";
      setToasts((prev) => [...prev.slice(-2), { id, title: detail.title, description: detail.description, tone }]);

      // Los errores permanecen más tiempo para lectura cómoda; éxitos se limpian en 4.2 s.
      const ttl = tone === "error" ? 7000 : 4200;
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ttl);
    }

    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-20 z-70 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5 lg:right-6 lg:bottom-6"
    >
      {toasts.map((t) => {
        const borderTone =
          t.tone === "error"
            ? "border-red-solid/40 bg-white"
            : t.tone === "info"
              ? "border-sky-solid/40 bg-white"
              : "border-green-solid/40 bg-white";
        const iconTone =
          t.tone === "error"
            ? "text-red-solid bg-red-l"
            : t.tone === "info"
              ? "text-sky-solid bg-sky-l"
              : "text-green-solid bg-green-l";

        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-card border px-4 py-3 shadow-lg ${borderTone}`}
          >
            <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${iconTone}`}>
              {t.tone === "error" ? (
                <AlertCircle className="size-4" aria-hidden />
              ) : t.tone === "info" ? (
                <Info className="size-4" aria-hidden />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-navy">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              aria-label="Cerrar notificación"
              className="grid size-7 shrink-0 place-items-center rounded-control text-muted hover:bg-cloud hover:text-navy"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
