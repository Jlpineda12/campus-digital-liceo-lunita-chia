import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminAdmissionsBoard } from "@/components/matriculas/AdminAdmissionsBoard";
import { cx } from "@/components/ui/cx";
import { ADMISSION_STATUSES, type AdmissionStatus } from "@/db/schema/matriculas";
import { requireSession } from "@/modules/core/auth/guards";
import { can } from "@/modules/core/auth/permissions";
import { ADMISSION_STATUS_META } from "@/modules/matriculas/catalog";
import { listStaffAdmissionsData } from "@/modules/matriculas/queries";

export const metadata: Metadata = { title: "Matrículas 2027 · Administración" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminMatriculasPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireSession();
  if (!can(actor.role, "enrollment.review")) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const rawStatus = single(sp.estado);
  const statusFilter = (ADMISSION_STATUSES as readonly string[]).includes(rawStatus ?? "")
    ? (rawStatus as AdmissionStatus)
    : undefined;

  const data = await listStaffAdmissionsData(statusFilter);
  const canFormalize = can(actor.role, "enrollment.formalize");

  return (
    <div className="grid gap-6">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">Gestión institucional · Admisiones 2027</p>
            <h1 className="mt-1 text-step-3">Bandeja de matrículas</h1>
            <p className="mt-1 text-sm text-muted">
              Revisa los 8 documentos privados, otorga aval académico y formaliza el ingreso a cada grupo.
            </p>
          </div>
          <Link
            href="/matriculas"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-control border border-line-2 bg-white px-3.5 py-2 text-xs font-bold text-navy no-underline hover:bg-cloud"
          >
            Abrir portal público /matriculas <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>

        {/* Pipeline por estado */}
        <nav aria-label="Filtrar solicitudes por estado" className="flex flex-wrap gap-2 border-b border-line pb-3">
          <Link
            href="/admin/matriculas"
            aria-current={!statusFilter ? "page" : undefined}
            className={cx(
              "rounded-control border px-3 py-1.5 text-xs font-bold no-underline transition-colors",
              !statusFilter
                ? "border-navy bg-navy text-white"
                : "border-line-2 bg-white text-navy hover:bg-cloud",
            )}
          >
            Todas ({data.totalCount})
          </Link>
          {ADMISSION_STATUSES.map((st) => (
            <Link
              key={st}
              href={`/admin/matriculas?estado=${st}`}
              aria-current={statusFilter === st ? "page" : undefined}
              className={cx(
                "rounded-control border px-3 py-1.5 text-xs font-bold no-underline transition-colors",
                statusFilter === st
                  ? "border-navy bg-navy text-white"
                  : "border-line-2 bg-white text-navy hover:bg-cloud",
              )}
            >
              {ADMISSION_STATUS_META[st].label} ({data.counts[st]})
            </Link>
          ))}
        </nav>
      </header>

      <AdminAdmissionsBoard
        applications={data.applications}
        groups={data.groups}
        canFormalize={canFormalize}
      />
    </div>
  );
}
