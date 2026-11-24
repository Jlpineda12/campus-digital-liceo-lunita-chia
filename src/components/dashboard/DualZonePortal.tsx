import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { revealStyle } from "@/components/dashboard/parts";
import { PlatformLogo } from "@/components/ui/PlatformLogo";
import type { Role } from "@/modules/core/auth/roles";
import type { PlatformSpaceKey } from "@/modules/core/brand/config";
import type { Stage } from "@/modules/core/dashboard/stage";

interface ZoneShortcut {
  label: string;
  href: string;
  badge?: number;
}

interface ZonePortalCard {
  space: PlatformSpaceKey;
  eyebrow: string;
  title: string;
  legacyHint: string;
  description: string;
  statusText: string;
  statusTone: "ok" | "alert" | "info";
  primaryHref: string;
  primaryLabel: string;
  shortcuts: ZoneShortcut[];
}

/**
 * Portal Dual de Bienvenida («Dos Universos, Un Solo Campus»):
 * Separa visual y mentalmente **Órbita Virtual (Aula / ex-Moodle)** y **SIGA Lunita**
 * (o **SIGA Lunita** y **Administración y SIMAT** para directivos) desde la entrada,
 * con sus íconos 3D propios, indicadores en vivo y accesos directos sin duplicar menús.
 */
