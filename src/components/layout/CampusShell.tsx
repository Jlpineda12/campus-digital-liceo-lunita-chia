"use client";

import { ChevronLeft, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { LunitaMark } from "@/components/brand/LunitaMark";
import { ToastViewport } from "@/components/ui/ToastViewport";
import { parseList } from "@/components/ui/useLocalPreference";
import { findActiveDestination } from "@/modules/core/auth/navigation";
import type { CampusShellData } from "@/modules/core/dashboard/shell";
import { CampusNavList } from "./CampusNavList";
import { ChildSwitcher } from "./ChildSwitcher";
import { CommandPalette, isRecentPage, recentKey } from "./CommandPalette";
import { DestinationTabs } from "./DestinationTabs";
import { MobileMenu } from "./MobileMenu";
import { MobileTabbar } from "./MobileTabbar";
import { NotificationsBell } from "./NotificationsBell";
import { ProfileMenu } from "./ProfileMenu";
import { RouteProgressBar } from "./RouteProgressBar";
import { SidebarHighlightCard } from "./SidebarHighlightCard";
import { TopbarBreadcrumbs } from "./TopbarBreadcrumbs";

const SIDEBAR_STORAGE_KEY = "campus-lunita-sidebar-collapsed";

const subscribeNever = () => () => {};
function useShortcutLabel(): string {
  return useSyncExternalStore(
    subscribeNever,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "Ctrl K",
  );
}

function detectZoneFromPath(pathname: string): "all" | "aula" | "siga" | "admin" {
  if (pathname.startsWith("/aula")) return "aula";
  if (pathname.startsWith("/siga")) return "siga";
  if (pathname.startsWith("/admin")) return "admin";
  return "all";
}

/**
 * Marco del Campus:
 * - Navegación de 4 destinos por rol; el destino activo despliega sus secciones
 *   en la barra y como pestañas sobre el contenido (`DestinationTabs`).
 * - Lunita es el logo en todas las zonas; la zona solo cambia el degradado.
 * - Barra lateral plegable con `Ctrl/⌘ + B` y buscador `Ctrl/⌘ + K`.
 */
export function CampusShell({ shell, children }: { shell: CampusShellData; children: ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteKey, setPaletteKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // La zona solo tiñe el degradado de la barra (Órbita/SIGA/Admin); la navegación es por destinos.
  const activeZone = detectZoneFromPath(pathname);

  const shortcut = useShortcutLabel();

  // «Recientes» del buscador: se guardan por usuario en este navegador (solo ruta y título visible).
  useEffect(() => {
    if (pathname === "/dashboard") return;
    const timer = window.setTimeout(() => {
      const title =
        document.querySelector("main h1")?.textContent?.trim() || document.title.split(" · ")[0]?.trim() || "";
      const section = findActiveDestination(shell.destinations, pathname)?.label;
      if (!title || !section) return;
      try {
        const key = recentKey(shell.user.id);
        const prev = parseList(window.localStorage.getItem(key), isRecentPage).filter((r) => r.href !== pathname);
        window.localStorage.setItem(key, JSON.stringify([{ href: pathname, title: title.slice(0, 80), section }, ...prev].slice(0, 8)));
        window.dispatchEvent(new Event("campus-lunita:preference"));
      } catch {
        // Sin almacenamiento: el buscador simplemente no muestra recientes.
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [pathname, shell.destinations, shell.user.id]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSidebarCollapsed(true);
      }
    } catch {
      // Modo privado sin localStorage.
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignorar errores de cuota/privacidad.
      }
      return next;
    });
  }, []);

  const openPalette = useCallback(() => {
    setMenuOpen(false);
    setPaletteKey((k) => k + 1);
    setPaletteOpen(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        const tag = (event.target as HTMLElement | null)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
          event.preventDefault();
          toggleSidebar();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openPalette, toggleSidebar]);

  const isGuardian = shell.user.role === "GUARDIAN";
  const isFamilyRole = isGuardian || shell.user.role === "STUDENT";
  const sidebarPending =
    shell.user.role === "TEACHER"
      ? (shell.navBadges.courses ?? 0)
      : (shell.navBadges.tasks ?? 0);

  return (
    <div
      data-role={shell.user.role}
      data-stage={shell.stage}
      data-zone={activeZone}
      className="campus-frame min-h-dvh lg:flex"
    >
      <RouteProgressBar />
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>

      {/* Barra lateral izquierda con animación spring suave */}
      <aside
        aria-label="Navegación principal del campus"
        aria-hidden={sidebarCollapsed}
        inert={sidebarCollapsed}
        className={`campus-sidebar-rail fixed inset-y-0 left-0 z-40 hidden w-68 flex-col gap-4 overflow-y-auto px-4 py-5 lg:flex ${
          sidebarCollapsed
            ? "-translate-x-full pointer-events-none opacity-0"
            : "translate-x-0 opacity-100"
        }`}
      >
        <Link href="/dashboard" className="flex items-center gap-3 px-1.5 no-underline">
          {/* Lunita es el logo del Campus en todas las zonas. */}
          <LunitaMark size={44} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-lg font-black tracking-tight text-white">Campus Lunita</span>
            <span className="block truncate text-[0.72rem] font-bold text-yellow/90">Liceo Lunita de Chía</span>
          </span>
        </Link>

        <div className="flex-1">
          <CampusNavList destinations={shell.destinations} badges={shell.navBadges} />
        </div>

        {/* Estudiantes y familias ya ven sus pendientes en «Lo que sigue» y en los contadores: no se repite aquí. */}
        {!isFamilyRole && <SidebarHighlightCard role={shell.user.role} pendingCount={sidebarPending} />}
      </aside>

      {/* Tirador flotante orgánico montado justo sobre el borde divisor (desktop) */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-expanded={!sidebarCollapsed}
        aria-label={sidebarCollapsed ? "Mostrar barra lateral del campus" : "Ocultar barra lateral del campus"}
        title={sidebarCollapsed ? "Mostrar barra lateral (Ctrl+B)" : "Ocultar barra lateral (Ctrl+B)"}
        style={{ left: sidebarCollapsed ? "0px" : "258px" }}
        className={`campus-edge-handle fixed top-22 z-50 hidden h-11 items-center justify-center border border-line/90 bg-white text-cobalt shadow-md hover:scale-105 hover:border-cobalt/40 hover:bg-cloud hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt lg:flex ${
          sidebarCollapsed
            ? "w-7 rounded-r-full border-l-0 pl-0.5 pr-1"
            : "w-7 rounded-full"
        }`}
      >
        <ChevronLeft
          className={`size-4 transition-transform duration-300 ${sidebarCollapsed ? "rotate-180" : "rotate-0"}`}
          aria-hidden
        />
      </button>

      {/* Lienzo principal curvo y luminoso: se expande suavemente al 100% cuando la barra se oculta */}
      <div
        className={`campus-canvas-pane flex min-h-dvh min-w-0 flex-1 flex-col bg-canvas ${
          sidebarCollapsed
            ? "lg:ml-0 lg:rounded-l-none lg:shadow-none"
            : "lg:ml-68 lg:rounded-l-[28px] lg:shadow-[-12px_0_32px_rgba(7,12,46,0.18)]"
        }`}
      >
        <header
          className={`sticky top-0 z-30 border-b border-line/70 bg-white/88 backdrop-blur transition-[border-radius] duration-300 ${
            sidebarCollapsed ? "lg:rounded-tl-none" : "lg:rounded-tl-[28px]"
          }`}
        >
          <div
            className={`mx-auto flex h-16 w-full items-center gap-2.5 px-4 transition-[max-width] duration-300 tab:px-6 lg:px-8 ${
              sidebarCollapsed ? "max-w-[1440px]" : "max-w-6xl"
            }`}
          >
            {/* Botón de menú deslizante en tablet (720px–1023px) */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú de navegación"
              className="hidden size-9 shrink-0 place-items-center rounded-control border border-line bg-white text-navy hover:bg-cloud tab:grid lg:hidden"
            >
              <Menu className="size-4" aria-hidden />
            </button>

            {/* En escritorio cuando el sidebar está oculto: emblema interactivo Lunita para desplegarlo */}
            {sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                title="Desplegar barra lateral (Ctrl+B)"
                className="group hidden shrink-0 items-center gap-2 rounded-pill border border-line bg-white py-1 pr-3 pl-1.5 text-xs font-extrabold text-navy shadow-2xs transition-all hover:border-cobalt/35 hover:bg-cloud lg:inline-flex"
              >
                <LunitaMark size={28} />
                <span>Campus Lunita</span>
              </button>
            )}

            {/* Emblema compacto en móvil/tablet */}
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2 no-underline lg:hidden">
              <LunitaMark size={32} />
              <span className={`font-black text-navy ${isGuardian ? "hidden sm:inline" : ""}`}>
                Campus Lunita
              </span>
            </Link>

            <TopbarBreadcrumbs periodLabel={shell.periodLabel} destinations={shell.destinations} />

            <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
              {isGuardian && <ChildSwitcher options={shell.children} selectedId={shell.selectedChildId} />}

              <button
                type="button"
                onClick={openPalette}
                className="hidden h-10 items-center gap-2 rounded-pill border border-line/80 bg-[#F3F5FB] pr-2.5 pl-4 text-sm font-medium text-muted transition-[color,border-color,background-color,box-shadow] duration-150 hover:border-cobalt/40 hover:bg-white hover:text-navy hover:shadow-xs tab:flex"
                aria-keyshortcuts="Control+K Meta+K"
              >
                <Search className="size-4 text-cobalt/70" aria-hidden />
                <span className="pr-5">Buscar en el campus…</span>
                <kbd className="rounded-pill border border-line bg-white px-2 py-0.5 text-[0.7rem] font-bold text-navy">
                  {shortcut}
                </kbd>
              </button>

              <NotificationsBell alerts={shell.alerts} />

              <ProfileMenu user={shell.user} />
            </div>
          </div>
        </header>

        <main
          id="contenido"
          className={`mx-auto w-full flex-1 px-4 pt-6 pb-28 transition-[max-width] duration-300 tab:px-6 lg:px-8 lg:pt-8 lg:pb-14 ${
            sidebarCollapsed ? "max-w-[1440px]" : "max-w-6xl"
          }`}
        >
          <DestinationTabs destinations={shell.destinations} badges={shell.navBadges} />
          <div key={pathname} className="campus-page-enter">
            {children}
          </div>
        </main>
      </div>

      <MobileTabbar
        destinations={shell.destinations}
        badges={shell.navBadges}
        onMenu={() => setMenuOpen(true)}
      />

      <CommandPalette
        key={paletteKey}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={shell.navigation}
        destinations={shell.destinations}
        userId={shell.user.id}
      />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onSearch={openPalette} shell={shell} />
      <ToastViewport />
    </div>
  );
}
