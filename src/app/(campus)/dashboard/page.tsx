import type { Metadata } from "next";
import { DualZonePortal } from "@/components/dashboard/DualZonePortal";
import { GuardianChildren } from "@/components/dashboard/GuardianChildren";
import { SectionHeader, WelcomeHero } from "@/components/dashboard/parts";
import { StaffPanel } from "@/components/dashboard/StaffPanel";
import { StudentPanel } from "@/components/dashboard/StudentPanel";
import { DirectedGroups, TeacherLoadTable, TeacherStats } from "@/components/dashboard/TeacherPanel";
import { TactileCard } from "@/components/ui/TactileCard";
import { requireSession } from "@/modules/core/auth/guards";
import { ROLE_META } from "@/modules/core/auth/roles";
import { getDashboardData } from "@/modules/core/dashboard/service";
import { getCampusShellData } from "@/modules/core/dashboard/shell";

export const metadata: Metadata = { title: "Inicio" };

/** Saludo cálido según la hora oficial en Colombia (America/Bogota). */
function colombiaGreeting(firstName: string, playful = false): string {
  const hourStr = new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    hour12: false,
    timeZone: "America/Bogota",
  }).format(new Date());
  const hour = Number(hourStr);
  const base = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  return playful ? `¡${base}, ${firstName}!` : `${base}, ${firstName}`;
}

/**
 * Panel principal con Portal Dual (**Órbita Virtual ⇄ SIGA Lunita**) y analítica por rol.
 * El tono sigue la etapa (SISTEMA_DISENO.md §3): cercano en primaria,
 * directo en bachillerato, operativo en lo institucional.
 */
export default async function DashboardPage() {
  const user = await requireSession();
  const [data, shell] = await Promise.all([getDashboardData(user), getCampusShellData(user)]);

  switch (data.role) {
    case "STUDENT": {
      const { placement: p, stage } = data.student;
      const primaria = stage === "primaria";
      return (
        <div className="grid gap-7">
          <WelcomeHero
            kicker={p ? (primaria ? `Estudiante · ${p.groupName}` : `${p.groupName} · ${p.gradeName}`) : "Estudiante"}
            title={colombiaGreeting(user.firstName, primaria)}
            subtitle={
              primaria
                ? "Elige si quieres entrar a tus cursos en Órbita Virtual o revisar tus notas en SIGA Lunita."
                : data.context?.currentPeriod
                  ? `Bienvenido a tu Campus Digital · ${data.context.currentPeriod.name}.`
                  : "Bienvenido a tu Campus Digital."
            }
            context={data.context}
          />
          <DualZonePortal
            role="STUDENT"
            stage={stage}
            navBadges={shell.navBadges}
            coursesCount={data.student.courses.length}
          />
          <StudentPanel view={data.student} audience="self" />
        </div>
      );
    }

    case "GUARDIAN": {
      const s = data.selected;
      return (
        <div className="grid gap-7">
          <WelcomeHero
            kicker="Familia Lunita"
            title={colombiaGreeting(user.firstName)}
            subtitle={
              s?.placement
                ? `Estás consultando a ${s.firstName} · ${s.placement.gradeName} ${s.placement.groupName}.`
                : "Consulta aquí el proceso académico y financiero de tus hijos."
            }
            context={data.context}
          />
          {data.children.length === 0 ? (
            <TactileCard className="text-center">
              <h2 className="text-lg">No hay estudiantes vinculados a tu cuenta</h2>
              <p className="mt-1 text-muted">Comunícate con Secretaría para vincular a tus hijos.</p>
            </TactileCard>
          ) : data.children.length > 1 ? (
            <section aria-labelledby="hijos">
              <SectionHeader id="hijos" title="Tus hijos" description="Selecciona a quién quieres consultar." />
              <GuardianChildren items={data.children} selectedId={s?.studentId ?? null} />
            </section>
          ) : null}
          <DualZonePortal
            role="GUARDIAN"
            stage="institucional"
            studentFirstName={s?.firstName}
            navBadges={shell.navBadges}
            coursesCount={s?.courses.length ?? 0}
          />
          {s && <StudentPanel view={s} audience="guardian" />}
        </div>
      );
    }

    case "TEACHER":
      return (
        <div className="grid gap-7">
          <WelcomeHero
            kicker="Docente"
            title={colombiaGreeting(user.firstName)}
            subtitle="Gestiona tus cursos y quices en Órbita Virtual o tus planillas y asistencia en SIGA Lunita."
            context={data.context}
          />
          <DualZonePortal
            role="TEACHER"
            stage="institucional"
            navBadges={shell.navBadges}
            coursesCount={data.totals.courses}
          />
          <TeacherStats totals={data.totals} />
          <DirectedGroups groups={data.directed} />
          <TeacherLoadTable load={data.load} />
        </div>
      );

    case "COORDINATOR":
    case "ADMIN":
      return (
        <div className="grid gap-7">
          <WelcomeHero
            kicker={ROLE_META[data.role].label}
            title={colombiaGreeting(user.firstName)}
            subtitle={data.context ? `Panorama institucional · ${data.context.year.name}` : "Panorama institucional"}
            context={data.context}
          />
          <DualZonePortal role={data.role} stage="institucional" navBadges={shell.navBadges} />
          {data.overview && data.context ? (
            <StaffPanel overview={data.overview} context={data.context} />
          ) : (
            <TactileCard className="text-center text-muted">
              No hay un año lectivo marcado como vigente. Configúralo en Estructura académica.
            </TactileCard>
          )}
        </div>
      );
  }
}