export function DualZonePortal({
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

  const isStaff = role === "ADMIN" || role === "COORDINATOR";

  const portals: [ZonePortalCard, ZonePortalCard] = isStaff
    ? [
        {
          space: "siga",
          eyebrow: "Zona 1 · Gestión Escolar",
          title: "SIGA Lunita",
          legacyHint: "Seguimiento académico y convivencia",
          description:
            "Monitorea cumplimiento docente, notas SIEE, boletines con QR, excusas de asistencia, observador y cartera.",
          statusText:
            pendingExc + pendingObs > 0
              ? `${pendingExc} excusas · ${pendingObs} firmas pendientes`
              : "Operación académica al día",
          statusTone: pendingExc + pendingObs > 0 ? "alert" : "ok",
          primaryHref: "/siga/calificaciones",
          primaryLabel: "Entrar a SIGA Lunita",
          shortcuts: [
            { label: "Calificaciones", href: "/siga/calificaciones" },
            { label: "Boletines", href: "/siga/boletines" },
            { label: "Asistencia", href: "/siga/asistencia", badge: pendingExc },
            { label: "Observador", href: "/siga/observador", badge: pendingObs },
            { label: "Agenda", href: "/siga/agenda", badge: unreadCirculars },
            ...(role === "ADMIN" ? [{ label: "Cartera", href: "/siga/cartera" }] : []),
          ],
        },
        {
          space: "admin",
          eyebrow: "Zona 2 · Gobierno y Transición",
          title: role === "ADMIN" ? "Administración y SIMAT" : "Gestión Académica",
          legacyHint: role === "ADMIN" ? "Matrículas 2027 · Migración · Usuarios" : "Estructura y Admisiones 2027",
          description:
            role === "ADMIN"
              ? "Administra el año lectivo, admisiones 2027, usuarios, migración ETL desde SIGA/Moodle y exportación SIMAT."
              : "Configura asignaturas, cargas académicas, ventanas de periodos y aprueba aspirantes en Matrículas 2027.",
          statusText: role === "ADMIN" ? "Fases 1 a 5 activas · SIMAT listo" : "Estructura y admisiones activas",
          statusTone: "info",
          primaryHref: role === "ADMIN" ? "/admin/matriculas" : "/admin/estructura",
          primaryLabel: "Entrar a Gestión",
          shortcuts: [
            { label: "Estructura", href: "/admin/estructura" },
            { label: "Matrículas 2027", href: "/admin/matriculas" },
            ...(role === "ADMIN"
              ? [
                  { label: "Usuarios y roles", href: "/admin/usuarios" },
                  { label: "Migración y SIMAT", href: "/admin/migracion" },
                ]
              : []),
          ],
        },
      ]
    : [
        {
          space: "aula",
          eyebrow: "Zona 1 · Aula Virtual Interactiva",
          title: "Órbita Virtual",
          legacyHint: isPrimaria ? "Tus materias, retos y tareas" : "Cursos, guías PDF, tareas y quices",
          description:
            role === "TEACHER"
              ? "Personaliza tus cursos con banners y SVGs, sube guías PDF y crea tareas o cuestionarios conectados al SIGA."
              : role === "GUARDIAN"
                ? `Acompaña los cursos, materiales de estudio y entregas de ${studentFirstName ?? "tu hijo(a)"} en un solo lugar.`
                : isPrimaria
                  ? "Entra a tus salones virtuales, descarga guías, sube tus tareas y resuelve retos interactivos."
                  : "Accede a tus asignaturas, recursos PDF, entregas en línea y cuestionarios con nota instantánea.",
          statusText:
            role === "TEACHER"
              ? ungradedSubs > 0
                ? `${ungradedSubs} ${ungradedSubs === 1 ? "entrega por calificar" : "entregas por calificar"}`
                : `${coursesCount} cursos listos para clase`
              : pendingTasks > 0
                ? `${pendingTasks} ${pendingTasks === 1 ? "tarea pendiente" : "tareas pendientes"}`
                : `${coursesCount} cursos · Todo al día`,
          statusTone: (role === "TEACHER" ? ungradedSubs : pendingTasks) > 0 ? "alert" : "ok",
          primaryHref: "/aula",
          primaryLabel: "Entrar a Órbita Virtual",
          shortcuts:
            role === "TEACHER"
              ? [{ label: `Mis cursos (${coursesCount})`, href: "/aula", badge: ungradedSubs }]
              : [
                  { label: `Mis cursos (${coursesCount})`, href: "/aula" },
                  { label: "¿Qué tareas tengo?", href: "/aula/tareas", badge: pendingTasks },
                ],
        },
        {
          space: "siga",
          eyebrow: "Zona 2 · Gestión Escolar",
          title: "SIGA Lunita",
          legacyHint: "Notas SIEE · Boletines · Asistencia · Convivencia",
          description:
            role === "TEACHER"
              ? "Diligencia la planilla SIEE, redacta logros STHEAMI, toma asistencia rápida y registra el observador."
              : role === "GUARDIAN"
                ? "Consulta calificaciones, boletines PDF con QR, excusas de asistencia, observador, circulares y cartera Feb–Nov."
                : "Revisa tus notas por periodo, descarga boletines oficiales, revisa tu asistencia y lee circulares.",
          statusText:
            unreadCirculars + pendingObs > 0
              ? `${unreadCirculars > 0 ? `${unreadCirculars} circular(es)` : ""}${
                  unreadCirculars > 0 && pendingObs > 0 ? " · " : ""
                }${pendingObs > 0 ? `${pendingObs} firma(s) observador` : ""}`
              : "Sin novedades pendientes",
          statusTone: unreadCirculars + pendingObs > 0 ? "alert" : "ok",
          primaryHref: role === "TEACHER" ? "/siga/calificaciones" : "/siga/boletines",
          primaryLabel: "Entrar a SIGA Lunita",
          shortcuts: [
            { label: "Calificaciones", href: "/siga/calificaciones" },
            { label: "Boletines", href: "/siga/boletines" },
            { label: "Asistencia", href: "/siga/asistencia" },
            { label: "Observador", href: "/siga/observador", badge: pendingObs },
            { label: "Agenda", href: "/siga/agenda", badge: unreadCirculars },
            ...(role === "GUARDIAN" ? [{ label: "Cartera", href: "/siga/cartera" }] : []),
          ],
        },
      ];

  return (
    <section aria-labelledby="espacios-campus" className="grid gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="espacios-campus" className="text-step-2">
            {isPrimaria ? "¿A qué espacio entramos hoy?" : "Elige tu espacio de trabajo"}
          </h2>
          <p className="mt-0.5 text-xs font-medium text-muted">
            Dos entornos separados visualmente, conectados con la misma sesión y tus notas en tiempo real.
          </p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-pill border border-line bg-white px-3 py-1 text-[0.7rem] font-bold text-muted sm:inline-flex">
          <Sparkles className="size-3.5 text-cobalt" aria-hidden />
          Cambia entre espacios en 1 clic desde la barra lateral
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {portals.map((portal, index) => {
          const isAula = portal.space === "aula";
          const isAdmin = portal.space === "admin";
          const headerBg = isAula
            ? "linear-gradient(125deg, #251361 0%, #4C24A8 60%, #6D28D9 100%)"
            : isAdmin
              ? "linear-gradient(125deg, #0B123B 0%, #1F2670 60%, #303296 100%)"
              : "linear-gradient(125deg, #0F1747 0%, #242A82 55%, #0369A1 100%)";

          return (
            <article
              key={portal.space}
              style={revealStyle(index + 1)}
              className="card reveal group relative flex flex-col overflow-hidden border-line bg-white p-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-cobalt/35 hover:shadow-md"
            >
              {/* Cabecera distintiva con identidad propia del espacio */}
              <div
                className="relative overflow-hidden px-5 py-5 text-white"
                style={{ background: headerBg }}
              >
                {/* Patrón SVG sutil temático (órbitas para Aula, geometría Muisca para SIGA) */}
                {isAula ? (
                  <svg
                    viewBox="0 0 400 120"
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-22"
                    preserveAspectRatio="xMidYMid slice"
                    aria-hidden="true"
                  >
                    <circle cx="350" cy="25" r="78" fill="none" stroke="#FFC800" strokeWidth="1.2" strokeDasharray="4 6" />
                    <circle cx="350" cy="25" r="46" fill="none" stroke="#FFFFFF" strokeWidth="1" />
                    <path d="M278 24 L280 29 L285 31 L280 33 L278 38 L276 33 L271 31 L276 29 Z" fill="#FFC800" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 400 120"
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-18"
                    preserveAspectRatio="xMidYMid slice"
                    aria-hidden="true"
                  >
                    <path d="M250 105 L280 75 L310 105 L340 75 L370 105 L400 75" fill="none" stroke="#FFC800" strokeWidth="2" />
                    <polygon points="335,16 365,46 335,76 305,46" fill="none" stroke="#FFFFFF" strokeWidth="1.3" />
                  </svg>
                )}

                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <PlatformLogo
                      space={portal.space}
                      size={56}
                      className="shrink-0 drop-shadow-md transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="min-w-0">
                      <p className="text-[0.68rem] font-extrabold tracking-widest text-yellow uppercase">
                        {portal.eyebrow}
                      </p>
                      <h3 className="mt-0.5 text-xl font-black tracking-tight text-white">
                        {portal.title}
                      </h3>
                      <p className="text-xs font-medium text-white/90">{portal.legacyHint}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cuerpo con estado en vivo + accesos directos limpios */}
              <div className="flex flex-1 flex-col gap-4 p-5">
                <p className="text-xs leading-relaxed text-ink-2">{portal.description}</p>

                <div className="flex flex-wrap items-center gap-1.5">
                  {portal.shortcuts.map((sc) => (
                    <Link
                      key={sc.href}
                      href={sc.href}
                      className="inline-flex items-center gap-1.5 rounded-pill border border-line-2 bg-bg-2/70 px-3 py-1 text-xs font-bold text-navy no-underline transition-colors hover:border-cobalt/40 hover:bg-cloud hover:text-cobalt"
                    >
                      <span>{sc.label}</span>
                      {sc.badge !== undefined && sc.badge > 0 && (
                        <span className="rounded-pill bg-orange-solid px-1.5 py-0.2 text-[0.65rem] font-black text-white tabular-nums">
                          {sc.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line/80 pt-3.5">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                      portal.statusTone === "alert"
                        ? "text-orange-solid"
                        : portal.statusTone === "ok"
                          ? "text-green-solid"
                          : "text-cobalt"
                    }`}
                  >
                    {portal.statusTone === "ok" && <CheckCircle2 className="size-3.5" aria-hidden />}
                    {portal.statusText}
                  </span>

                  <Link
                    href={portal.primaryHref}
                    className={`inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-xs font-extrabold text-white no-underline shadow-xs transition-transform hover:scale-[1.02] ${
                      isAula ? "bg-purple-solid" : "bg-cobalt"
                    }`}
                  >
                    {portal.primaryLabel}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
