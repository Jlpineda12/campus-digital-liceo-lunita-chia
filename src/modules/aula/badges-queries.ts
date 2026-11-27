import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceLogs,
  courseAssignments,
  forumPosts,
  quizAttempts,
  resourceViews,
  submissions,
} from "@/db/schema";
import type { BadgeStats } from "./badges";

/**
 * Estadísticas del año para las insignias. Quien llama debe haber verificado
 * el acceso al estudiante (él mismo o su acudiente con `resolveSelectedChildId`).
 * Todas las consultas son conteos agregados en paralelo (sin traer filas).
 */
export async function getBadgeStats(options: {
  enrollmentId: string;
  studentId: string;
  groupId: string;
  academicYearId: string;
  superiorFrom: number;
}): Promise<BadgeStats> {
  const { enrollmentId, studentId, groupId, academicYearId, superiorFrom } = options;

  const groupCourses = db
    .select({ id: courseAssignments.id })
    .from(courseAssignments)
    .where(and(eq(courseAssignments.groupId, groupId), eq(courseAssignments.academicYearId, academicYearId)));

  const [subRows, quizRows, viewRows, forumRows, attRows] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        onTime: sql<number>`count(*) filter (where ${submissions.isLate} = false)::int`,
        superior: sql<number>`count(*) filter (where ${submissions.score} >= ${superiorFrom})::int`,
      })
      .from(submissions)
      .where(eq(submissions.enrollmentId, enrollmentId)),
    db
      .select({
        total: sql<number>`count(distinct ${quizAttempts.activityId})::int`,
        superior: sql<number>`count(distinct ${quizAttempts.activityId}) filter (where ${quizAttempts.finalScore} >= ${superiorFrom})::int`,
      })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.enrollmentId, enrollmentId), isNotNull(quizAttempts.submittedAt))),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(resourceViews)
      .where(eq(resourceViews.enrollmentId, enrollmentId)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(forumPosts)
      .where(and(eq(forumPosts.authorId, studentId), inArray(forumPosts.courseAssignmentId, groupCourses))),
    db
      .select({
        total: sql<number>`count(*)::int`,
        present: sql<number>`count(*) filter (where ${attendanceLogs.status} in ('PRESENT', 'LATE', 'EXCUSED'))::int`,
      })
      .from(attendanceLogs)
      .where(eq(attendanceLogs.enrollmentId, enrollmentId)),
  ]);

  return {
    submissions: subRows[0]?.total ?? 0,
    onTimeSubmissions: subRows[0]?.onTime ?? 0,
    superiorSubmissions: subRows[0]?.superior ?? 0,
    quizzesSubmitted: quizRows[0]?.total ?? 0,
    superiorQuizzes: quizRows[0]?.superior ?? 0,
    resourcesViewed: viewRows[0]?.total ?? 0,
    forumPosts: forumRows[0]?.total ?? 0,
    attendanceRecorded: attRows[0]?.total ?? 0,
    attendancePresent: attRows[0]?.present ?? 0,
  };
}
