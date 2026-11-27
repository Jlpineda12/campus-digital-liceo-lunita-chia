import "server-only";
import { and, count, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import {
  activities,
  admissionApplications,
  attendanceExcuses,
  courseAssignments,
  courseUnits,
  enrollments,
  observerRecords,
  quizAttempts,
  submissions,
} from "@/db/schema";
import type { LevelCode } from "@/modules/core/academic-structure/constants";
import {
  getCurrentAcademicContext,
  getGuardianChildren,
  getStudentPlacement,
} from "@/modules/core/academic-structure/queries";
import {
  getDestinations,
  getNavigation,
  type ResolvedDestination,
  type ResolvedNavItem,
} from "@/modules/core/auth/navigation";
import { resolveSelectedChildId } from "@/modules/core/auth/policies";
import type { Role } from "@/modules/core/auth/roles";
import type { SessionUser } from "@/modules/core/auth/session";
import { buildAvatarApiUrl } from "@/modules/core/profile/storage";
import { listVisibleCircularsForActor } from "@/modules/siga/agenda/queries";
import { frameStage, type Stage } from "./stage";

export interface ShellChild {
  studentId: string;
  name: string;
  detail: string | null;
}

export interface ShellAlert {
  id: string;
  navKey: string;
  title: string;
  detail: string;
  count: number;
  href: string;
  tone: "orange" | "sky" | "purple";
}

/** Datos serializables para el layout del Campus (sidebar, tabbar, buscador, alertas, hijo activo). */
export interface CampusShellData {
  user: { id: string; firstName: string; fullName: string; role: Role; initials: string; avatarUrl: string | null };
  /** Registro visual del marco (SISTEMA_DISENO.md §1), calculado en servidor. */
  stage: Stage;
  /** Solo módulos ya habilitados: la hoja de ruta interna no se muestra a usuarios. */
  navigation: ResolvedNavItem[];
  /** Navegación de 4 destinos del rol (cada módulo vive en uno solo). */
  destinations: ResolvedDestination[];
  periodLabel: string | null;
  children: ShellChild[];
  selectedChildId: string | null;
  /** Contadores en vivo por clave de navegación (ej. agenda, tasks, observer, attendance). */
  navBadges: Record<string, number>;
  /** Lista priorizada de pendientes reales para la campana y el foco de hoy. */
  alerts: ShellAlert[];
}

function initialsOf(firstName: string, lastName: string): string {
  const first = firstName.trim()[0] ?? "";
  const last = lastName.trim()[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

/**
 * Calcula las alertas accionables y contadores de navegación del actor en sesión.
 * Memorizado por petición con React `cache()` para reutilizarlo entre el shell y `/dashboard`.
 */
export const getCampusShellData = cache(async (actor: SessionUser): Promise<CampusShellData> => {
  const context = await getCurrentAcademicContext();
  const yearId = context?.year.id ?? null;

  let children: ShellChild[] = [];
  let selectedChildId: string | null = null;
  let studentLevel: LevelCode | null = null;
  let activeStudentId: string | null = null;

  if (actor.role === "GUARDIAN") {
    const linked = await getGuardianChildren(actor.id, yearId);
    children = linked.map((c) => ({
      studentId: c.studentId,
      name: c.firstName,
      detail: c.groupName ?? null,
    }));
    selectedChildId = await resolveSelectedChildId(linked.map((c) => c.studentId));
    activeStudentId = selectedChildId;
  } else if (actor.role === "STUDENT" && yearId) {
    activeStudentId = actor.id;
  }

  const placement = activeStudentId && yearId ? await getStudentPlacement(activeStudentId, yearId) : null;
  if (actor.role === "STUDENT") {
    studentLevel = placement?.levelCode ?? null;
  }

  const navBadges: Record<string, number> = {};
  const alerts: ShellAlert[] = [];

  if (yearId) {
    // 1. Circulares sin leer (excluye las publicadas por el propio actor)
    const circulars = await listVisibleCircularsForActor(actor, yearId);
    const unreadCirculars = circulars.filter((c) => !c.readAt && c.authorId !== actor.id).length;
    if (unreadCirculars > 0) {
      navBadges.agenda = unreadCirculars;
      alerts.push({
        id: "unread-circulars",
        navKey: "agenda",
        title: unreadCirculars === 1 ? "1 circular sin leer" : `${unreadCirculars} circulares sin leer`,
        detail: "Confirma lectura en Agenda y circulares",
        count: unreadCirculars,
        href: "/siga/agenda?estado=pendientes",
        tone: "sky",
      });
    }

    // 2. Pendientes según rol
    if ((actor.role === "STUDENT" || actor.role === "GUARDIAN") && placement) {
      const [groupActs, obsRow] = await Promise.all([
        db
          .select({ id: activities.id, type: activities.type })
          .from(activities)
          .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
          .innerJoin(courseAssignments, eq(courseAssignments.id, courseUnits.courseAssignmentId))
          .where(
            and(
              eq(courseAssignments.groupId, placement.groupId),
              eq(courseAssignments.academicYearId, yearId),
              eq(courseUnits.isPublished, true),
              eq(activities.isPublished, true),
            ),
          ),
        actor.role === "STUDENT"
          ? db
              .select({ total: count() })
              .from(observerRecords)
              .where(
                and(
                  eq(observerRecords.enrollmentId, placement.enrollmentId),
                  ne(observerRecords.category, "PRAISE"),
                  isNull(observerRecords.studentStatement),
                ),
              )
          : db
              .select({ total: count() })
              .from(observerRecords)
              .where(
                and(
                  eq(observerRecords.enrollmentId, placement.enrollmentId),
                  isNull(observerRecords.guardianAcknowledgedAt),
                ),
              ),
      ]);

      if (groupActs.length > 0) {
        const actIds = groupActs.map((a) => a.id);
        const [subs, quizDone] = await Promise.all([
          db
            .select({ activityId: submissions.activityId })
            .from(submissions)
            .where(and(eq(submissions.enrollmentId, placement.enrollmentId), inArray(submissions.activityId, actIds))),
          db
            .select({ activityId: quizAttempts.activityId })
            .from(quizAttempts)
            .where(
              and(
                eq(quizAttempts.enrollmentId, placement.enrollmentId),
                inArray(quizAttempts.activityId, actIds),
                sql`${quizAttempts.submittedAt} is not null`,
              ),
            ),
        ]);
        const done = new Set([...subs.map((s) => s.activityId), ...quizDone.map((q) => q.activityId)]);
        const pendingTasks = groupActs.filter((a) => !done.has(a.id)).length;
        if (pendingTasks > 0) {
          navBadges.tasks = pendingTasks;
          alerts.unshift({
            id: "pending-tasks",
            navKey: "tasks",
            title:
              pendingTasks === 1
                ? "1 tarea o cuestionario pendiente"
                : `${pendingTasks} tareas y cuestionarios pendientes`,
            detail: "Revisa fechas límite en Órbita Virtual",
            count: pendingTasks,
            href: "/aula/tareas?estado=pendientes",
            tone: "purple",
          });
        }
      }

      const pendingObs = obsRow[0]?.total ?? 0;
      if (pendingObs > 0) {
        navBadges.observer = pendingObs;
        alerts.push({
          id: "pending-observer",
          navKey: "observer",
          title:
            actor.role === "GUARDIAN"
              ? `${pendingObs} anotación${pendingObs === 1 ? "" : "es"} por firmar`
              : `${pendingObs} descargo${pendingObs === 1 ? "" : "s"} pendiente${pendingObs === 1 ? "" : "s"}`,
          detail: "Disponible en el Observador del estudiante",
          count: pendingObs,
          href: "/siga/observador",
          tone: "orange",
        });
      }
    } else if (actor.role === "TEACHER") {
      const [ungradedRow] = await db
        .select({ total: count() })
        .from(submissions)
        .innerJoin(activities, eq(activities.id, submissions.activityId))
        .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
        .innerJoin(courseAssignments, eq(courseAssignments.id, courseUnits.courseAssignmentId))
        .where(
          and(
            eq(courseAssignments.teacherId, actor.id),
            eq(courseAssignments.academicYearId, yearId),
            isNull(submissions.score),
          ),
        );
      const ungraded = ungradedRow?.total ?? 0;
      if (ungraded > 0) {
        navBadges.courses = ungraded;
        alerts.unshift({
          id: "ungraded-subs",
          navKey: "courses",
          title: ungraded === 1 ? "1 entrega por calificar" : `${ungraded} entregas por calificar`,
          detail: "Califica en Órbita Virtual y sincroniza con SIGA",
          count: ungraded,
          href: "/aula",
          tone: "purple",
        });
      }
    } else if (actor.role === "ADMIN" || actor.role === "COORDINATOR") {
      const [pendingObsRow, pendingExcRow, pendingAdmRow] = await Promise.all([
        db
          .select({ total: count() })
          .from(observerRecords)
          .innerJoin(enrollments, eq(enrollments.id, observerRecords.enrollmentId))
          .where(and(eq(enrollments.academicYearId, yearId), isNull(observerRecords.guardianAcknowledgedAt))),
        db
          .select({ total: count() })
          .from(attendanceExcuses)
          .innerJoin(enrollments, eq(enrollments.id, attendanceExcuses.enrollmentId))
          .where(and(eq(enrollments.academicYearId, yearId), eq(attendanceExcuses.status, "PENDING"))),
        db
          .select({ total: count() })
          .from(admissionApplications)
          .where(
            inArray(admissionApplications.status, [
              "SUBMITTED",
              "DOCS_REVIEW",
              "ACADEMIC_APPROVED",
              "PAYMENT_REVIEW",
            ]),
          ),
      ]);
      const pendingExc = pendingExcRow[0]?.total ?? 0;
      const pendingObs = pendingObsRow[0]?.total ?? 0;
      const pendingAdm = pendingAdmRow[0]?.total ?? 0;
      if (pendingAdm > 0) {
        navBadges.enrollment = pendingAdm;
        alerts.unshift({
          id: "pending-admissions",
          navKey: "enrollment",
          title:
            pendingAdm === 1
              ? "1 solicitud de matrícula en revisión"
              : `${pendingAdm} solicitudes de matrícula en revisión`,
          detail: "Revisa documentos y formaliza en Matrículas 2027",
          count: pendingAdm,
          href: "/admin/matriculas",
          tone: "purple",
        });
      }
      if (pendingExc > 0) {
        navBadges.attendance = pendingExc;
        alerts.unshift({
          id: "pending-excuses",
          navKey: "attendance",
          title: pendingExc === 1 ? "1 excusa por revisar" : `${pendingExc} excusas por revisar`,
          detail: "Bandeja de asistencia y excusas médicas",
          count: pendingExc,
          href: "/siga/asistencia?estado=PENDING",
          tone: "orange",
        });
      }
      if (pendingObs > 0) {
        navBadges.observer = pendingObs;
        alerts.push({
          id: "staff-observer",
          navKey: "observer",
          title: `${pendingObs} anotaciones sin firma de acudiente`,
          detail: "Seguimiento en Observador y convivencia",
          count: pendingObs,
          href: "/siga/observador",
          tone: "orange",
        });
      }
    }
  }

  const navigation = getNavigation(actor.role).filter((item) => item.available);
  return {
    user: {
      id: actor.id,
      firstName: actor.firstName,
      fullName: actor.fullName,
      role: actor.role,
      initials: initialsOf(actor.firstName, actor.lastName),
      avatarUrl: buildAvatarApiUrl(actor.id, actor.avatarUrl),
    },
    stage: frameStage(actor.role, studentLevel),
    navigation,
    destinations: getDestinations(actor.role, navigation),
    periodLabel: context?.currentPeriod
      ? `${context.currentPeriod.name} · ${context.year.year}`
      : (context?.year.name ?? null),
    children,
    selectedChildId,
    navBadges,
    alerts,
  };
});
