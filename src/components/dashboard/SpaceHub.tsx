import { ArrowRight, BookOpen, CalendarCheck2, ClipboardCheck, ClipboardList, FileText, GraduationCap, Megaphone, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { revealStyle } from "@/components/dashboard/parts";
import { Chip } from "@/components/ui/Chip";
import { PlatformLogo } from "@/components/ui/PlatformLogo";
import { TactileCard } from "@/components/ui/TactileCard";
import type { Role } from "@/modules/core/auth/roles";
import { PLATFORM_SPACES } from "@/modules/core/brand/config";
import type { Stage } from "@/modules/core/dashboard/stage";

interface QuickLink {
  label: string;
  href: string;
  badge?: string;
}

/**
 * Seccionamiento claro de ecosistemas al ingresar: SIGA Lunita vs Órbita Virtual
 * (y Gestión Institucional para directivos), con accesos directos en 1 clic.
 */
export function SpaceHub({
  role,
  stage,
  studentFirstName,
  counts,
}: {
  role: Role;
  stage?: Stage;
  studentFirstName?: string;
  counts?: {
    courses?: number;
    pendingObserver?: number;
    pendingExcuses?: number;
  };
}) {
  const isPrimaria = stage === "primaria";

  const sigaLinks: QuickLink[] = (() => {
    switch (role) {
      case "STUDENT":
        return [
          { label: isPrimaria ? "Ver mis notas" : "Calificaciones SIEE", href: "/siga/calificaciones" },
          { label: "Mis boletines PDF", href: "/siga/boletines" },
          {
            label: "Mi observador",
            href: "/siga/observador",
            badge: counts?.pendingObserver ? `${counts.pendingObserver} pendiente${counts.pendingObserver === 1 ? "" : "s"}` : undefined,
          },
          { label: "Mi asistencia", href: "/siga/asistencia" },
          { label: "Agenda y circulares", href: "/siga/agenda" },
        ];
      case "GUARDIAN":
        return [
          {
            label: studentFirstName ? `Notas de ${studentFirstName}` : "Calificaciones",
            href: "/siga/calificaciones",
          },
          { label: "Boletines oficiales PDF", href: "/siga/boletines" },
          {
            label: "Observador",
            href: "/siga/observador",
            badge: counts?.pendingObserver ? `${counts.pendingObserver} por firmar` : undefined,
          },
          { label: "Asistencia y excusas", href: "/siga/asistencia" },
          { label: "Agenda y circulares", href: "/siga/agenda" },
        ];
      case "TEACHER":
        return [
          { label: "Notas y logros (Planilla SIEE)", href: "/siga/calificaciones" },
          { label: "Tomar asistencia", href: "/siga/asistencia" },
          { label: "Registrar en observador", href: "/siga/observador" },
          { label: "Boletines (Dirección de grupo)", href: "/siga/boletines" },
          { label: "Agenda y circulares", href: "/siga/agenda" },
        ];
      case "COORDINATOR":
      case "ADMIN":
        return [
          { label: "Planillas y logros", href: "/siga/calificaciones" },
          { label: "Boletines y emisión QR", href: "/siga/boletines" },
          {
            label: "Observador y convivencia",
            href: "/siga/observador",
            badge: counts?.pendingObserver ? `${counts.pendingObserver} sin firma` : undefined,
          },
          {
            label: "Asistencia y excusas",
            href: "/siga/asistencia",
            badge: counts?.pendingExcuses ? `${counts.pendingExcuses} por revisar` : undefined,
          },
          { label: "Agenda y circulares", href: "/siga/agenda" },
        ];
    }
  })();

  const isStaff = role === "COORDINATOR" || role === "ADMIN";
  const secondSpace = isStaff ? PLATFORM_SPACES.admin : PLATFORM_SPACES.aula;

  return (
    <section aria-labelledby="espacios-campus" className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="espacios-campus" className="text-step-2">
          {isPrimaria ? "Elige a dónde quieres ir" : "Espacios del Campus"}
        </h2>
        <p className="text-sm text-muted">
          Acceso directo y separado entre gestión académica y aprendizaje virtual.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ecosistema 1: SIGA Lunita */}
        <TactileCard tone="sky" className="reveal flex flex-col gap-4" style={revealStyle(1)}>
          <div className="flex items-start gap-3.5">
            <PlatformLogo space="siga" size={48} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg">{PLATFORM_SPACES.siga.name}</h3>
                <Chip tone="sky">Activo</Chip>
              </div>
              <p className="mt-0.5 text-sm text-muted">{PLATFORM_SPACES.siga.tagline}</p>
            </div>
          </div>

          <ul className="mt-auto grid gap-2">
            {sigaLinks.map((item) => (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-control border border-line bg-bg-2/70 px-3.5 py-2.5 text-sm font-semibold text-navy no-underline transition-colors hover:border-sky-solid hover:bg-sky-l/40"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {item.href.includes("calificaciones") && <GraduationCap className="size-4 shrink-0 text-sky-solid" aria-hidden />}
                    {item.href.includes("boletines") && <ClipboardList className="size-4 shrink-0 text-sky-solid" aria-hidden />}
                    {item.href.includes("observador") && <FileText className="size-4 shrink-0 text-sky-solid" aria-hidden />}
                    {item.href.includes("asistencia") && <CalendarCheck2 className="size-4 shrink-0 text-sky-solid" aria-hidden />}
                    {item.href.includes("agenda") && <Megaphone className="size-4 shrink-0 text-sky-solid" aria-hidden />}
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {item.badge && (
                      <span className="rounded-chip bg-orange-l px-2 py-0.5 text-xs font-bold text-orange-solid">
                        {item.badge}
                      </span>
                    )}
                    <ArrowRight className="size-4 text-muted" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </TactileCard>

        {/* Ecosistema 2: Órbita Virtual (Estudiantes/Familias/Docentes) o Gestión Institucional (Staff) */}
        <TactileCard tone={secondSpace.tone} className="reveal flex flex-col gap-4" style={revealStyle(2)}>
          <div className="flex items-start gap-3.5">
            <PlatformLogo space={secondSpace.key} size={48} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg">{secondSpace.name}</h3>
                {isStaff ? (
                  <Chip tone="yellow">Dirección</Chip>
                ) : (
                  <Chip tone="purple">Activo</Chip>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted">{secondSpace.tagline}</p>
            </div>
          </div>

          {isStaff ? (
            <ul className="mt-auto grid gap-2">
              {role === "ADMIN" && (
                <li>
                  <Link
                    href="/admin/usuarios"
                    className="flex items-center justify-between gap-2 rounded-control border border-line bg-bg-2/70 px-3.5 py-2.5 text-sm font-semibold text-navy no-underline transition-colors hover:border-navy hover:bg-yellow-l/40"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Users className="size-4 text-navy" aria-hidden />
                      Usuarios, roles y sesiones
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              )}
              <li>
                <Link
                  href="/admin/estructura"
                  className="flex items-center justify-between gap-2 rounded-control border border-line bg-bg-2/70 px-3.5 py-2.5 text-sm font-semibold text-navy no-underline transition-colors hover:border-navy hover:bg-yellow-l/40"
                >
                  <span className="inline-flex items-center gap-2">
                    <Settings2 className="size-4 text-navy" aria-hidden />
                    Periodos y cierres SIEE
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
              <li>
                <Link
                  href="/siga/asistencia"
                  className="flex items-center justify-between gap-2 rounded-control border border-line bg-bg-2/70 px-3.5 py-2.5 text-sm font-semibold text-navy no-underline transition-colors hover:border-navy hover:bg-yellow-l/40"
                >
                  <span className="inline-flex items-center gap-2">
                    <ClipboardList className="size-4 text-navy" aria-hidden />
                    Revisar excusas médicas
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            </ul>
          ) : (
            <div className="grid gap-3">
              <ul className="grid gap-2">
                <li>
                  <Link
                    href="/aula"
                    className="flex items-center justify-between gap-3 rounded-control border border-line bg-bg-2/70 px-3.5 py-2.5 text-sm font-semibold text-navy no-underline transition-colors hover:border-purple-solid hover:bg-purple-l/40"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <BookOpen className="size-4 shrink-0 text-purple-solid" aria-hidden />
                      <span className="truncate">
                        {role === "TEACHER"
                          ? "Gestionar mis cursos y entregas"
                          : counts?.courses
                            ? `Mis cursos (${counts.courses})`
                            : "Entrar a mis cursos"}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
                {role !== "TEACHER" && (
                  <li>
                    <Link
                      href="/aula/tareas"
                      className="flex items-center justify-between gap-3 rounded-control border border-line bg-bg-2/70 px-3.5 py-2.5 text-sm font-semibold text-navy no-underline transition-colors hover:border-purple-solid hover:bg-purple-l/40"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <ClipboardCheck className="size-4 shrink-0 text-purple-solid" aria-hidden />
                        <span className="truncate">
                          {role === "GUARDIAN" && studentFirstName
                            ? `Tareas de ${studentFirstName}`
                            : "¿Qué tareas tengo?"}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                )}
              </ul>
              <p className="rounded-control border border-purple-solid/15 bg-purple-l/25 px-3.5 py-2.5 text-xs leading-relaxed text-ink-2">
                {role === "TEACHER"
                  ? "Las tareas sincronizadas con SIGA envían automáticamente sus calificaciones a tu planilla SIEE."
                  : "Guías de estudio, enlaces seguros, entregas y avisos de clase sincronizados con tus calificaciones."}
              </p>
            </div>
          )}
        </TactileCard>
      </div>
    </section>
  );
}
