"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { LunitaMark } from "@/components/brand/LunitaMark";
import type { CampusShellData } from "@/modules/core/dashboard/shell";
import { CampusNavList } from "./CampusNavList";
import { UserBlock } from "./UserBlock";

/** Menú lateral completo para móvil y tableta (la barra inferior solo muestra accesos clave). */
export function MobileMenu({
  open,
  onClose,
  onSearch,
  shell,
}: {
  open: boolean;
  onClose: () => void;
  onSearch: () => void;
  shell: CampusShellData;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      aria-label="Menú del Campus"
      className="dialog-sheet m-0 ml-auto h-dvh max-h-none w-[min(22rem,88vw)] bg-transparent p-0 backdrop:bg-navy/60"
    >
      <div
        data-role={shell.user.role}
        data-stage={shell.stage}
        className="block-navy flex h-full flex-col gap-6 overflow-y-auto p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LunitaMark size={38} />
            <span className="font-extrabold text-white">Campus Lunita</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-control text-white/80 hover:bg-white/10"
            aria-label="Cerrar menú"
          >
            <X className="size-6" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={onSearch}
          className="flex min-h-11 items-center gap-2 rounded-control border border-white/20 bg-white/10 px-3.5 text-sm font-semibold text-white/85 hover:bg-white/16"
        >
          <Search className="size-4" aria-hidden /> Buscar en el campus…
        </button>
        <div className="flex-1">
          <CampusNavList destinations={shell.destinations} badges={shell.navBadges} expandAll onNavigate={onClose} />
        </div>
        <UserBlock user={shell.user} />
      </div>
    </dialog>
  );
}
