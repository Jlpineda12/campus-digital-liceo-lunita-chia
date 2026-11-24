import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { revealStyle } from "@/components/dashboard/parts";
import { NavIcon } from "@/components/layout/NavIcon";
import type { NavIcon as NavIconName } from "@/modules/core/auth/navigation";
import type { Role } from "@/modules/core/auth/roles";
import type { Stage } from "@/modules/core/dashboard/stage";

interface FocusAction {
  id: string;
  icon: NavIconName;
  tone: "purple" | "sky" | "green" | "orange";
  kicker: string;
  title: string;
  meta: string;
  badge?: string;
  href: string;
}

/**
 * Franja guiada «Tu foco de hoy» en `/dashboard`.
 * Reemplaza los menús duplicados por 3 acciones reales priorizadas según el rol,
 * con iconos SVG duotono propios y conteo en vivo de pendientes.
 */
export function TodayFocusStrip({
  role,
  stage,
  studentFirstName,
  navBadges,
  coursesCount = 0,
}: {
  role: Role;
  stage?: Stage;
  studentFirstName?: string;
  navBadges: Record<string, number>;
  coursesCount?: number;
}) {
  const isPrimaria = stage === "primaria";
  const pendingTasks = navBadges.tasks ?? 0;
  const unreadCirculars = navBadges.agenda ?? 0;
  const pendingObs = navBadges.observer ?? 0;
  const pendingExc = navBadges.attendance ?? 0;
  const ungradedSubs = navBadges.courses ?? 0;

  const cards: FocusAction[] = (() => {
    switch (role) {
      case "STUDENT":
        return [
          {
            id: "tasks",
            icon: "tasks",
            tone: pendingTasks > 0 ? "orange" : "green",
            kicker: "Órbita Virtual",
            title: isPrimaria ? "Mis misiones y quizzes" : "Tareas y cuestionarios",
            meta:
              pendingTasks > 0
                ? `${pendingTasks} ${pendingTasks === 1 ? "actividad pendiente" : "actividades pendientes"}`
                : "Todo entregado y al día",
            badge: pendingTasks > 0 ? `${pendingTasks} pend.` : "Al día",
            href: pendingTasks > 0 ? "/aula/tareas?estado=pendientes" : "/aula/tareas",
          },
          {
            id: "agenda",
            icon: "agenda",
            tone: unreadCirculars > 0 ? "sky" : "green",
            kicker: "SIGA · Circulares",
            title: "Agenda y comunicados",
            meta:
              unreadCirculars > 0
                ? `${unreadCirculars} ${unreadCirculars === 1 ? "circular sin leer" : "circulares sin leer"}`
                : "Sin circulares pendientes",
            badge: unreadCirculars > 0 ? `${unreadCirculars} nueva${unreadCirculars === 1 ? "" : "s"}` : undefined,
            href: unreadCirculars > 0 ? "/siga/agenda?estado=pendientes" : "/siga/agenda",
          },
          {
            id: "grades",
            icon: "grades",
            tone: "purple",
            kicker: "Seguimiento SIEE",
            title: isPrimaria ? "Mis notas y cursos" : "Calificaciones y boletines",
            meta: `${coursesCount} ${coursesCount === 1 ? "asignatura activa" : "asignaturas activas"} este periodo`,
            href: "/siga/calificaciones",
          },
        ];

      case "GUARDIAN":
        return [
          {
            id: "tasks",
            icon: "tasks",
            tone: pendingTasks > 0 ? "orange" : "green",
            kicker: "Órbita Virtual",
            title: studentFirstName ? `Tareas de ${studentFirstName}` : "Tareas y quizzes",
            meta:
              pendingTasks > 0
                ? `${pendingTasks} ${pendingTasks === 1 ? "actividad pendiente" : "actividades pendientes"}`
                : "Sin entregas pendientes",
            badge: pendingTasks > 0 ? `${pendingTasks} pend.` : "Al día",
            href: "/aula/tareas",
          },
          {
            id: "agenda",
            icon: "agenda",
            tone: unreadCirculars > 0 ? "sky" : "green",
            kicker: "Comunicación oficial",
            title: "Circulares del colegio",
            meta:
              unreadCirculars > 0
                ? `${unreadCirculars} ${unreadCirculars === 1 ? "circular por confirmar" : "circulares por confirmar"}`
                : "Todas las circulares confirmadas",
            badge: unreadCirculars > 0 ? `${unreadCirculars} sin leer` : undefined,
            href: unreadCirculars > 0 ? "/siga/agenda?estado=pendientes" : "/siga/agenda",
          },
          {
            id: "observer-or-report",
            icon: pendingObs > 0 ? "observer" : "reportCards",
            tone: pendingObs > 0 ? "orange" : "purple",
            kicker: "SIGA Lunita",
            title: pendingObs > 0 ? "Observador por firmar" : "Boletines y notas",
            meta:
              pendingObs > 0
                ? `${pendingObs} ${pendingObs === 1 ? "anotación espera tu enterado" : "anotaciones esperan tu enterado"}`
                : "Consulta notas SIEE y boletines oficiales",
            badge: pendingObs > 0 ? `${pendingObs} firma${pendingObs === 1 ? "" : "s"}` : undefined,
            href: pendingObs > 0 ? "/siga/observador" : "/siga/boletines",
          },
        ];

      case "TEACHER":
        return [
          {
            id: "orbit",
            icon: "courses",
            tone: ungradedSubs > 0 ? "orange" : "purple",
            kicker: "Órbita Virtual",
            title: "Cursos, guías y quizzes",
            meta:
              ungradedSubs > 0
                ? `${ungradedSubs} ${ungradedSubs === 1 ? "entrega esperando nota" : "entregas esperando nota"}`
                : `${coursesCount} cursos listos para publicar guías`,
            badge: ungradedSubs > 0 ? `${ungradedSubs} por calificar` : undefined,
            href: "/aula",
          },
          {
            id: "attendance",
            icon: "attendance",
            tone: "sky",
            kicker: "Control diario",
            title: "Llamado a lista",
            meta: "Registra asistencia, retardos y novedades de hoy",
            href: "/siga/asistencia",
          },
          {
            id: "grades",
            icon: "grades",
            tone: "green",
            kicker: "SIGA · Planilla SIEE",
            title: "Calificaciones y logros",
            meta: "Carga notas y redacta logros por periodo",
            href: "/siga/calificaciones",
          },
        ];

      case "COORDINATOR":
      case "ADMIN": {
        const totalReviews = pendingExc + pendingObs;
        return [
          {
            id: "compliance",
            icon: "grades",
            tone: "sky",
            kicker: "Seguimiento académico",
            title: "Cumplimiento docente",
            meta: "Monitorea notas y logros por docente y grupo",
            href: "/siga/calificaciones",
          },
          {
            id: "reviews",
            icon: pendingExc > 0 ? "attendance" : "observer",
            tone: totalReviews > 0 ? "orange" : "green",
            kicker: "Convivencia y excusas",
            title: pendingExc > 0 ? "Excusas por revisar" : "Observador y asistencia",
            meta:
              totalReviews > 0
                ? `${pendingExc} excusa${pendingExc === 1 ? "" : "s"} · ${pendingObs} firma${pendingObs === 1 ? "" : "s"} pendiente${pendingObs === 1 ? "" : "s"}`
                : "Sin excusas ni alertas pendientes",
            badge: totalReviews > 0 ? `${totalReviews} pend.` : "Al día",
            href: pendingExc > 0 ? "/siga/asistencia?estado=PENDING" : "/siga/observador",
          },
          {
            id: "report-cards",
            icon: role === "ADMIN" ? "reportCards" : "agenda",
            tone: "purple",
            kicker: role === "ADMIN" ? "Rectoría y Secretaría" : "Comunicación",
            title: role === "ADMIN" ? "Boletines y habilitación" : "Agenda y circulares",
            meta:
              role === "ADMIN"
                ? "Emite boletines con QR o gestiona usuarios"
                : unreadCirculars > 0
                  ? `${unreadCirculars} circular${unreadCirculars === 1 ? "" : "es"} sin leer`
                  : "Publica circulares institucionales",
            href: role === "ADMIN" ? "/siga/boletines" : "/siga/agenda",
          },
        ];
      }
    }
  })();

  return (
    <section aria-labelledby="foco-hoy" className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="foco-hoy" className="text-step-2">
          {isPrimaria ? "¿Qué hacemos hoy?" : "Tu foco de hoy"}
        </h2>
        <p className="text-xs font-medium text-muted">
          Accesos prioritarios según tu actividad reciente
        </p>
      </div>

      <ul className="grid gap-3.5 md:grid-cols-3">
        {cards.map((card, index) => (
          <li key={card.id} className="reveal" style={revealStyle(index + 1)}>
            <Link
              href={card.href}
              className={`card card-interactive t-${card.tone} flex h-full flex-col gap-3`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="icon-bubble icon-bubble-sm">
                  <NavIcon name={card.icon} />
                </span>
                {card.badge && (
                  <span className="rounded-chip bg-(--l) px-2 py-0.5 text-[0.7rem] font-extrabold text-(--t-ink)">
                    {card.badge}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-[0.68rem] font-extrabold tracking-wider text-muted uppercase">
                  {card.kicker}
                </p>
                <h3 className="mt-0.5 text-base font-bold text-navy">{card.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{card.meta}</p>
              </div>

              <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-bold text-(--t-ink)">
                Abrir <ArrowRight className="size-3.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
