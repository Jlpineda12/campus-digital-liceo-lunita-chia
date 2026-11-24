"use client";

import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Paperclip,
  Save,
  Send,
} from "lucide-react";
import { useActionState, useId } from "react";
import { Chip } from "@/components/ui/Chip";
import { PerformanceBadge } from "@/components/ui/PerformanceBadge";
import { pillButtonClass } from "@/components/ui/PillButton";
import {
  gradeSubmissionAction,
  submitAssignmentAction,
  type AulaActionState,
} from "@/modules/aula/actions";
import type { ActivitySubmissionRow } from "@/modules/aula/queries";
import type { SieeScale } from "@/modules/siga/siee-grades/scale";

const INITIAL: AulaActionState = { status: "idle" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/** Formulario de entrega del estudiante (o vista de acompañamiento en solo lectura para acudiente). */
export function StudentSubmissionBox({
  courseAssignmentId,
  activityId,
  canSubmit,
  isGuardian,
  submission,
  scale,
}: {
  courseAssignmentId: string;
  activityId: string;
  canSubmit: boolean;
  isGuardian: boolean;
  submission: ActivitySubmissionRow | null;
  scale: SieeScale;
}) {
  const [state, action, pending] = useActionState(submitAssignmentAction, INITIAL);
  const id = useId();
  const isGraded = submission !== null && submission.score !== null;

  return (
    <section aria-label="Entrega de la actividad" className="card grid gap-4 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <h2 className="text-base font-bold text-navy">
          {isGuardian ? `Estado de entrega · ${submission?.studentName ?? "Estudiante"}` : "Tu entrega"}
        </h2>
        {isGraded ? (
          <PerformanceBadge score={submission.score!} scale={scale} />
        ) : submission?.submittedAt ? (
          <Chip tone="sky">
            <CheckCircle2 aria-hidden /> Entregada · en revisión
          </Chip>
        ) : (
          <Chip tone="orange">
            <Clock aria-hidden /> Pendiente de entrega
          </Chip>
        )}
      </div>

      {isGraded && submission.teacherFeedback && (
        <div className="rounded-control border border-green/35 bg-green-l/50 px-4 py-3 text-sm">
          <p className="text-xs font-extrabold tracking-wider text-green-solid uppercase">
            Retroalimentación del docente
          </p>
          <p className="mt-1 whitespace-pre-line text-ink-2">{submission.teacherFeedback}</p>
        </div>
      )}

      {submission?.submittedAt && (
        <div className="grid gap-2 rounded-control border border-line bg-bg-2/50 p-3.5 text-sm">
          <p className="text-xs font-semibold text-muted">
            Enviada el {dateFormat.format(submission.submittedAt)}
            {submission.isLate && " · Entrega fuera de plazo"}
          </p>
          {submission.textResponse && (
            <p className="whitespace-pre-line leading-relaxed text-ink-2">{submission.textResponse}</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {submission.hasAttachment && submission.submissionId && (
              <>
                <a
                  href={`/api/aula/archivos?tipo=entrega&id=${submission.submissionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-control border border-line-2 bg-white px-2.5 py-1 text-xs font-bold text-navy no-underline hover:bg-cloud"
                >
                  <FileText className="size-3.5 text-cobalt" aria-hidden /> Ver archivo adjunto
                </a>
                <a
                  href={`/api/aula/archivos?tipo=entrega&id=${submission.submissionId}&descargar=1`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-sky-solid"
                >
                  <Download className="size-3.5" aria-hidden /> Descargar
                </a>
              </>
            )}
            {submission.referenceUrl && (
              <a
                href={submission.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-solid"
              >
                <ExternalLink className="size-3.5" aria-hidden /> Ver enlace adjunto
              </a>
            )}
          </div>
        </div>
      )}

      {isGuardian && (
        <p className="text-xs text-muted">
          Como acudiente puedes hacer seguimiento a las entregas y retroalimentación; el envío lo realiza el estudiante
          desde su cuenta.
        </p>
      )}

      {canSubmit && !isGraded && (
        <form action={action} className="grid gap-3.5">
          <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
          <input type="hidden" name="activityId" value={activityId} />

          <div>
            <label htmlFor={`${id}-text`} className="field-label">
              {submission?.submittedAt ? "Actualizar respuesta de tu entrega" : "Escribe tu respuesta o desarrollo"}
            </label>
            <textarea
              id={`${id}-text`}
              name="textResponse"
              rows={5}
              maxLength={6000}
              defaultValue={submission?.textResponse ?? ""}
              placeholder="Redacta aquí tu respuesta, conclusiones o resumen del trabajo (opcional si adjuntas PDF o foto)…"
              className="input min-h-32 resize-y py-2.5 text-sm leading-relaxed font-normal"
            />
          </div>

          <div className="rounded-control border border-dashed border-line-2 bg-bg-2/50 p-3.5">
            <label htmlFor={`${id}-file`} className="field-label inline-flex items-center gap-1.5">
              <Paperclip className="size-3.5 text-cobalt" aria-hidden />
              Adjuntar archivo PDF o foto del cuaderno (opcional · máx. 5 MB)
            </label>
            <input
              id={`${id}-file`}
              name="attachment"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              className="mt-1.5 block w-full text-xs text-ink-2 file:mr-3 file:rounded-control file:border file:border-line-2 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-navy hover:file:bg-cloud"
            />
            <p className="mt-1 text-[0.7rem] text-muted">
              Formatos aceptados: PDF, PNG, JPG o WebP. Tus archivos se guardan en almacenamiento privado del campus.
            </p>
          </div>

          <div>
            <label htmlFor={`${id}-url`} className="field-label">
              Enlace de evidencia (opcional — Drive, Canva, video o documento https://)
            </label>
            <input
              id={`${id}-url`}
              name="referenceUrl"
              type="url"
              defaultValue={submission?.referenceUrl ?? ""}
              placeholder="https://..."
              className="input min-h-10 text-sm font-medium"
            />
          </div>

          {state.message && (
            <p
              role={state.status === "error" ? "alert" : "status"}
              className={`text-sm font-semibold ${
                state.status === "error" ? "text-red-solid" : "text-green-solid"
              }`}
            >
              {state.message}
            </p>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={pending} className={pillButtonClass({ variant: "navy" })}>
              <Send aria-hidden />
              {pending
                ? "Enviando…"
                : submission?.submittedAt
                  ? "Actualizar entrega"
                  : "Enviar entrega"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Fila rápida de calificación inline para docentes (sincroniza directo con SIGA). */
function TeacherGradeRow({
  courseAssignmentId,
  activityId,
  row,
  canGrade,
  syncToSiga,
  scale,
}: {
  courseAssignmentId: string;
  activityId: string;
  row: ActivitySubmissionRow;
  canGrade: boolean;
  syncToSiga: boolean;
  scale: SieeScale;
}) {
  const [state, action, pending] = useActionState(gradeSubmissionAction, INITIAL);
  const id = useId();

  return (
    <li className="grid gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-navy">{row.studentName}</p>
          <p className="mt-0.5 text-xs text-muted">
            {row.submittedAt ? (
              <>
                Entregado el {dateFormat.format(row.submittedAt)}
                {row.isLate && <span className="ml-1.5 font-semibold text-orange-solid">· Tardía</span>}
              </>
            ) : (
              "Sin entrega registrada"
            )}
          </p>
        </div>

        {row.score !== null ? (
          <PerformanceBadge score={row.score} scale={scale} />
        ) : row.submittedAt ? (
          <Chip tone="orange">Por calificar</Chip>
        ) : (
          <Chip tone="sky">Pendiente</Chip>
        )}
      </div>

      {(row.textResponse || row.referenceUrl || row.hasAttachment) && (
        <div className="rounded-control bg-cloud/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink-2">
          {row.textResponse && <p className="whitespace-pre-line">{row.textResponse}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {row.hasAttachment && row.submissionId && (
              <>
                <a
                  href={`/api/aula/archivos?tipo=entrega&id=${row.submissionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-control border border-line-2 bg-white px-2.5 py-1 font-bold text-navy no-underline hover:bg-cloud"
                >
                  <FileText className="size-3.5 text-cobalt" aria-hidden /> Ver archivo adjunto
                </a>
                <a
                  href={`/api/aula/archivos?tipo=entrega&id=${row.submissionId}&descargar=1`}
                  className="inline-flex items-center gap-1 font-bold text-sky-solid"
                >
                  <Download className="size-3.5" aria-hidden /> Descargar
                </a>
              </>
            )}
            {row.referenceUrl && (
              <a
                href={row.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-sky-solid"
              >
                <ExternalLink className="size-3.5" aria-hidden /> Abrir enlace adjunto
              </a>
            )}
          </div>
        </div>
      )}

      {canGrade && (
        <form action={action} className="grid gap-2.5 sm:grid-cols-[7rem_1fr_auto] sm:items-end">
          <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
          <input type="hidden" name="activityId" value={activityId} />
          <input type="hidden" name="enrollmentId" value={row.enrollmentId} />

          <div>
            <label htmlFor={`${id}-score`} className="field-label">
              Nota (1.0–5.0)
            </label>
            <input
              id={`${id}-score`}
              name="score"
              inputMode="decimal"
              required
              defaultValue={row.score !== null ? row.score.toFixed(1) : ""}
              placeholder="4.5"
              className="input min-h-9 text-sm font-bold tabular"
            />
          </div>

          <div>
            <label htmlFor={`${id}-fb`} className="field-label">
              Retroalimentación (opcional)
            </label>
            <input
              id={`${id}-fb`}
              name="teacherFeedback"
              maxLength={1500}
              defaultValue={row.teacherFeedback ?? ""}
              placeholder="Comentario constructivo para el estudiante…"
              className="input min-h-9 text-sm font-normal"
            />
          </div>

          <button type="submit" disabled={pending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
            <Save aria-hidden /> {pending ? "Guardando…" : syncToSiga ? "Guardar y enviar a SIGA" : "Guardar"}
          </button>

          {state.message && (
            <p
              role={state.status === "error" ? "alert" : "status"}
              className={`inline-flex items-center gap-1 text-xs font-semibold sm:col-span-3 ${
                state.status === "error" ? "text-red-solid" : "text-green-solid"
              }`}
            >
              {state.status === "success" && syncToSiga && <Link2 className="size-3.5" aria-hidden />}
              {state.message}
            </p>
          )}
        </form>
      )}
    </li>
  );
}

/** Bandeja docente de entregas y calificación rápida con sincronización SIGA. */
export function TeacherSubmissionsRoster({
  courseAssignmentId,
  activityId,
  rows,
  canGrade,
  syncToSiga,
  scale,
}: {
  courseAssignmentId: string;
  activityId: string;
  rows: ActivitySubmissionRow[];
  canGrade: boolean;
  syncToSiga: boolean;
  scale: SieeScale;
}) {
  const submitted = rows.filter((r) => r.submittedAt !== null).length;
  const graded = rows.filter((r) => r.score !== null).length;

  return (
    <section aria-label="Entregas de estudiantes" className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="text-base font-bold text-navy">
          Entregas del grupo ({submitted}/{rows.length})
        </h2>
        <p className="text-xs text-muted tabular">
          {graded} calificada{graded === 1 ? "" : "s"}
          {syncToSiga && " · Las notas se sincronizan directo a la planilla SIGA"}
        </p>
      </div>

      <ul className="card divide-y divide-line p-0">
        {rows.map((row) => (
          <TeacherGradeRow
            key={row.enrollmentId}
            courseAssignmentId={courseAssignmentId}
            activityId={activityId}
            row={row}
            canGrade={canGrade}
            syncToSiga={syncToSiga}
            scale={scale}
          />
        ))}
      </ul>
    </section>
  );
}
