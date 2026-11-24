import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  circularReads,
  circulars,
  courseAssignments,
  enrollments,
  grades,
  groups,
  guardianLinks,
  levels,
  users,
} from "@/db/schema";
import type { SessionUser } from "@/modules/core/auth/session";
import {
  canPublishInstitutional,
  CIRCULAR_SCOPE_LABELS,
  matchesCircularAudience,
  type CircularScope,
  type ViewerAudience,
} from "./meta";

export interface CircularItem {
  id: string;
  title: string;
  body: string;
  targetScope: CircularScope;
  targetLabel: string;
  authorId: string | null;
  authorName: string;
  publishedAt: Date;
  readAt: Date | null;
  readCount: number;
  isAuthor: boolean;
  canDelete: boolean;
}

export interface AudienceOptions {
  allowInstitutional: boolean;
  levels: Array<{ id: string; name: string }>;
  grades: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string; gradeName: string }>;
}

/** Resuelve el conjunto de niveles, grados y grupos a los que pertenece el actor. */
export async function resolveViewerAudience(
  actor: Pick<SessionUser, "id" | "role">,
  academicYearId: string,
): Promise<ViewerAudience> {
  const levelIds = new Set<string>();
  const gradeIds = new Set<string>();
  const groupIds = new Set<string>();

  if (actor.role === "ADMIN" || actor.role === "COORDINATOR") {
    return { userId: actor.id, role: actor.role, levelIds, gradeIds, groupIds };
  }

  if (actor.role === "STUDENT") {
    const rows = await db
      .select({ groupId: groups.id, gradeId: grades.id, levelId: levels.id })
      .from(enrollments)
      .innerJoin(groups, eq(groups.id, enrollments.groupId))
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .innerJoin(levels, eq(levels.id, grades.levelId))
      .where(
        and(
          eq(enrollments.studentId, actor.id),
          eq(enrollments.academicYearId, academicYearId),
          eq(enrollments.status, "ACTIVE"),
        ),
      );
    for (const r of rows) {
      groupIds.add(r.groupId);
      gradeIds.add(r.gradeId);
      levelIds.add(r.levelId);
    }
  } else if (actor.role === "GUARDIAN") {
    const rows = await db
      .select({ groupId: groups.id, gradeId: grades.id, levelId: levels.id })
      .from(guardianLinks)
      .innerJoin(enrollments, eq(enrollments.studentId, guardianLinks.studentId))
      .innerJoin(groups, eq(groups.id, enrollments.groupId))
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .innerJoin(levels, eq(levels.id, grades.levelId))
      .where(
        and(
          eq(guardianLinks.guardianId, actor.id),
          eq(enrollments.academicYearId, academicYearId),
          eq(enrollments.status, "ACTIVE"),
        ),
      );
    for (const r of rows) {
      groupIds.add(r.groupId);
      gradeIds.add(r.gradeId);
      levelIds.add(r.levelId);
    }
  } else if (actor.role === "TEACHER") {
    const [assigned, directed] = await Promise.all([
      db
        .select({ groupId: groups.id, gradeId: grades.id, levelId: levels.id })
        .from(courseAssignments)
        .innerJoin(groups, eq(groups.id, courseAssignments.groupId))
        .innerJoin(grades, eq(grades.id, groups.gradeId))
        .innerJoin(levels, eq(levels.id, grades.levelId))
        .where(
          and(
            eq(courseAssignments.teacherId, actor.id),
            eq(courseAssignments.academicYearId, academicYearId),
          ),
        ),
      db
        .select({ groupId: groups.id, gradeId: grades.id, levelId: levels.id })
        .from(groups)
        .innerJoin(grades, eq(grades.id, groups.gradeId))
        .innerJoin(levels, eq(levels.id, grades.levelId))
        .where(and(eq(groups.directorTeacherId, actor.id), eq(groups.academicYearId, academicYearId))),
    ]);
    for (const r of [...assigned, ...directed]) {
      groupIds.add(r.groupId);
      gradeIds.add(r.gradeId);
      levelIds.add(r.levelId);
    }
  }

  return { userId: actor.id, role: actor.role, levelIds, gradeIds, groupIds };
}

