import { CalendarDays, CheckCircle2, Clock, MessageSquareText, UserRound } from "lucide-react";
import { revealStyle } from "@/components/dashboard/parts";
import { Chip } from "@/components/ui/Chip";
import { TactileCard } from "@/components/ui/TactileCard";
import { ROLE_META, type Role } from "@/modules/core/auth/roles";
import {
  canGuardianAcknowledge,
  canStudentAddStatement,
  getObserverWorkflowStatus,
  OBSERVER_CATEGORY_META,
  WORKFLOW_STATUS_LABELS,
} from "@/modules/siga/observer/meta";
import type { ObserverTimelineEntry } from "@/modules/siga/observer/queries";
import { CategoryBadge } from "./CategoryBadge";
import { GuardianAcknowledgeForm, StudentStatementForm } from "./ObserverActionForms";

const dateTimeFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/**
 * Línea de tiempo cronológica del Observador del Estudiante.
 * Se adapta al `data-stage` del contenedor (primaria, bachillerato o institucional).
 */
export function ObserverTimeline({
  entries,
  viewerRole,
  showStudentHeader = false,
  emptyMessage = "No hay anotaciones registradas en el observador.",
}: {
  entries: ObserverTimelineEntry[];
  viewerRole: Role;
  showStudentHeader?: boolean;
  emptyMessage?: string;
}) {
  if (entries.length === 0) {
    return (
      <TactileCard className="text-center text-muted">
        <p className="font-semibold text-navy">Sin anotaciones por mostrar</p>
        <p className="mt-1 text-sm">{emptyMessage}</p>
      </TactileCard>
    );
  }

  return (
    <ol className="grid gap-4" aria-label="Historial del observador">
      {entries.map((entry, index) => {
        const meta = OBSERVER_CATEGORY_META[entry.category];
        const status = getObserverWorkflowStatus(entry);
        const statusMeta = WORKFLOW_STATUS_LABELS[status];
        const allowStatement = viewerRole === "STUDENT" && canStudentAddStatement(entry);
        const allowAck = viewerRole === "GUARDIAN" && canGuardianAcknowledge(entry);

        return (
          <TactileCard
            as="li"
            key={entry.id}
            tone={meta.tone}
            className="reveal grid gap-3.5"
            style={revealStyle(Math.min(index + 1, 10))}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={entry.category} />
                <Chip tone={statusMeta.tone}>
                  {status === "ACKNOWLEDGED" ? (
                    <CheckCircle2 aria-hidden />
                  ) : (
                    <Clock aria-hidden />
                  )}
                  <span>{statusMeta.label}</span>
                </Chip>
                {entry.periodName && <Chip tone="blue">{entry.periodName}</Chip>}
              </div>
              <time
                dateTime={entry.createdAt.toISOString()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted"
              >
                <CalendarDays className="size-3.5" aria-hidden />
                {dateTimeFormat.format(entry.createdAt)}
              </time>
            </div>

            <div>
              {showStudentHeader && (
                <p className="mb-1 text-xs font-extrabold tracking-wide text-muted uppercase">
                  {entry.studentName} · {entry.gradeName} ({entry.groupName})
                </p>
              )}
              <h3 className="text-lg">{entry.title}</h3>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-2">
                {entry.description}
              </p>
            </div>

            {entry.commitment && (
              <div className="rounded-control border border-line bg-cloud/70 px-3.5 py-2.5 text-sm">
                <p className="text-xs font-extrabold tracking-wide text-navy uppercase">
                  Compromiso / Estrategia pedagógica
                </p>
                <p className="mt-1 text-ink-2">{entry.commitment}</p>
              </div>
            )}

            {entry.studentStatement && (
              <div className="rounded-control border border-sky-solid/25 bg-sky-l/40 px-3.5 py-2.5 text-sm">
                <p className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold tracking-wide text-sky-solid uppercase">
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquareText className="size-3.5" aria-hidden />
                    Descargos del estudiante
                  </span>
                  {entry.studentStatementAt && (
                    <time
                      dateTime={entry.studentStatementAt.toISOString()}
                      className="font-semibold normal-case text-muted"
                    >
                      {dateTimeFormat.format(entry.studentStatementAt)}
                    </time>
                  )}
                </p>
                <p className="mt-1 whitespace-pre-line text-ink">{entry.studentStatement}</p>
              </div>
            )}

            {entry.guardianAcknowledgedAt && (
              <div className="rounded-control border border-green-solid/25 bg-green-l/40 px-3.5 py-2.5 text-sm">
                <p className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold tracking-wide text-green-solid uppercase">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Enterado por acudiente
                    {entry.guardianAcknowledgedByName ? ` (${entry.guardianAcknowledgedByName})` : ""}
                  </span>
                  <time
                    dateTime={entry.guardianAcknowledgedAt.toISOString()}
                    className="font-semibold normal-case text-muted"
                  >
                    {dateTimeFormat.format(entry.guardianAcknowledgedAt)}
                  </time>
                </p>
                {entry.guardianComment && (
                  <p className="mt-1 whitespace-pre-line text-ink">{entry.guardianComment}</p>
                )}
              </div>
            )}

            {allowStatement && (
              <StudentStatementForm recordId={entry.id} hasCommitment={Boolean(entry.commitment)} />
            )}

            {allowAck && <GuardianAcknowledgeForm recordId={entry.id} />}

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-xs font-semibold text-muted">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-3.5" aria-hidden />
                Registrado por: {entry.authorName ?? "Equipo institucional"}
                {entry.authorRole ? ` · ${ROLE_META[entry.authorRole].label}` : ""}
              </span>
              {meta.escalatesToCoordination && (
                <span className="font-bold text-red-solid">Seguimiento por Coordinación de Convivencia</span>
              )}
            </footer>
          </TactileCard>
        );
      })}
    </ol>
  );
}
