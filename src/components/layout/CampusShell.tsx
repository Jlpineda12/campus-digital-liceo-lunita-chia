"use client";

import { ChevronLeft, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { LunitaEmblem } from "@/components/ui/LunitaEmblem";
import { PlatformLogo } from "@/components/ui/PlatformLogo";
import { ToastViewport } from "@/components/ui/ToastViewport";
import type { CampusShellData } from "@/modules/core/dashboard/shell";
import { CampusNavList, type CampusZoneFilter } from "./CampusNavList";
import { ChildSwitcher } from "./ChildSwitcher";
import { CommandPalette } from "./CommandPalette";
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

function detectZoneFromPath(pathname: string): CampusZoneFilter {
  if (pathname.startsWith("/aula")) return "aula";
  if (pathname.startsWith("/siga")) return "siga";
  if (pathname.startsWith("/admin")) return "admin";
  return "all";
}

/**
 * Marco insignia Liceo Lunita × VENTES:
 * - Selector Dual de Espacios en la barra lateral (**Órbita Virtual ⇄ SIGA Lunita** o **SIGA ⇄ Admin**),
 *   sincronizado automáticamente con la ruta y el degradado cósmico de la barra.
 * - Tirador flotante orgánico sobre el borde divisor (sin botones rígidos en la topbar) + atajo `Ctrl/⌘ + B`
 *   con animación spring (`380ms cubic-bezier(0.22, 1, 0.36, 1)`) que expande el lienzo al 100%.
 */
export function CampusShell({ shell, children }: { shell: CampusShellData; children: ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteKey, setPaletteKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Zona manual elegida en el selector del sidebar (se resetea suavemente si el usuario navega a otra zona)
  const routeZone = detectZoneFromPath(pathname);
  const [manualZoneOverride, setManualZoneOverride] = useState<{
    path: string;
    zone: CampusZoneFilter;
  } | null>(null);

  const activeZone: CampusZoneFilter =
    manualZoneOverride && manualZoneOverride.path === pathname
      ? manualZoneOverride.zone
      : routeZone;

  const shortcut = useShortcutLabel();

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
  const hasAula = shell.navigation.some((i) => i.section === "aula" && i.available);
  const hasAdmin = shell.navigation.some((i) => i.section === "admin" && i.available);
  const sidebarPending =
    shell.user.role === "TEACHER"
      ? (shell.navBadges.courses ?? 0)
      : (shell.navBadges.tasks ?? 0);

  // Opciones del conmutador de zona en la barra izquierda
  const zoneTabs: Array<{
    key: CampusZoneFilter;
    label: string;
    logo?: "aula" | "siga" | "admin";
  }> = hasAula
    ? [
        { key: "aula", label: "Órbita", logo: "aula" },
        { key: "siga", label: "SIGA", logo: "siga" },
        { key: "all", label: "Todo" },
      ]
    : hasAdmin
      ? [
          { key: "siga", label: "SIGA", logo: "siga" },
          { key: "admin", label: "Admin", logo: "admin" },
          { key: "all", label: "Todo" },
        ]
      : [];

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

      {/* Barra lateral izquierda con animación spring suave y selector Órbita ⇄ SIGA */}
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
          <LunitaEmblem size={40} className="shrink-0 transition-transform duration-300 hover:-rotate-6" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-lg font-black tracking-tight text-white">Campus Lunita</span>
            <span className="block truncate text-[0.72rem] font-bold text-yellow/90">Liceo Lunita de Chía</span>
          </span>
        </Link>

        {/* Selector visual de zona: separa Órbita Virtual (Aula/Moodle) y SIGA dentro del mismo Campus */}
        {zoneTabs.length > 0 && (
          <div
            role="group"
            aria-label="Cambiar espacio del campus"
            className="grid grid-cols-3 gap-1 rounded-2xl border border-white/14 bg-black/18 p-1 backdrop-blur-xs"
          >
            {zoneTabs.map((z) => {
              const selected = activeZone === z.key;
              return (
                <button
                  key={z.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setManualZoneOverride({ path: pathname, zone: z.key })}
                  className={`flex items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[0.7rem] font-extrabold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow ${
                    selected
                      ? "bg-white text-navy shadow-sm"
                      : "text-white/90 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  {z.logo && <PlatformLogo space={z.logo} size={16} className="shrink-0" />}
                  <span>{z.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1">
          <CampusNavList
            items={shell.navigation}
            badges={shell.navBadges}
            activeZone={activeZone}
          />
        </div>

        <SidebarHighlightCard role={shell.user.role} pendingCount={sidebarPending} />
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
                <LunitaEmblem size={26} className="transition-transform duration-300 group-hover:rotate-12" />
                <span>Campus Lunita</span>
              </button>
            )}

            {/* Emblema compacto en móvil/tablet */}
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2 no-underline lg:hidden">
              <LunitaEmblem size={30} />
              <span className={`font-black text-navy ${isGuardian ? "hidden sm:inline" : ""}`}>
                Campus Lunita
              </span>
            </Link>

            <TopbarBreadcrumbs periodLabel={shell.periodLabel} />

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
          <div key={pathname} className="campus-page-enter">
            {children}
          </div>
        </main>
      </div>

      <MobileTabbar
        navigation={shell.navigation}
        tabKeys={shell.tabKeys}
        onSearch={openPalette}
        onMenu={() => setMenuOpen(true)}
      />

      <CommandPalette
        key={paletteKey}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={shell.navigation}
      />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} shell={shell} />
      <ToastViewport />
    </div>
  );
}
