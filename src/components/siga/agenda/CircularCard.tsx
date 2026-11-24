"use client";

import { CheckCircle2, Eye, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { Chip } from "@/components/ui/Chip";
import { pillButtonClass } from "@/components/ui/PillButton";
import {
  deleteCircularAction,
  markCircularReadAction,
  type AgendaActionState,
} from "@/modules/siga/agenda/actions";
import type { CircularItem } from "@/modules/siga/agenda/queries";

const INITIAL: AgendaActionState = { status: "idle" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/** Tarjeta editorial limpia para un comunicado o circular con confirmación de lectura. */
export function CircularCard({
  item,
  showReadStats,
}: {
  item: CircularItem;
  showReadStats: boolean;
}) {
  const [readState, readAction, readPending] = useActionState(markCircularReadAction, INITIAL);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCircularAction, INITIAL);

  const isRead = Boolean(item.readAt) || readState.status === "success";
  const paragraphs = item.body.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  return (
    <article
      className={`card grid gap-3.5 transition-colors ${
        !isRead ? "border-l-4 border-l-sky-solid" : ""
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={item.targetScope === "ALL" ? "blue" : "sky"}>{item.targetLabel}</Chip>
            {!isRead && (
              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-sky-solid">
                <span className="size-2 rounded-full bg-sky-solid" aria-hidden />
                Nueva
              </span>
            )}
          </div>
          <h2 className="mt-2 text-lg font-bold text-navy">{item.title}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {item.authorName} · <time dateTime={item.publishedAt.toISOString()}>{dateFormat.format(item.publishedAt)}</time>
          </p>
        </div>

        {showReadStats && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-control bg-cloud px-2.5 py-1 text-xs font-semibold text-navy tabular">
            <Eye className="size-3.5 text-cobalt" aria-hidden />
            {item.readCount} {item.readCount === 1 ? "lectura" : "lecturas"}
          </span>
        )}
      </header>

      <div className="grid gap-2.5 text-sm leading-relaxed text-ink-2">
        {paragraphs.map((paragraph, idx) => (
          <p key={idx} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line/80 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {isRead ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-solid">
              <CheckCircle2 className="size-4" aria-hidden />
              Lectura confirmada
              {item.readAt && (
                <span className="font-normal text-muted">
                  · {dateFormat.format(item.readAt)}
                </span>
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
          {readState.status === "error" && readState.message && (
            <span role="alert" className="text-xs font-semibold text-red-solid">
              {readState.message}
            </span>
          )}
        </div>

        {item.canDelete && (
          <form action={deleteAction}>
            <input type="hidden" name="circularId" value={item.id} />
            <button
              type="submit"
              disabled={deletePending}
              className="inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-red-l/60 hover:text-red-solid"
            >
              <Trash2 className="size-3.5" aria-hidden />
              {deletePending ? "Eliminando…" : "Eliminar"}
            </button>
          </form>
        )}
      </footer>

      {deleteState.status === "error" && deleteState.message && (
        <p role="alert" className="text-xs font-semibold text-red-solid">
          {deleteState.message}
        </p>
      )}
    </article>
  );
}
