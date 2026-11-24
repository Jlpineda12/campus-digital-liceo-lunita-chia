import "server-only";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";
import { db } from "@/db";
import { courseAssignments, grades, groups, subjects, users } from "@/db/schema";
import { can } from "@/modules/core/auth/permissions";
import type { SessionUser } from "@/modules/core/auth/session";

const teacher = alias(users, "teacher");

export interface CourseContext {
  courseAssignmentId: string;
  academicYearId: string;
  groupId: string;
  groupName: string;
  gradeName: string;
  assessmentMode: "NUMERIC" | "QUALITATIVE" | "MIXED";
  directorTeacherId: string | null;
  subjectName: string;
  pillar: "S" | "T" | "H" | "E" | "A" | "M" | "I";
  teacherId: string | null;
  teacherName: string | null;
}

/** Datos de una carga académica (memorizado por petición). */
export const getCourseContext = cache(async (courseAssignmentId: string): Promise<CourseContext | null> => {
  const [row] = await db
    .select({
      courseAssignmentId: courseAssignments.id,
      academicYearId: courseAssignments.academicYearId,
      groupId: groups.id,
      groupName: groups.name,
      gradeName: grades.name,
      assessmentMode: grades.assessmentMode,
      directorTeacherId: groups.directorTeacherId,
      subjectName: subjects.name,
      pillar: subjects.stheamiPillar,
      teacherId: courseAssignments.teacherId,
      teacherFirst: teacher.firstName,
      teacherLast: teacher.lastName,
    })
    .from(courseAssignments)
    .innerJoin(groups, eq(groups.id, courseAssignments.groupId))
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
    .leftJoin(teacher, eq(teacher.id, courseAssignments.teacherId))
    .where(eq(courseAssignments.id, courseAssignmentId))
    .limit(1);
  if (!row) return null;
  const { teacherFirst, teacherLast, ...course } = row;
  return { ...course, teacherName: teacherFirst ? `${teacherFirst} ${teacherLast}` : null };
});

/**
 * Ver la planilla completa de una carga: su docente, el director(a) del grupo
 * (consolidado) y los directivos. Estudiantes y acudientes ven solo sus notas.
 */
export function canViewGradebook(actor: SessionUser, course: CourseContext): boolean {
  if (actor.role === "TEACHER") {
    return course.teacherId === actor.id || course.directorTeacherId === actor.id;
  }
  return can(actor.role, "reportCards.preview");
}

/** Editar notas: exclusivamente el docente titular de la carga (REGLAS.md §3.3). */
export function canEditGradebook(actor: SessionUser, course: CourseContext): boolean {
  return can(actor.role, "grades.edit.ownCourses") && course.teacherId === actor.id;
}
