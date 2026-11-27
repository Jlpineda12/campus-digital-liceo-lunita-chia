import type { Metadata } from "next";
import { GuardianChildren } from "@/components/dashboard/GuardianChildren";
import { SectionHeader, WelcomeHero } from "@/components/dashboard/parts";
import { StaffHome } from "@/components/dashboard/StaffHome";
import { StudentHome } from "@/components/dashboard/StudentHome";
import { TeacherHome } from "@/components/dashboard/TeacherHome";
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
 * Inicio por rol. Estudiante y familia: «Lo que sigue», «Cómo voy» y «Próxima insignia».
 * El tono sigue la etapa (SISTEMA_DISENO.md §3): cercano en primaria,
 * directo en bachillerato, operativo en lo institucional.
 */
export default async function DashboardPage() {
  const user = await requireSession();
  const data = await getDashboardData(user);

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
                ? "Tus clases, tareas y notas te esperan. ¡Vamos!"
                : data.context?.currentPeriod
                  ? `Bienvenido a tu Campus Digital · ${data.context.currentPeriod.name}.`
                  : "Bienvenido a tu Campus Digital."
            }
            context={data.context}
          />
          {data.context && (
            <StudentHome actor={user} view={data.student} academicYearId={data.context.year.id} audience="self" />
          )}
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
          {s && data.context && (
            <StudentHome actor={user} view={s} academicYearId={data.context.year.id} audience="guardian" />
          )}
        </div>
      );
    }

    case "TEACHER":
      return (
        <div className="grid gap-7">
          <WelcomeHero
            kicker="Docente"
            title={colombiaGreeting(user.firstName)}
            subtitle="Tus clases, planillas y asistencia del día, a un clic."
            context={data.context}
          />
          {data.context ? (
            <TeacherHome actor={user} context={data.context} directed={data.directed} />
          ) : (
            <TactileCard className="text-center text-muted">No hay un año lectivo vigente.</TactileCard>
          )}
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
          {data.overview && data.context ? (
            <StaffHome
              actor={user}
              context={data.context}
              navBadges={(await getCampusShellData(user)).navBadges}
              alerts={data.alerts}
            />
          ) : (
            <TactileCard className="text-center text-muted">
              No hay un año lectivo marcado como vigente. Configúralo en Estructura académica.
            </TactileCard>
          )}
        </div>
      );
  }
}
