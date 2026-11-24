import { and, count, eq } from "drizzle-orm";
import type { Database } from "../client";
import {
  academicYears,
  attendanceExcuses,
  attendanceLogs,
  courseAssignments,
  enrollments,
  users,
} from "../schema";
import { COORDINATOR, DEMO_FAMILY, SPECIALISTS, TITULARS } from "./data";

function todayInBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

function offsetIsoDate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

/**
 * Registros y excusas de demostración (idempotente si ya existen filas).
 */
export async function seedDemoAttendance(db: Database): Promise<{ logs: number; excuses: number }> {
  const [existingLogs] = await db.select({ total: count() }).from(attendanceLogs);
  if ((existingLogs?.total ?? 0) > 0) return { logs: 0, excuses: 0 };

  const [year] = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1);
  if (!year) return { logs: 0, excuses: 0 };

  const [allUsers, activeEnrollments, allCourses] = await Promise.all([
    db.select({ id: users.id, documentNumber: users.documentNumber }).from(users),
    db
      .select({ id: enrollments.id, studentId: enrollments.studentId, groupId: enrollments.groupId })
      .from(enrollments)
      .where(and(eq(enrollments.academicYearId, year.id), eq(enrollments.status, "ACTIVE"))),
    db
      .select({
        id: courseAssignments.id,
        groupId: courseAssignments.groupId,
        teacherId: courseAssignments.teacherId,
      })
      .from(courseAssignments)
      .where(eq(courseAssignments.academicYearId, year.id)),
  ]);

  const userByDoc = new Map(allUsers.map((u) => [u.documentNumber, u.id]));
  const enrollmentByStudent = new Map(activeEnrollments.map((e) => [e.studentId, e]));

  const sofiaId = userByDoc.get(DEMO_FAMILY.children[0].person.documentNumber);
  const tomasId = userByDoc.get(DEMO_FAMILY.children[1].person.documentNumber);
  const lauraId = userByDoc.get(DEMO_FAMILY.guardian.documentNumber);
  const andresId = userByDoc.get(SPECIALISTS.MATEMATICAS.documentNumber);
  const sandraId = userByDoc.get(TITULARS["3A"]!.documentNumber);
  const patriciaId = userByDoc.get(COORDINATOR.documentNumber);

  const sofiaEnr = sofiaId ? enrollmentByStudent.get(sofiaId) : undefined;
  const tomasEnr = tomasId ? enrollmentByStudent.get(tomasId) : undefined;

  const today = todayInBogota();
  const d1 = offsetIsoDate(today, -1);
  const d2 = offsetIsoDate(today, -2);
  const d4 = offsetIsoDate(today, -4);

  const logRows: Array<typeof attendanceLogs.$inferInsert> = [];
  const excuseRows: Array<typeof attendanceExcuses.$inferInsert> = [];

  if (sofiaEnr) {
    const math7A = allCourses.find((c) => c.groupId === sofiaEnr.groupId && c.teacherId === andresId);
    if (math7A) {
      logRows.push(
        { enrollmentId: sofiaEnr.id, courseAssignmentId: math7A.id, date: d4, status: "PRESENT", recordedBy: andresId },
        { enrollmentId: sofiaEnr.id, courseAssignmentId: math7A.id, date: d2, status: "LATE", notes: "Llegó 10 min tarde al primer bloque.", recordedBy: andresId },
        { enrollmentId: sofiaEnr.id, courseAssignmentId: math7A.id, date: d1, status: "ABSENT", recordedBy: andresId },
      );
    }
    excuseRows.push({
      enrollmentId: sofiaEnr.id,
      guardianId: lauraId ?? null,
      fromDate: d1,
      toDate: d1,
      reasonType: "MEDICA",
      description: "Sofía tuvo cita de control odontológico en la mañana; adjuntaremos soporte impreso en Secretaría.",
      status: "PENDING",
    });
  }

  if (tomasEnr) {
    const course3A = allCourses.find((c) => c.groupId === tomasEnr.groupId && c.teacherId === sandraId);
    if (course3A) {
      logRows.push(
        { enrollmentId: tomasEnr.id, courseAssignmentId: course3A.id, date: d4, status: "EXCUSED", notes: "Excusa médica aprobada.", recordedBy: sandraId },
        { enrollmentId: tomasEnr.id, courseAssignmentId: course3A.id, date: d2, status: "PRESENT", recordedBy: sandraId },
        { enrollmentId: tomasEnr.id, courseAssignmentId: course3A.id, date: d1, status: "PRESENT", recordedBy: sandraId },
      );
    }
    excuseRows.push({
      enrollmentId: tomasEnr.id,
      guardianId: lauraId ?? null,
      fromDate: d4,
      toDate: d4,
      reasonType: "MEDICA",
      description: "Control pediátrico anual en Chía.",
      status: "APPROVED",
      reviewedBy: patriciaId ?? null,
      reviewedAt: new Date(),
      reviewNotes: "Aprobada y notificada a la docente titular.",
    });
  }

  await db.transaction(async (tx) => {
    if (logRows.length > 0) await tx.insert(attendanceLogs).values(logRows);
    if (excuseRows.length > 0) await tx.insert(attendanceExcuses).values(excuseRows);
  });

  return { logs: logRows.length, excuses: excuseRows.length };
}
