import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MigrationWorkspace } from "@/components/admin/MigrationWorkspace";
import { TactileCard } from "@/components/ui/TactileCard";
import { getCurrentAcademicContext } from "@/modules/core/academic-structure/queries";
import { requireSession } from "@/modules/core/auth/guards";
import { can } from "@/modules/core/auth/permissions";
import { getMigrationHubData, getSimatExportRows } from "@/modules/migration/queries";

export const metadata: Metadata = { title: "Migración y SIMAT · Administración" };
export const dynamic = "force-dynamic";

export default async function MigracionAdminPage() {
  const actor = await requireSession();
  if (!can(actor.role, "migration.run")) {
    redirect("/dashboard");
  }

  const context = await getCurrentAcademicContext();
  if (!context) {
    return <TactileCard className="text-center text-muted">No hay un año lectivo vigente.</TactileCard>;
  }

  const [hub, simatRows] = await Promise.all([
    getMigrationHubData(context.year.id),
    getSimatExportRows(context.year.id),
  ]);

  return (
    <div className="grid gap-6">
      <header>
        <p className="kicker">Fase 5 · Administración y Transición · {context.year.name}</p>
        <h1 className="mt-1 text-step-3">Migración de Datos y Exportador SIMAT</h1>
        <p className="mt-1 text-sm text-muted">
          Importa estudiantes, familias, notas históricas SIGA, saldos de cartera y bancos Moodle XML con validación
          previa, acta de conciliación y exportación oficial SIMAT.
        </p>
      </header>

      <MigrationWorkspace
        yearName={context.year.name}
        yearNumber={context.year.year}
        reconciliation={hub.reconciliation}
        availableQuizzes={hub.availableQuizzes}
        batches={hub.batches}
        simatRows={simatRows}
      />
    </div>
  );
}
