"use client";

import { ArrowRight, Bell, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ShellAlert } from "@/modules/core/dashboard/shell";

/** Campana interactiva de novedades con conteo en vivo y accesos directos en 1 clic. */
export function NotificationsBell({ alerts }: { alerts: ShellAlert[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const totalCount = alerts.reduce((sum, a) => sum + a.count, 0);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          totalCount > 0
            ? `Novedades y pendientes (${totalCount})`
            : "Novedades y pendientes (al día)"
        }
        className="relative grid size-10 place-items-center rounded-control border border-line-2 bg-white text-navy transition-colors hover:border-sky-solid hover:bg-cloud"
      >
        <Bell className="size-4.5" aria-hidden />
        {totalCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-pill bg-orange-solid px-1 py-0.5 text-[0.65rem] leading-none font-black text-white tabular-nums ring-2 ring-white">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Centro de pendientes"
          className="card absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white p-0 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-extrabold text-navy">Pendientes y novedades</h2>
            <span className="rounded-pill bg-cloud px-2 py-0.5 text-xs font-bold text-navy tabular-nums">
              {totalCount === 0 ? "Al día" : `${totalCount} ${totalCount === 1 ? "aviso" : "avisos"}`}
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="grid justify-items-center gap-1.5 px-4 py-7 text-center">
              <CheckCircle2 className="size-7 text-green-solid" aria-hidden />
              <p className="text-sm font-bold text-navy">Todo está al día</p>
              <p className="text-xs text-muted">No tienes tareas, circulares ni revisiones pendientes.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <Link
                    href={alert.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-3 no-underline transition-colors hover:bg-cloud/70"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-navy">{alert.title}</p>
                      <p className="mt-0.5 text-xs text-muted">{alert.detail}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`rounded-pill px-2 py-0.5 text-xs font-black tabular-nums ${
                          alert.tone === "orange"
                            ? "bg-orange-l text-orange-solid"
                            : alert.tone === "purple"
                              ? "bg-purple-l text-purple-solid"
                              : "bg-sky-l text-sky-solid"
                        }`}
                      >
                        {alert.count}
                      </span>
                      <ArrowRight className="size-3.5 text-muted" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
