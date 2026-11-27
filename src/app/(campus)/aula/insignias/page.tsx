import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeGrid } from "@/components/aula/BadgeGrid";
import { LunitaMark } from "@/components/brand/LunitaMark";
import { TactileCard } from "@/components/ui/TactileCard";
import {
  getCurrentAcademicContext,
  getGuardianChildren,
  getStudentPlacement,
} from "@/modules/core/academic-structure/queries";
import { requireSession } from "@/modules/core/auth/guards";
import { resolveSelectedChildId } from "@/modules/core/auth/policies";
import { stageForLevel } from "@/modules/core/dashboard/stage";
import { evaluateBadges, nextBadge } from "@/modules/aula/badges";
import { getBadgeStats } from "@/modules/aula/badges-queries";
import { getScaleForYear } from "@/modules/siga/siee-grades/queries";

export const metadata: Metadata = { title: "Insignias · Órbita Virtual" };

export default async function InsigniasPage() {
  const actor = await requireSession();
  if (actor.role !== "STUDENT" && actor.role !== "GUARDIAN") redirect("/aula");

  const context = await getCurrentAcademicContext();
  if (!context) {
    return <TactileCard className="text-center text-muted">No hay un año lectivo vigente.</TactileCard>;
  }

  let studentId = actor.id;
  let childName: string | null = null;
  if (actor.role === "GUARDIAN") {
    const children = await getGuardianChildren(actor.id, context.year.id);
    const selectedId = await resolveSelectedChildId(children.map((c) => c.studentId));
    const child = children.find((c) => c.studentId === selectedId);
    if (!child) {
      return <TactileCard className="text-center text-muted">No hay estudiantes vinculados a tu cuenta.</TactileCard>;
    }
    studentId = child.studentId;
    childName = child.firstName;
  }

  const [placement, scale] = await Promise.all([
    getStudentPlacement(studentId, context.year.id),
    getScaleForYear(context.year.id),
  ]);
  if (!placement) {
    return <TactileCard className="text-center text-muted">Sin matrícula activa en el año lectivo actual.</TactileCard>;
  }

  const stats = await getBadgeStats({
    enrollmentId: placement.enrollmentId,
    studentId,
    groupId: placement.groupId,
    academicYearId: context.year.id,
    superiorFrom: scale.superiorFrom,
  });
  const badges = evaluateBadges(stats);
  const earned = badges.filter((b) => b.earned).length;
  const next = nextBadge(badges);

  return (
    <div data-stage={stageForLevel(placement.levelCode)} className="grid gap-6">
      <header className="flex flex-wrap items-center gap-5">
        <LunitaMark size={72} className="mascot" />
        <div className="min-w-0 flex-1">
          <h1 className="text-step-3">{childName ? `Insignias de ${childName}` : "Mis insignias"}</h1>
          <p className="mt-1 text-muted">
            Se ganan con lo que haces cada día: entregar, participar, explorar y asistir.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white px-5 py-3 text-center shadow-xs">
          <p className="text-3xl font-black text-navy tabular">
            {earned}
            <span className="text-lg text-muted">/{badges.length}</span>
          </p>
          <p className="text-xs font-bold text-muted">conseguidas</p>
        </div>
      </header>

      {next && (
        <p className="rounded-control border border-cobalt/20 bg-cloud px-4 py-3 text-sm text-ink-2">
          <strong className="text-navy">Próxima: {next.name}.</strong> {next.description} Vas{" "}
          <strong className="tabular">
            {next.current} de {next.target}
          </strong>
          .
        </p>
      )}

      <BadgeGrid badges={badges} />
    </div>
  );
}
