import { ArrowRight, BookOpen, Clock, Star, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { StheamiBadge } from "@/components/ui/StheamiBadge";
import { TactileCard } from "@/components/ui/TactileCard";
import type { DirectedGroup, TeacherCourse } from "@/modules/core/academic-structure/queries";
import { SectionHeader, StatTile } from "./parts";

export function TeacherStats({
  totals,
}: {
  totals: { courses: number; groups: number; students: number; weeklyHours: number };
}) {
  const stats: Array<{ icon: LucideIcon; tone: "purple" | "sky" | "green" | "orange"; value: number; label: string }> = [
    { icon: BookOpen, tone: "purple", value: totals.courses, label: "Cargas académicas" },
    { icon: UsersRound, tone: "sky", value: totals.groups, label: "Grupos" },
    { icon: Star, tone: "green", value: totals.students, label: "Estudiantes" },
    { icon: Clock, tone: "orange", value: totals.weeklyHours, label: "Horas semanales" },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map((s, index) => (
        <li key={s.label}>
          <StatTile {...s} index={index + 1} />
        </li>
      ))}
    </ul>
  );
}

export function DirectedGroups({ groups }: { groups: DirectedGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="direccion">
      <SectionHeader id="direccion" title="Dirección de grupo" description="Accesos directos a tu grupo asignado." />
      <ul className="grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <TactileCard as="li" key={g.groupId} tone="purple" featured className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-icon bg-purple-solid text-xl font-black text-white">
                {g.groupName}
              </span>
              <div>
                <p className="text-lg font-extrabold text-navy">{g.gradeName}</p>
                <p className="text-sm font-semibold text-muted tabular">
                  {g.studentCount} de {g.capacity} estudiantes
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/siga/boletines?grupo=${g.groupId}`}
                className="inline-flex items-center gap-1 rounded-control border border-line-2 bg-white px-3 py-1.5 text-xs font-bold text-navy no-underline transition-colors hover:border-purple-solid hover:bg-purple-l/35"
              >
                Boletines <ArrowRight className="size-3.5" aria-hidden />
              </Link>
              <Link
                href={`/siga/observador?grupo=${g.groupId}`}
                className="inline-flex items-center gap-1 rounded-control border border-line-2 bg-white px-3 py-1.5 text-xs font-bold text-navy no-underline transition-colors hover:border-purple-solid hover:bg-purple-l/35"
              >
                Observador
              </Link>
            </div>
          </TactileCard>
        ))}
      </ul>
    </section>
  );
}

export function TeacherLoadTable({ load }: { load: TeacherCourse[] }) {
  return (
    <section aria-labelledby="carga">
      <SectionHeader id="carga" title="Mi carga académica" description="Asignaturas que dictas este año lectivo." />
      {load.length === 0 ? (
        <TactileCard className="text-center text-muted">No tienes cargas académicas asignadas.</TactileCard>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="tactile-table">
            <caption className="sr-only">Carga académica del docente</caption>
            <thead>
              <tr>
                <th scope="col">Grupo</th>
                <th scope="col">Asignatura</th>
                <th scope="col" className="text-right">
                  Estudiantes
                </th>
                <th scope="col" className="hidden text-right sm:table-cell">
                  h/sem
                </th>
                <th scope="col" className="text-right">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {load.map((c) => (
                <tr key={c.courseId}>
                  <td>
                    <span className="font-extrabold text-navy">{c.groupName}</span>
                    <span className="block text-xs font-bold text-muted">{c.gradeName}</span>
                  </td>
                  <td>
                    <span className="flex items-center gap-2">
                      <StheamiBadge pillar={c.pillar} size="sm" />
                      <span className="text-navy">{c.subjectName}</span>
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{c.studentCount}</td>
                  <td className="hidden text-right tabular-nums sm:table-cell">{c.weeklyHours}</td>
                  <td className="text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <Link
                        href={`/aula/${c.courseId}`}
                        className="inline-flex items-center gap-1 rounded-control border border-purple-solid/25 bg-purple-l/30 px-2.5 py-1 text-xs font-bold text-purple-solid whitespace-nowrap no-underline hover:bg-purple-l/60"
                      >
                        Órbita
                      </Link>
                      <Link
                        href={`/siga/calificaciones?curso=${c.courseId}`}
                        className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-bold whitespace-nowrap no-underline hover:bg-cloud"
                      >
                        Planilla <ArrowRight className="size-3.5" aria-hidden />
                      </Link>
                      <Link
                        href={`/siga/asistencia?curso=${c.courseId}`}
                        className="inline-flex items-center gap-1 rounded-control border border-line bg-white px-2 py-1 text-xs font-bold text-navy whitespace-nowrap no-underline hover:border-sky-solid hover:bg-cloud"
                      >
                        Asistencia
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