/** Lista circulares publicadas visibles para el usuario en sesión (máx. 60 recientes). */
export async function listVisibleCircularsForActor(
  actor: Pick<SessionUser, "id" | "role">,
  academicYearId: string,
): Promise<CircularItem[]> {
  const viewer = await resolveViewerAudience(actor, academicYearId);

  const rawRows = await db
    .select({
      id: circulars.id,
      title: circulars.title,
      body: circulars.bodySanitized,
      targetScope: circulars.targetScope,
      targetLevelId: circulars.targetLevelId,
      targetGradeId: circulars.targetGradeId,
      targetGroupId: circulars.targetGroupId,
      authorId: circulars.authorId,
      authorFirst: users.firstName,
      authorLast: users.lastName,
      publishedAt: circulars.publishedAt,
      levelName: levels.name,
      gradeName: grades.name,
      groupName: groups.name,
    })
    .from(circulars)
    .leftJoin(users, eq(users.id, circulars.authorId))
    .leftJoin(levels, eq(levels.id, circulars.targetLevelId))
    .leftJoin(grades, eq(grades.id, circulars.targetGradeId))
    .leftJoin(groups, eq(groups.id, circulars.targetGroupId))
    .where(isNotNull(circulars.publishedAt))
    .orderBy(desc(circulars.publishedAt), desc(circulars.createdAt))
    .limit(60);

  const visible = rawRows.filter((r) => matchesCircularAudience(r, viewer));
  if (visible.length === 0) return [];

  const visibleIds = visible.map((v) => v.id);
  const [myReads, counts] = await Promise.all([
    db
      .select({ circularId: circularReads.circularId, readAt: circularReads.readAt })
      .from(circularReads)
      .where(and(eq(circularReads.userId, actor.id), inArray(circularReads.circularId, visibleIds))),
    db
      .select({
        circularId: circularReads.circularId,
        total: sql<number>`count(*)::int`,
      })
      .from(circularReads)
      .where(inArray(circularReads.circularId, visibleIds))
      .groupBy(circularReads.circularId),
  ]);

  const myReadMap = new Map(myReads.map((r) => [r.circularId, r.readAt]));
  const countMap = new Map(counts.map((c) => [c.circularId, c.total]));
  const isStaff = actor.role === "ADMIN" || actor.role === "COORDINATOR";

  return visible.map((r) => {
    let targetLabel = CIRCULAR_SCOPE_LABELS[r.targetScope];
    if (r.targetScope === "LEVEL" && r.levelName) targetLabel = `Nivel ${r.levelName}`;
    else if (r.targetScope === "GRADE" && r.gradeName) targetLabel = `Grado ${r.gradeName}`;
    else if (r.targetScope === "GROUP" && r.groupName) targetLabel = `Grupo ${r.groupName}`;

    return {
      id: r.id,
      title: r.title,
      body: r.body,
      targetScope: r.targetScope,
      targetLabel,
      authorId: r.authorId,
      authorName: r.authorFirst ? `${r.authorFirst} ${r.authorLast}` : "Rectoría · Liceo Lunita",
      publishedAt: r.publishedAt!,
      readAt: myReadMap.get(r.id) ?? null,
      readCount: countMap.get(r.id) ?? 0,
      isAuthor: r.authorId !== null && r.authorId === actor.id,
      canDelete: isStaff || (r.authorId !== null && r.authorId === actor.id),
    };
  });
}

/** Opciones de destinatarios a las que el usuario tiene permiso de publicar. */
export async function listAudienceOptionsForActor(
  actor: Pick<SessionUser, "id" | "role">,
  academicYearId: string,
): Promise<AudienceOptions> {
  const allowInstitutional = canPublishInstitutional(actor.role);

  if (allowInstitutional) {
    const levelOrder = ["PREESCOLAR", "PRIMARIA", "BACHILLERATO"] as const;
    const [levelRows, gradeRows, groupRows] = await Promise.all([
      db.select({ id: levels.id, code: levels.code, name: levels.name }).from(levels),
      db.select({ id: grades.id, name: grades.name }).from(grades).orderBy(asc(grades.displayOrder)),
      db
        .select({ id: groups.id, name: groups.name, gradeName: grades.name, order: grades.displayOrder })
        .from(groups)
        .innerJoin(grades, eq(grades.id, groups.gradeId))
        .where(eq(groups.academicYearId, academicYearId))
        .orderBy(asc(grades.displayOrder), asc(groups.name)),
    ]);
    return {
      allowInstitutional: true,
      levels: levelRows
        .sort((a, b) => levelOrder.indexOf(a.code) - levelOrder.indexOf(b.code))
        .map((l) => ({ id: l.id, name: l.name })),
      grades: gradeRows,
      groups: groupRows.map((g) => ({ id: g.id, name: g.name, gradeName: g.gradeName })),
    };
  }

  if (actor.role === "TEACHER") {
    const teacherGroups = await db
      .selectDistinct({
        id: groups.id,
        name: groups.name,
        gradeName: grades.name,
        order: grades.displayOrder,
      })
      .from(groups)
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .leftJoin(
        courseAssignments,
        and(eq(courseAssignments.groupId, groups.id), eq(courseAssignments.academicYearId, academicYearId)),
      )
      .where(
        and(
          eq(groups.academicYearId, academicYearId),
          or(eq(groups.directorTeacherId, actor.id), eq(courseAssignments.teacherId, actor.id)),
        ),
      )
      .orderBy(asc(grades.displayOrder), asc(groups.name));

    return {
      allowInstitutional: false,
      levels: [],
      grades: [],
      groups: teacherGroups.map((g) => ({ id: g.id, name: g.name, gradeName: g.gradeName })),
    };
  }

  return { allowInstitutional: false, levels: [], grades: [], groups: [] };
}
