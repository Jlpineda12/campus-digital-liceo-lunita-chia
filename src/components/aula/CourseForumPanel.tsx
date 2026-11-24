"use client";

import { MessageSquare, Pin, Send } from "lucide-react";
import { useActionState, useId } from "react";
import { Chip } from "@/components/ui/Chip";
import { pillButtonClass } from "@/components/ui/PillButton";
import { createForumPostAction, type AulaActionState } from "@/modules/aula/actions";
import type { CourseForumItem } from "@/modules/aula/queries";
import { isRole, ROLE_META } from "@/modules/core/auth/roles";

const INITIAL: AulaActionState = { status: "idle" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/** Muro limpio de avisos y preguntas del curso. */
export function CourseForumPanel({
  courseAssignmentId,
  posts,
  canPost,
  canPin,
}: {
  courseAssignmentId: string;
  posts: CourseForumItem[];
  canPost: boolean;
  canPin: boolean;
}) {
  const [state, action, pending] = useActionState(createForumPostAction, INITIAL);
  const id = useId();

  return (
    <div className="grid gap-5">
      {canPost && (
        <form action={action} className="card grid gap-3 bg-white">
          <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
          <div>
            <label htmlFor={`${id}-body`} className="field-label">
              {canPin ? "Publicar anuncio o aclaración para el curso" : "Hacer una pregunta o aporte en el curso"}
            </label>
            <textarea
              id={`${id}-body`}
              name="body"
              rows={3}
              required
              minLength={4}
              maxLength={2000}
              placeholder="Escribe tu mensaje con claridad y respeto…"
              className="input min-h-20 resize-y py-2 text-sm font-normal"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {canPin ? (
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink-2">
                <input type="checkbox" name="isPinned" className="size-4 accent-navy" />
                Fijar aviso en la parte superior
              </label>
            ) : (
              <span />
            )}

            <button type="submit" disabled={pending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
              <Send aria-hidden /> {pending ? "Publicando…" : "Publicar"}
            </button>
          </div>

          {state.message && (
            <p
              role={state.status === "error" ? "alert" : "status"}
              className={`text-xs font-semibold ${
                state.status === "error" ? "text-red-solid" : "text-green-solid"
              }`}
            >
              {state.message}
            </p>
          )}
        </form>
      )}

      {posts.length === 0 ? (
        <div className="card grid gap-2 py-8 text-center text-muted">
          <MessageSquare className="mx-auto size-7 opacity-50" aria-hidden />
          <p className="text-sm font-semibold text-navy">Aún no hay avisos en este curso</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {posts.map((p) => {
            const roleMeta = isRole(p.authorRole) ? ROLE_META[p.authorRole] : null;
            return (
              <li
                key={p.id}
                className={`card grid gap-2 ${p.isPinned ? "border-l-4 border-l-cobalt" : ""}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-navy">{p.authorName}</span>
                    {roleMeta && <Chip tone={roleMeta.tone}>{roleMeta.label}</Chip>}
                    {p.isPinned && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-cobalt">
                        <Pin className="size-3" aria-hidden /> Fijado
                      </span>
                    )}
                  </div>
                  <time dateTime={p.createdAt.toISOString()} className="text-xs text-muted">
                    {dateFormat.format(p.createdAt)}
                  </time>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{p.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
