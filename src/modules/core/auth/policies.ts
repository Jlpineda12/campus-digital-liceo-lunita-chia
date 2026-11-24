import "server-only";
import { and, eq, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import {
  academicYears,
  courseAssignments,
  enrollments,
  groups,
  guardianLinks,
  users,
} from "@/db/schema";
import { CHILD_COOKIE } from "./cookies";
import type { SessionUser } from "./session";

/**
 * Políticas de aislamiento por rol (REGLAS.md §3.3). Toda lectura de datos de un
 * estudiante pasa por `canAccessStudent` en el servidor.
 */

export async function getLinkedStudentIds(guardianId: string): Promise<string[]> {
  const rows = await db
    .select({ studentId: guardianLinks.studentId })
    .from(guardianLinks)
    .innerJoin(users, eq(users.id, guardianLinks.studentId))
    .where(and(eq(guardianLinks.guardianId, guardianId), eq(users.isActive, true)));
  return rows.map((r) => r.studentId);
}

async function teacherTeachesStudent(teacherId: string, studentId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .innerJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .innerJoin(groups, eq(groups.id, enrollments.groupId))
    .leftJoin(
      courseAssignments,
      and(eq(courseAssignments.groupId, groups.id), eq(courseAssignments.teacherId, teacherId)),
    )
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.status, "ACTIVE"),
        eq(academicYears.isCurrent, true),
        or(eq(groups.directorTeacherId, teacherId), eq(courseAssignments.teacherId, teacherId)),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function canAccessStudent(actor: SessionUser, studentId: string): Promise<boolean> {
  switch (actor.role) {
    case "STUDENT":
      return actor.id === studentId;
    case "GUARDIAN":
      return (await getLinkedStudentIds(actor.id)).includes(studentId);
    case "TEACHER":
      return teacherTeachesStudent(actor.id, studentId);
    case "COORDINATOR":
    case "ADMIN": {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")))
        .limit(1);
      return Boolean(row);
    }
  }
}

/**
 * Hijo activo del acudiente: el de la cookie si sigue vinculado; si no, el primero.
 * La cookie es solo una preferencia, nunca una autorización.
 */
export async function resolveSelectedChildId(linkedStudentIds: string[]): Promise<string | null> {
  const preferred = (await cookies()).get(CHILD_COOKIE)?.value;
  if (preferred && linkedStudentIds.includes(preferred)) return preferred;
  return linkedStudentIds[0] ?? null;
}
