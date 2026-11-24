"use client";

import { CheckCircle2, ChevronDown, Eye, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { pillButtonClass } from "@/components/ui/PillButton";
import { emitToast } from "@/components/ui/ToastViewport";
import {
  deleteCircularAction,
  markCircularReadAction,
  type AgendaActionState,
} from "@/modules/siga/agenda/actions";
import type { CircularItem } from "@/modules/siga/agenda/queries";

const INITIAL: AgendaActionState = { status: "idle" };

const shortDateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "America/Bogota",
});

const fullDateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/** Panel de lectura individual con confirmación segura en 2 pasos y feedback por toast. */
function CircularReader({
  item,
  showReadStats,
  onMarkedRead,
}: {
  item: CircularItem;
  showReadStats: boolean;
  onMarkedRead: (id: string) => void;
}) {
  const [readState, readAction, readPending] = useActionState(markCircularReadAction, INITIAL);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCircularAction, INITIAL);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isRead = Boolean(item.readAt) || readState.status === "success";
  const paragraphs = item.body.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  useEffect(() => {
    if (readState.status === "success") {
      onMarkedRead(item.id);
      emitToast({
        title: "Lectura confirmada",
        description: `Quedó registrado tu enterado en «${item.title}».`,
        tone: "success",
      });
    } else if (readState.status === "error" && readState.message) {
      emitToast({ title: "No pudimos confirmar lectura", description: readState.message, tone: "error" });
    }
  }, [readState, item.id, item.title, onMarkedRead]);

  useEffect(() => {
    if (deleteState.status === "success") {
      emitToast({ title: "Circular eliminada", tone: "info" });
    } else if (deleteState.status === "error" && deleteState.message) {
      emitToast({ title: "No pudimos eliminarla", description: deleteState.message, tone: "error" });
    }
  }, [deleteState]);

  return (
    <article className="card grid content-start gap-5 bg-white">
      <header className="grid gap-2.5 border-b border-line pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={item.targetScope === "ALL" ? "blue" : "sky"}>{item.targetLabel}</Chip>
            {item.isAuthor ? (
              <Chip tone="purple">Publicada por ti</Chip>
            ) : !isRead ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-solid">
                <span className="size-2 rounded-full bg-sky-solid" aria-hidden />
                Sin leer
              </span>
            ) : null}
          </div>

          {showReadStats && (
            <span className="inline-flex items-center gap-1.5 rounded-control bg-cloud px-2.5 py-1 text-xs font-semibold text-navy tabular">
              <Eye className="size-3.5 text-cobalt" aria-hidden />
              {item.readCount} {item.readCount === 1 ? "lectura" : "lecturas"}
            </span>
          )}
        </div>

        <h2 className="text-xl leading-snug font-bold text-navy">{item.title}</h2>
        <p className="text-xs font-medium text-muted">
          {item.authorName} ·{" "}
          <time dateTime={item.publishedAt.toISOString()}>{fullDateFormat.format(item.publishedAt)}</time>
        </p>
      </header>

      <div className="grid max-w-prose gap-3.5 text-sm leading-relaxed text-ink-2">
        {paragraphs.map((paragraph, idx) => (
          <p key={idx} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {item.isAuthor ? (
            <span className="text-xs font-semibold text-muted">
              Las familias y estudiantes verán el botón «Enterado» para confirmar lectura.
            </span>
          ) : isRead ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-solid">
              <CheckCircle2 className="size-4" aria-hidden />
              Lectura confirmada
              {item.readAt && (
                <span className="font-normal text-muted">· {fullDateFormat.format(item.readAt)}</span>
              )}
            </span>
          ) : (
            <form action={readAction}>
              <input type="hidden" name="circularId" value={item.id} />
              <button
                type="submit"
                disabled={readPending}
                className={pillButtonClass({ variant: "navy", size: "sm" })}
              >
                <CheckCircle2 aria-hidden />
                {readPending ? "Confirmando…" : "Confirmar lectura (Enterado)"}
              </button>
            </form>
          )}
        </div>

        {item.canDelete && (
          <div className="flex items-center gap-2">
            {confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2 rounded-control border border-red-solid/35 bg-red-l/45 px-3 py-1.5">
                <span className="text-xs font-bold text-navy">¿Eliminar circular?</span>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-control px-2 py-1 text-xs font-semibold text-navy hover:bg-white"
                >
                  Cancelar
                </button>
                <form action={deleteAction}>
                  <input type="hidden" name="circularId" value={item.id} />
                  <button
                    type="submit"
                    disabled={deletePending}
                    className="rounded-control bg-red-solid px-2.5 py-1 text-xs font-bold text-white hover:brightness-95"
                  >
                    {deletePending ? "Eliminando…" : "Sí, eliminar"}
                  </button>
                </form>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-red-l/60 hover:text-red-solid"
              >
                <Trash2 className="size-3.5" aria-hidden />
                Eliminar
              </button>
            )}
          </div>
        )}
      </footer>
    </article>
  );
}

