"use client";

import { ArrowRight, BookOpen, ChevronRight, Star, X, ClipboardCheck, Layers, Palette, Search, Table2, UserCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { StheamiBadge } from "@/components/ui/StheamiBadge";
import { parseList, useLocalPreference } from "@/components/ui/useLocalPreference";
import type { AulaCourseCard } from "@/modules/aula/queries";
import { resolveBannerGradient } from "@/modules/aula/themes";
import { PILLAR_META, type StheamiPillar } from "@/modules/core/academic-structure/stheami";
import { StheamiIcon } from "@/components/brand/StheamiIcon";

export interface CourseCompliance {
  gradesPercent: number;
  logrosPercent: number;
}

type GroupBy = "group" | "subject" | "teacher";
type Filter = "all" | "toGrade" | "empty" | "plain" | "gradesPending";

const GROUP_LABELS: Record<GroupBy, string> = { group: "Grupo", subject: "Asignatura", teacher: "Docente" };

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Directorio de cursos para quien tiene MUCHOS (docente o directivo):
 * buscar, agrupar y filtrar por lo que falta, en filas compactas en vez de
 * tarjetas grandes. En modo `staff` muestra si el docente cargó contenido,
 * personalizó el curso y subió notas/logros del periodo.
 */
export function CourseDirectory({
  courses: allCourses,
  mode,
  compliance = {},
  periodName,
  pillar = null,
}: {
  courses: AulaCourseCard[];
  mode: "teacher" | "staff";
  compliance?: Record<string, CourseCompliance>;
  periodName?: string;
  /** Pilar STHEAMI elegido en los bloques del Inicio (`?pilar=X`). */
  pillar?: StheamiPillar | null;
}) {
  const pathname = usePathname();
  const pillarMeta = pillar ? PILLAR_META[pillar] : null;
  const courses = pillar ? allCourses.filter((c) => c.pillar === pillar) : allCourses;
  const isStaff = mode === "staff";
  const [query, setQuery] = useState("");
  // La vista elegida (agrupación y filtro) y los cursos fijados se recuerdan en este navegador.
  const [savedGroup, setGroupBy] = useLocalPreference(`campus-lunita:cursos:${mode}:agrupar`);
  const [savedFilter, setFilter] = useLocalPreference(`campus-lunita:cursos:${mode}:filtro`);
  const [rawPins, setPins] = useLocalPreference("campus-lunita:cursos:fijados");
  const groupOptions: GroupBy[] = isStaff ? ["teacher", "group", "subject"] : ["group", "subject"];
  const groupBy: GroupBy = groupOptions.find((g) => g === savedGroup) ?? (isStaff ? "teacher" : "group");
  const pins = parseList(rawPins, (v): v is string => typeof v === "string");
  const togglePin = (id: string) =>
    setPins(JSON.stringify(pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id].slice(-12)));

  const gradesPending = (c: AulaCourseCard) => {
    const k = compliance[c.courseAssignmentId];
    return k ? k.gradesPercent < 100 || k.logrosPercent < 100 : false;
  };

  const filters: Array<{ key: Filter; label: string; test: (c: AulaCourseCard) => boolean }> = [
    { key: "all", label: "Todos", test: () => true },
    ...(isStaff
      ? [
          { key: "gradesPending" as const, label: "Notas o logros incompletos", test: gradesPending },
          { key: "empty" as const, label: "Sin contenido", test: (c: AulaCourseCard) => c.unitCount === 0 },
          { key: "plain" as const, label: "Sin personalizar", test: (c: AulaCourseCard) => !c.isCustomized },
        ]
      : [
          { key: "toGrade" as const, label: "Por calificar", test: (c: AulaCourseCard) => c.pendingCount > 0 },
          { key: "empty" as const, label: "Sin contenido", test: (c: AulaCourseCard) => c.unitCount === 0 },
        ]),
  ];
  const activeFilter = filters.find((f) => f.key === savedFilter) ?? filters[0]!;
  const filter = activeFilter.key;

  const sections = (() => {
    const q = normalize(query.trim());
    const visible = courses.filter(
      (c) =>
        activeFilter.test(c) &&
        (!q || normalize(`${c.subjectName} ${c.groupName} ${c.gradeName} ${c.teacherName ?? ""}`).includes(q)),
    );
    const map = new Map<string, { title: string; order: number | string; items: AulaCourseCard[] }>();
    for (const c of visible) {
      const key =
        groupBy === "group" ? c.groupName : groupBy === "subject" ? c.subjectName : (c.teacherName ?? "Sin docente");
      const title = groupBy === "group" ? `${c.groupName} · ${c.gradeName}` : key;
      const order = groupBy === "group" ? c.gradeOrder * 1000 + c.groupName.charCodeAt(c.groupName.length - 1) : key;
      const entry = map.get(key) ?? { title, order, items: [] };
      entry.items.push(c);
      map.set(key, entry);
    }
    const sorted = [...map.values()].sort((a, b) =>
      typeof a.order === "number" && typeof b.order === "number"
        ? a.order - b.order
        : String(a.order).localeCompare(String(b.order), "es"),
    );
    const pinned = visible.filter((c) => pins.includes(c.courseAssignmentId));
    return pinned.length > 0 ? [{ title: "★ Fijados", order: -1, items: pinned }, ...sorted] : sorted;
  })();

  // Con muchos grupos, se abren solo al tocarlos (salvo los fijados): el resumen basta para decidir.
  const collapseSections = sections.length > 6;
  const sectionSummary = (items: AulaCourseCard[]) => {
    const out: Array<{ text: string; tone: "orange" | "yellow" | "green" }> = [];
    const empty = items.filter((c) => c.unitCount === 0).length;
    if (isStaff) {
      const pendingGrades = items.filter(gradesPending).length;
      if (pendingGrades > 0) out.push({ text: `${pendingGrades} notas/logros`, tone: "orange" });
    } else {
      const toGrade = items.reduce((n, c) => n + c.pendingCount, 0);
      if (toGrade > 0) out.push({ text: `${toGrade} por calificar`, tone: "yellow" });
    }
    if (empty > 0) out.push({ text: `${empty} sin contenido`, tone: "orange" });
    if (out.length === 0) out.push({ text: "Al día", tone: "green" });
    return out;
  };

  const shown = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="grid gap-4">
      {/* Barra de herramientas */}
      <div className="card grid gap-3 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[14rem] flex-1">
            <span className="sr-only">Buscar curso</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isStaff ? "Buscar asignatura, grupo o docente…" : "Buscar asignatura o grupo…"}
              className="input min-h-10 pl-9 text-sm"
            />
          </label>
          <div role="group" aria-label="Agrupar por" className="inline-flex rounded-control border border-line bg-bg-2 p-1">
            {groupOptions.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={groupBy === g}
                onClick={() => setGroupBy(g)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  groupBy === g ? "bg-white text-navy shadow-2xs" : "text-muted hover:text-navy"
                }`}
              >
                {GROUP_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
        <div role="group" aria-label="Filtrar cursos" className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const count = courses.filter(f.test).length;
            const active = f.key === filter;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-bold transition-colors ${
                  active ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:bg-cloud"
                }`}
              >
                {f.label}
                <span className={`tabular ${active ? "text-yellow" : "text-muted"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {pillarMeta && (
        <div className={`flex flex-wrap items-center justify-between gap-3 t-${pillarMeta.tone}`}>
          <p className="flex items-center gap-2 text-base font-extrabold text-navy">
            <StheamiIcon pillar={pillarMeta.letter} size={28} />
            {pillarMeta.name}
            <span className="text-xs font-bold text-muted">
              {courses.length} de {allCourses.length} cursos
            </span>
          </p>
          <Link
            href={pathname}
            className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-white px-3.5 py-1.5 text-xs font-bold text-navy no-underline hover:bg-cloud"
          >
            <X className="size-3.5" aria-hidden /> Quitar filtro de pilar
          </Link>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {shown} cursos visibles
      </p>

      {sections.length === 0 ? (
        <p className="card bg-white py-10 text-center text-sm text-muted">
          {filter === "all" ? "No hay cursos que coincidan con la búsqueda." : "¡Nada pendiente en este filtro!"}
        </p>
      ) : (
        sections.map((section) => (
          <details
            key={`${groupBy}-${filter}-${section.title}`}
            open={collapseSections && section.order !== -1 ? undefined : true}
            className="card group bg-white p-0"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-3 hover:bg-cloud/40">
              <h2 className="flex items-center gap-2 text-base font-extrabold text-navy">
                <ChevronRight className="size-4 text-muted transition-transform group-open:rotate-90" aria-hidden />
                {section.title}
              </h2>
              <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted tabular">
                {sectionSummary(section.items).map((t) => (
                  <Tag key={t.text} tone={t.tone}>
                    {t.text}
                  </Tag>
                ))}
                <span>
                  {section.items.length} {section.items.length === 1 ? "curso" : "cursos"}
                </span>
              </span>
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {section.items.map((c) => {
                const k = compliance[c.courseAssignmentId];
                const primary = groupBy === "subject" ? `${c.groupName} · ${c.gradeName}` : c.subjectName;
                const secondary = isStaff
                  ? groupBy === "teacher"
                    ? `${c.groupName} · ${c.gradeName}`
                    : (c.teacherName ?? "Sin docente")
                  : null;
                return (
                  <li key={c.courseAssignmentId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                    <button
                      type="button"
                      onClick={() => togglePin(c.courseAssignmentId)}
                      aria-pressed={pins.includes(c.courseAssignmentId)}
                      aria-label={`${pins.includes(c.courseAssignmentId) ? "Quitar de fijados" : "Fijar"}: ${c.subjectName} ${c.groupName}`}
                      title={pins.includes(c.courseAssignmentId) ? "Quitar de fijados" : "Fijar arriba"}
                      className="grid size-7 shrink-0 place-items-center rounded-md text-muted/60 hover:bg-cloud hover:text-yellow-d aria-pressed:text-yellow-d"
                    >
                      <Star className="size-4" fill={pins.includes(c.courseAssignmentId) ? "currentColor" : "none"} aria-hidden />
                    </button>
                    <span
                      className="h-9 w-1.5 shrink-0 rounded-full"
                      style={{ background: resolveBannerGradient(c.theme) }}
                      aria-hidden
                    />
                    <Link href={`/aula/${c.courseAssignmentId}`} className="min-w-0 flex-1 no-underline">
                      <span className="flex items-center gap-2">
                        <StheamiBadge pillar={c.pillar} size="sm" />
                        <span className="truncate font-bold text-navy hover:underline">{primary}</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        {secondary && <span>{secondary}</span>}
                        <span className="inline-flex items-center gap-1">
                          <Layers className="size-3" aria-hidden /> {c.unitCount} unid.
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="size-3" aria-hidden /> {c.activityCount} activ.
                        </span>
                      </span>
                    </Link>

                    <span className="flex flex-wrap items-center gap-1.5">
                      {c.unitCount === 0 && <Tag tone="orange">Sin contenido</Tag>}
                      {isStaff && (
                        <Tag tone={c.isCustomized ? "green" : "muted"}>
                          <Palette className="size-3" aria-hidden /> {c.isCustomized ? "Personalizado" : "Sin personalizar"}
                        </Tag>
                      )}
                      {isStaff && k && (
                        <Tag tone={k.gradesPercent >= 100 && k.logrosPercent >= 100 ? "green" : "orange"}>
                          <UserCheck className="size-3" aria-hidden /> Notas {k.gradesPercent}% · Logros {k.logrosPercent}%
                        </Tag>
                      )}
                      {!isStaff && c.pendingCount > 0 && (
                        <Tag tone="yellow">
                          <ClipboardCheck className="size-3" aria-hidden /> {c.pendingCount} por calificar
                        </Tag>
                      )}
                    </span>

                    {!isStaff && (
                      <span className="flex items-center gap-1">
                        <Link
                          href={`/siga/calificaciones?curso=${c.courseAssignmentId}`}
                          className="inline-flex items-center gap-1 rounded-control border border-line px-2.5 py-1 text-xs font-bold text-navy no-underline hover:bg-cloud"
                        >
                          <Table2 className="size-3.5" aria-hidden /> Planilla
                        </Link>
                        <Link
                          href={`/aula/${c.courseAssignmentId}`}
                          aria-label={`Abrir ${c.subjectName} ${c.groupName}`}
                          className="grid size-8 place-items-center rounded-control text-muted hover:bg-cloud hover:text-navy"
                        >
                          <ArrowRight className="size-4" aria-hidden />
                        </Link>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        ))
      )}
      {isStaff && periodName && (
        <p className="text-xs text-muted">Notas y logros corresponden a {periodName}.</p>
      )}
    </div>
  );
}

function Tag({ tone, children }: { tone: "orange" | "green" | "muted" | "yellow"; children: ReactNode }) {
  const cls = {
    orange: "bg-orange-l text-orange-solid",
    green: "bg-green-l text-green-solid",
    muted: "bg-bg-2 text-muted",
    yellow: "bg-yellow text-navy",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[0.7rem] font-extrabold ${cls}`}>
      {children}
    </span>
  );
}
