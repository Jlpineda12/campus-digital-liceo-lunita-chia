"use client";

import { Camera, ChevronDown, LogOut, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { pillButtonClass } from "@/components/ui/PillButton";
import { emitToast } from "@/components/ui/ToastViewport";
import { logoutAction } from "@/modules/core/auth/actions";
import { ROLE_META } from "@/modules/core/auth/roles";
import type { CampusShellData } from "@/modules/core/dashboard/shell";
import {
  removeProfilePhotoAction,
  uploadProfilePhotoAction,
  type ProfileActionState,
} from "@/modules/core/profile/actions";

const INITIAL: ProfileActionState = { status: "idle" };

/**
 * Menú de perfil superior derecho (inspirado en VENTES × Liceo Lunita):
 * muestra foto real circular, nombre, rol y permite subir o cambiar la foto de perfil
 * con almacenamiento privado protegido (Ley 1581).
 */
export function ProfileMenu({ user }: { user: CampusShellData["user"] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputId = useId();

  const [uploadState, uploadAction, uploading] = useActionState(uploadProfilePhotoAction, INITIAL);
  const [removeState, removeAction, removing] = useActionState(removeProfilePhotoAction, INITIAL);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (uploadState.status === "success") {
      emitToast({
        title: "Foto de perfil actualizada",
        description: "Tu nueva imagen ya aparece en todo el campus.",
        tone: "success",
      });
    } else if (uploadState.status === "error" && uploadState.message) {
      emitToast({ title: "No pudimos subir tu foto", description: uploadState.message, tone: "error" });
    }
  }, [uploadState]);

  useEffect(() => {
    if (removeState.status === "success") {
      emitToast({ title: "Foto de perfil eliminada", tone: "info" });
    } else if (removeState.status === "error" && removeState.message) {
      emitToast({ title: "Error al quitar foto", description: removeState.message, tone: "error" });
    }
  }, [removeState]);

  const activePreview = previewUrl ?? user.avatarUrl;

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex items-center gap-2.5 rounded-pill border border-transparent py-1 pr-2.5 pl-1 transition-colors hover:border-line hover:bg-bg-2"
        >
          <Avatar initials={user.initials} src={user.avatarUrl} alt={user.fullName} size="sm" />
          <span className="hidden max-w-36 text-left leading-tight xl:block">
            <span className="block truncate text-xs font-extrabold text-navy">{user.fullName}</span>
            <span className="block truncate text-[0.68rem] font-semibold text-muted">
              {ROLE_META[user.role].label}
            </span>
          </span>
          <ChevronDown className="size-3.5 text-muted" aria-hidden />
        </button>

        {menuOpen && (
          <div
            role="menu"
            aria-label="Opciones de cuenta"
            className="card absolute right-0 z-50 mt-2 w-60 bg-white p-1.5 shadow-xl"
          >
            <div className="border-b border-line px-3 py-2.5">
              <p className="truncate text-sm font-extrabold text-navy">{user.fullName}</p>
              <p className="text-xs font-semibold text-muted">{ROLE_META[user.role].label}</p>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setModalOpen(true);
              }}
              className="mt-1 flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-sm font-semibold text-navy transition-colors hover:bg-cloud"
            >
              <Camera className="size-4 text-cobalt" aria-hidden />
              {user.avatarUrl ? "Cambiar foto de perfil" : "Subir foto de perfil"}
            </button>

            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-sm font-semibold text-red-solid transition-colors hover:bg-red-l/50"
              >
                <LogOut className="size-4" aria-hidden />
                Cerrar sesión
              </button>
            </form>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-60 grid place-items-center bg-navy/55 p-4 backdrop-blur-xs">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Foto de perfil"
            className="card w-full max-w-md bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Camera className="size-4 text-cobalt" aria-hidden />
                <h2 className="text-base font-bold text-navy">Mi foto de perfil</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewUrl(null);
                  setModalOpen(false);
                }}
                aria-label="Cerrar ventana"
                className="grid size-8 place-items-center rounded-control text-muted hover:bg-cloud hover:text-navy"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="mt-5 flex flex-col items-center gap-3 text-center">
              <Avatar
                initials={user.initials}
                src={activePreview}
                alt={user.fullName}
                size="xl"
                className="ring-4 ring-cloud"
              />
              <div>
                <p className="font-extrabold text-navy">{user.fullName}</p>
                <p className="text-xs font-semibold text-muted">{ROLE_META[user.role].label}</p>
              </div>
            </div>

            <form action={uploadAction} className="mt-5 grid gap-4">
              <div className="rounded-control border border-dashed border-line-2 bg-bg-2/70 p-4 text-center">
                <label
                  htmlFor={fileInputId}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-control border border-line-2 bg-white px-3.5 py-2 text-xs font-bold text-navy shadow-2xs transition-colors hover:border-cobalt hover:bg-cloud"
                >
                  <Upload className="size-3.5 text-cobalt" aria-hidden />
                  Seleccionar imagen (PNG, JPG o WebP)
                </label>
                <input
                  id={fileInputId}
                  name="avatar"
                  type="file"
                  required
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(f ? URL.createObjectURL(f) : null);
                  }}
                  className="sr-only"
                />
                <p className="mt-2 text-[0.7rem] text-muted">
                  Tamaño máximo 2 MB · Se recorta automáticamente en círculo.
                </p>
              </div>

              <p className="flex items-start gap-2 rounded-control bg-cloud/75 px-3 py-2 text-[0.72rem] leading-relaxed text-ink-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cobalt" aria-hidden />
                <span>
                  Protección Ley 1581: tu foto se almacena de forma privada y solo es visible para miembros autenticados
                  del Liceo Lunita de Chía.
                </span>
              </p>

              {uploadState.message && (
                <p
                  role={uploadState.status === "error" ? "alert" : "status"}
                  className={`text-center text-xs font-semibold ${
                    uploadState.status === "error" ? "text-red-solid" : "text-green-solid"
                  }`}
                >
                  {uploadState.message}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                {user.avatarUrl ? (
                  <button
                    type="button"
                    disabled={removing}
                    onClick={() => {
                      const form = document.getElementById("remove-avatar-form") as HTMLFormElement | null;
                      form?.requestSubmit();
                    }}
                    className="inline-flex items-center gap-1 rounded-control px-2.5 py-1.5 text-xs font-semibold text-red-solid hover:bg-red-l/50"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    {removing ? "Quitando…" : "Quitar foto"}
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrl(null);
                      setModalOpen(false);
                    }}
                    className={pillButtonClass({ variant: "outline", size: "sm" })}
                  >
                    Cerrar
                  </button>
                  <button type="submit" disabled={uploading} className={pillButtonClass({ variant: "navy", size: "sm" })}>
                    {uploading ? "Guardando…" : "Guardar foto"}
                  </button>
                </div>
              </div>
            </form>

            {user.avatarUrl && (
              <form id="remove-avatar-form" action={removeAction} className="hidden" />
            )}
          </section>
        </div>
      )}
    </>
  );
}
