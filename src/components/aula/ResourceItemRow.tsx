"use client";

import { BookOpen, CheckCircle2, Download, ExternalLink, FileText, PlayCircle } from "lucide-react";
import { useActionState } from "react";
import { markResourceViewedAction, type AulaActionState } from "@/modules/aula/actions";

const INITIAL: AulaActionState = { status: "idle" };

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Fila limpia para un recurso de estudio (PDF seguro, lectura desplegable, video o enlace). */
export function ResourceItemRow({
  courseAssignmentId,
  resource,
  canMarkViewed,
}: {
  courseAssignmentId: string;
  resource: {
    id: string;
    type: "PDF" | "VIDEO" | "LINK" | "RICH_TEXT";
    title: string;
    contentTextOrUrl: string;
    hasFile: boolean;
    fileSizeBytes: number | null;
    viewed: boolean;
  };
  canMarkViewed: boolean;
}) {
  const [state, action, pending] = useActionState(markResourceViewedAction, INITIAL);
  const isViewed = resource.viewed || state.status === "success";
  const isExternal = resource.type === "LINK" || resource.type === "VIDEO";

  if (resource.type === "PDF" && resource.hasFile) {
    const viewHref = `/api/aula/archivos?tipo=recurso&id=${resource.id}`;
    const downloadHref = `/api/aula/archivos?tipo=recurso&id=${resource.id}&descargar=1`;
    const sizeLabel = formatBytes(resource.fileSizeBytes);

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-bg-2/40 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-md bg-red-l px-1.5 py-0.5 text-[0.65rem] font-extrabold text-red-solid">
            PDF
          </span>
          <div className="min-w-0">
            <a
              href={viewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm font-bold text-navy no-underline hover:text-sky-solid"
            >
              {resource.title}
            </a>
            {(resource.contentTextOrUrl || sizeLabel) && (
              <p className="mt-0.5 text-xs text-muted">
                {sizeLabel}
                {sizeLabel && resource.contentTextOrUrl ? " · " : ""}
                {resource.contentTextOrUrl}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={viewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-control border border-line-2 bg-white px-2.5 py-1 text-xs font-bold text-navy no-underline hover:bg-cloud"
          >
            <FileText className="size-3.5 text-cobalt" aria-hidden /> Abrir
          </a>
          <a
            href={downloadHref}
            className="inline-flex items-center gap-1 rounded-control border border-line-2 bg-white px-2.5 py-1 text-xs font-semibold text-navy no-underline hover:bg-cloud"
          >
            <Download className="size-3.5" aria-hidden /> Descargar
          </a>
          {canMarkViewed &&
            (isViewed ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-green-solid">
                <CheckCircle2 className="size-3.5" aria-hidden /> Visto
              </span>
            ) : (
              <form action={action}>
                <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
                <input type="hidden" name="resourceId" value={resource.id} />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-control border border-line-2 bg-white px-2.5 py-1 text-xs font-semibold text-navy hover:bg-cloud"
                >
                  {pending ? "…" : "Marcar visto"}
                </button>
              </form>
            ))}
        </div>
      </div>
    );
  }

  const Icon =
    resource.type === "VIDEO" ? PlayCircle : resource.type === "LINK" ? ExternalLink : BookOpen;

  if (!isExternal) {
    return (
      <details className="rounded-control border border-line bg-bg-2/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-cloud/60">
          <span className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-navy">
            <Icon className="size-4 shrink-0 text-cobalt" aria-hidden />
            <span className="truncate">{resource.title}</span>
          </span>
          {isViewed && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-green-solid">
              <CheckCircle2 className="size-3.5" aria-hidden /> Visto
            </span>
          )}
        </summary>
        <div className="grid gap-3 border-t border-line bg-white px-4 py-3.5 text-sm leading-relaxed text-ink-2">
          <p className="whitespace-pre-line">{resource.contentTextOrUrl}</p>
          {canMarkViewed && !isViewed && (
            <form action={action}>
              <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
              <input type="hidden" name="resourceId" value={resource.id} />
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-control border border-line-2 bg-cloud px-3 py-1.5 text-xs font-bold text-navy hover:border-green-solid hover:bg-green-l/50"
              >
                <CheckCircle2 className="size-3.5 text-green-solid" aria-hidden />
                {pending ? "Guardando…" : "Marcar como leído"}
              </button>
            </form>
          )}
        </div>
      </details>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-bg-2/40 px-4 py-3">
      <a
        href={resource.contentTextOrUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-navy no-underline hover:text-sky-solid"
      >
        <Icon className="size-4 shrink-0 text-sky-solid" aria-hidden />
        <span className="truncate">{resource.title}</span>
        <ExternalLink className="size-3.5 shrink-0 text-muted" aria-hidden />
      </a>

      {canMarkViewed &&
        (isViewed ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-solid">
            <CheckCircle2 className="size-3.5" aria-hidden /> Visto
          </span>
        ) : (
          <form action={action}>
            <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
            <input type="hidden" name="resourceId" value={resource.id} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-control border border-line-2 bg-white px-2.5 py-1 text-xs font-semibold text-navy hover:bg-cloud"
            >
              {pending ? "…" : "Marcar visto"}
            </button>
          </form>
        ))}
    </div>
  );
}