/**
 * Bandeja editorial de 2 columnas en escritorio (lista escaneable + panel de lectura)
 * y vista plegable en móvil para evitar acumulación de texto largo.
 */
export function AgendaInbox({
  items,
  showReadStats,
}: {
  items: CircularItem[];
  showReadStats: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>(() => items[0]?.id ?? "");
  const [locallyReadIds, setLocallyReadIds] = useState<Set<string>>(() => new Set());
  const [mobileOpenId, setMobileOpenId] = useState<string | null>(() => items[0]?.id ?? null);

  const activeItem = items.find((i) => i.id === selectedId) ?? items[0] ?? null;

  function markLocallyRead(id: string) {
    setLocallyReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return (
    <>
      {/* Escritorio: bandeja 2 columnas sin amontonar texto */}
      <div className="hidden gap-5 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <aside aria-label="Lista de circulares" className="card overflow-hidden bg-white p-0">
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const selected = activeItem?.id === item.id;
              const isRead = item.isAuthor || Boolean(item.readAt) || locallyReadIds.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    aria-current={selected ? "true" : undefined}
                    className={`grid w-full gap-1.5 px-4 py-3.5 text-left transition-colors ${
                      selected
                        ? "border-l-4 border-l-cobalt bg-cloud/85"
                        : !isRead
                          ? "border-l-4 border-l-sky-solid bg-white hover:bg-bg-2/70"
                          : "border-l-4 border-l-transparent bg-white hover:bg-bg-2/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[0.7rem]">
                      <span className="truncate font-extrabold text-sky-solid uppercase">
                        {item.targetLabel}
                      </span>
                      <span className="shrink-0 font-semibold text-muted tabular">
                        {shortDateFormat.format(item.publishedAt)}
                      </span>
                    </div>

                    <p className={`line-clamp-2 text-sm leading-snug ${!isRead ? "font-extrabold text-navy" : "font-semibold text-ink"}`}>
                      {item.title}
                    </p>

                    <div className="flex items-center justify-between gap-2 text-xs text-muted">
                      <span className="truncate">{item.authorName}</span>
                      {!isRead ? (
                        <span className="size-2 shrink-0 rounded-full bg-sky-solid" aria-label="Sin leer" />
                      ) : !item.isAuthor ? (
                        <CheckCircle2 className="size-3.5 shrink-0 text-green-solid" aria-label="Leída" />
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {activeItem && (
          <CircularReader
            key={activeItem.id}
            item={activeItem}
            showReadStats={showReadStats}
            onMarkedRead={markLocallyRead}
          />
        )}
      </div>

      {/* Móvil y tableta: vista previa plegable para leer de una en una */}
      <div className="grid gap-3 lg:hidden">
        {items.map((item) => {
          const expanded = mobileOpenId === item.id;
          const isRead = item.isAuthor || Boolean(item.readAt) || locallyReadIds.has(item.id);
          return (
            <div key={item.id} className="grid gap-2">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setMobileOpenId(expanded ? null : item.id)}
                className={`card flex w-full items-start justify-between gap-3 bg-white text-left ${
                  !isRead ? "border-l-4 border-l-sky-solid" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[0.7rem]">
                    <span className="font-extrabold text-sky-solid uppercase">{item.targetLabel}</span>
                    <span className="text-muted">· {shortDateFormat.format(item.publishedAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-bold text-navy">{item.title}</p>
                  {!expanded && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{item.body}</p>
                  )}
                </div>
                <ChevronDown
                  className={`mt-1 size-4 shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>

              {expanded && (
                <CircularReader
                  key={item.id}
                  item={item}
                  showReadStats={showReadStats}
                  onMarkedRead={markLocallyRead}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
