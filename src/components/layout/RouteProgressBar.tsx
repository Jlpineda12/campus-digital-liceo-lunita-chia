"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function RouteProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [navigatingFrom, setNavigatingFrom] = useState<string | null>(null);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      try {
        const nextUrl = new URL(anchor.href, window.location.href);
        if (nextUrl.origin !== window.location.origin) return;
        if (nextUrl.pathname.startsWith("/api/")) return;
        const nextKey = `${nextUrl.pathname}?${nextUrl.searchParams.toString()}`;
        const currentKey = `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
        if (nextKey !== currentKey) {
          setNavigatingFrom(currentKey);
        }
      } catch {
        // Ignora enlaces no parseables.
      }
    }

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, []);

  const visible = navigatingFrom !== null && navigatingFrom === routeKey;
  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-80 h-[3px] overflow-hidden bg-transparent"
    >
      <div className="h-full w-2/3 animate-pulse rounded-r-full bg-linear-to-r from-yellow via-sky to-cobalt transition-all duration-300" />
    </div>
  );
}

/** Barra superior sutil que brinda respuesta visual inmediata al cambiar de vista. */
export function RouteProgressBar() {
  return (
    <Suspense fallback={null}>
      <RouteProgressBarInner />
    </Suspense>
  );
}
