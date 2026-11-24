import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminCarteraBoard, FamilyCarteraView } from "@/components/siga/cartera/CarteraWorkspace";
import { TactileCard } from "@/components/ui/TactileCard";
import { getCurrentAcademicContext } from "@/modules/core/academic-structure/queries";
import { requireSession } from "@/modules/core/auth/guards";
import { can } from "@/modules/core/auth/permissions";
import { stageForLevel } from "@/modules/core/dashboard/stage";
import {
  getAdminBillingOverview,
  getFamilyBillingStatement,
} from "@/modules/siga/cartera/queries";

export const metadata: Metadata = { title: "Cartera y pagos · SIGA Lunita" };
/** Datos financieros sensibles: nunca se almacenan en caché estática. */
export const dynamic = "force-dynamic";

export default async function CarteraPage() {
  const actor = await requireSession();
  const isAdmin = can(actor.role, "billing.manage");
  const isGuardian = can(actor.role, "billing.view.family");

  if (!isAdmin && !isGuardian) {
    redirect("/dashboard");
  }

  const context = await getCurrentAcademicContext();
  if (!context) {
    return <TactileCard className="text-center text-muted">No hay un año lectivo vigente.</TactileCard>;
  }

  if (isGuardian) {
    const res = await getFamilyBillingStatement(actor, context.year.id);
    if (res.kind === "no_student") {
      return (
        <TactileCard className="py-10 text-center text-muted">
          No encontramos estudiantes activos vinculados a tu cuenta en {context.year.name}.
        </TactileCard>
      );
    }

    if (res.kind === "not_financial_responsible") {
      return (
        <TactileCard className="mx-auto grid max-w-xl justify-items-center gap-2 py-10 text-center">
          <ShieldAlert className="size-8 text-cobalt" aria-hidden />
          <h1 className="text-lg font-extrabold text-navy">Acceso financiero restringido</h1>
          <p className="text-sm text-muted">
            Por seguridad y privacidad familiar, el estado de cuenta de <strong>{res.studentName}</strong> solo está
            habilitado para el acudiente registrado como <strong>responsable financiero</strong>. Si necesitas actualizar
            este permiso, solicítalo en Secretaría.
          </p>
        </TactileCard>
      );
    }

    return (
      <div data-stage={stageForLevel(res.statement.levelCode)} className="grid gap-6">
        <header>
          <p className="kicker">SIGA Financiero · {context.year.name}</p>
          <h1 className="mt-1 text-step-3">Cartera y pagos</h1>
          <p className="mt-1 text-sm text-muted">
            Estado de cuenta de Matrícula y Pensiones (Febrero a Noviembre), recibos y Paz y Salvo verificable.
          </p>
        </header>
        <FamilyCarteraView statement={res.statement} yearName={context.year.name} />
      </div>
    );
  }

  const overview = await getAdminBillingOverview(context.year.id);

  return (
    <div className="grid gap-6">
      <header>
        <p className="kicker">Tesorería y Rectoría · {context.year.name}</p>
        <h1 className="mt-1 text-step-3">Matriz de Cartera (Febrero – Noviembre)</h1>
        <p className="mt-1 text-sm text-muted">
          Control mensual interactivo por estudiante y grupo, becas/descuentos auditados, gráficas de recaudo y libro
          exportable a Excel.
        </p>
      </header>
      <AdminCarteraBoard
        academicYearId={context.year.id}
        yearNumber={context.year.year}
        courseGroups={overview.courseGroups}
        accounts={overview.accounts}
        ledgerReceipts={overview.ledgerReceipts}
      />
    </div>
  );
}
