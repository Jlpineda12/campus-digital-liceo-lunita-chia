"use client";

import { CornerDownLeft, History, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "@/components/ui/cx";
import { parseList, useLocalPreference } from "@/components/ui/useLocalPreference";
import type { ResolvedDestination, ResolvedNavItem } from "@/modules/core/auth/navigation";
import { NavIcon } from "./NavIcon";

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export interface RecentPage {
  href: string;
  title: string;
  section: string;
}

export const recentKey = (userId: string) => `campus-lunita:recientes:${userId}`;

export function isRecentPage(v: unknown): v is RecentPage {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as RecentPage).href === "string" &&
    typeof (v as RecentPage).title === "string" &&
    typeof (v as RecentPage).section === "string"
  );
}

interface PaletteEntry {
  key: string;
  href: string;
  label: string;
  section: string;
  icon: ResolvedNavItem["icon"];
  recent: boolean;
}

/**
 * Buscador global (Ctrl+K / ⌘K): las páginas recientes de ESTE usuario (en este
 * navegador) y todos los módulos del rol, rotulados con su destino del menú.
 */
export function CommandPalette({
  open,
  onClose,
  items,
  destinations,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  items: ResolvedNavItem[];
  destinations: ResolvedDestination[];
  userId: string;
}) {
  const [rawRecent] = useLocalPreference(recentKey(userId));
  const recent = parseList(rawRecent, isRecentPage);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const destOf = (key: string) => destinations.find((d) => d.items.some((i) => i.key === key))?.label ?? "Campus";
  const q = normalize(query.trim());
  // Solo módulos habilitados: así el teclado nunca cae en una opción inactiva.
  const modules: PaletteEntry[] = items
    .filter((item) => item.available)
    .filter((item) => !q || normalize(`${item.label} ${item.keywords ?? ""} ${destOf(item.key)}`).includes(q))
    .map((item) => ({
      key: item.key,
      href: item.href,
      label: item.label,
      section: destOf(item.key),
      icon: item.icon,
      recent: false,
    }));
  const recents: PaletteEntry[] = recent
    .filter((r) => !q || normalize(`${r.title} ${r.section}`).includes(q))
    .slice(0, q ? 3 : 5)
    .map((r) => ({ key: `r-${r.href}`, href: r.href, label: r.title, section: r.section, icon: "home", recent: true }));
  const results = [...recents, ...modules.filter((m) => !recents.some((r) => r.href === m.href))];

  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  function choose(item: PaletteEntry | undefined) {
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % Math.max(results.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      aria-label="Buscar en el Campus"
      className="dialog-pop mx-auto mt-[12vh] w-[min(100%-2rem,36rem)] overflow-hidden rounded-card-lg border border-line bg-white p-0 text-ink-2 shadow-[0_24px_60px_-20px_rgb(15_23_71/0.45)] backdrop:bg-navy/60"
    >
      <div className="flex items-center gap-3 border-b border-line px-4 focus-within:shadow-[inset_0_-3px_0_var(--sky-solid)]">
        <Search className="size-5 shrink-0 text-sky-solid" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="¿Qué necesitas? Notas, tareas, asistencia…"
          className="min-h-14 w-full bg-transparent text-lg font-bold text-navy outline-none placeholder:font-medium placeholder:text-placeholder"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={results[activeIndex] ? `${listId}-${results[activeIndex].key}` : undefined}
          aria-autocomplete="list"
        />
        <kbd className="hidden rounded-md border border-line-2 px-1.5 text-xs font-bold text-muted sm:block">
          Esc
        </kbd>
      </div>

      <ul id={listId} role="listbox" aria-label="Resultados" className="max-h-[50vh] overflow-y-auto p-2">
        {results.length === 0 && (
          <li className="px-3 py-8 text-center font-semibold text-muted">
            No encontramos “{query}”. Prueba con otra palabra.
          </li>
        )}
        {results.map((item, index) => (
          <li
            key={item.key}
            id={`${listId}-${item.key}`}
            role="option"
            aria-selected={index === activeIndex}
            onMouseEnter={() => setActive(index)}
            onClick={() => choose(item)}
            className={cx(
              "flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 transition-colors duration-150",
              index === activeIndex && "bg-sky-l",
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-icon-sm bg-cloud text-sky-solid">
              {item.recent ? <History className="size-5" aria-hidden /> : <NavIcon name={item.icon} className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold text-navy">{item.label}</span>
              <span className="block text-xs font-bold tracking-wide text-muted uppercase">
                {item.recent ? `Reciente · ${item.section}` : item.section}
              </span>
            </span>
            {index === activeIndex && (
              <CornerDownLeft className="size-4 shrink-0 text-sky-solid" aria-hidden />
            )}
          </li>
        ))}
      </ul>
    </dialog>
  );
}
