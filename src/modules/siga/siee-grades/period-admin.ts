import "server-only";
import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  academicPeriods,
  courseAssignments,
  groups,
  periodUnlockWindows,
  subjects,
  users,
} from "@/db/schema";

const opener = alias(users, "opener");

export interface AdminPeriod {
  id: string;
  number: number;
  name: string;
  gradesLocked: boolean;
  startDate: string;
  endDate: string;
  weightPercent: number;
  windows: Array<{
    id: string;
    reason: string;
    expiresAt: Date;
    scope: string;
    openedBy: string | null;
  }>;
}

/** Periodos del año con sus ventanas de reapertura vigentes (para /admin/estructura). */
export async function getPeriodsForAdmin(academicYearId: string): Promise<AdminPeriod[]> {
  const [periods, windows] = await Promise.all([
    db
      .select({
        id: academicPeriods.id,
        number: academicPeriods.number,
        name: academicPeriods.name,
        gradesLocked: academicPeriods.gradesLocked,
        startDate: academicPeriods.startDate,
        endDate: academicPeriods.endDate,
        weightPercent: academicPeriods.weightPercent,
      })
      .from(academicPeriods)
      .where(eq(academicPeriods.academicYearId, academicYearId))
      .orderBy(asc(academicPeriods.number)),
    db
      .select({
        id: periodUnlockWindows.id,
        periodId: periodUnlockWindows.periodId,
        reason: periodUnlockWindows.reason,
        expiresAt: periodUnlockWindows.expiresAt,
        groupName: groups.name,
        subjectName: subjects.name,
        openerFirst: opener.firstName,
        openerLast: opener.lastName,
      })
      .from(periodUnlockWindows)
      .innerJoin(academicPeriods, eq(academicPeriods.id, periodUnlockWindows.periodId))
      .leftJoin(courseAssignments, eq(courseAssignments.id, periodUnlockWindows.courseAssignmentId))
      .leftJoin(groups, eq(groups.id, courseAssignments.groupId))
      .leftJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
      .leftJoin(opener, eq(opener.id, periodUnlockWindows.openedBy))
      .where(
        and(
          eq(academicPeriods.academicYearId, academicYearId),
          isNull(periodUnlockWindows.closedAt),
          gt(periodUnlockWindows.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(periodUnlockWindows.expiresAt)),
  ]);

  return periods.map((p) => ({
    ...p,
    windows: windows
      .filter((w) => w.periodId === p.id)
      .map((w) => ({
        id: w.id,
        reason: w.reason,
        expiresAt: w.expiresAt,
        scope: w.groupName ? `${w.subjectName} · ${w.groupName}` : "Todas las cargas",
        openedBy: w.openerFirst ? `${w.openerFirst} ${w.openerLast}` : null,
      })),
  }));
}
