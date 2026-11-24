import "server-only";
import { and, asc, count, eq, gt, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { enrollments, grades, groups, guardianLinks, sessions, users } from "@/db/schema";
import type { DocumentType, GuardianRelationship } from "@/modules/core/academic-structure/constants";
import type { Role } from "@/modules/core/auth/roles";
import { USERS_PAGE_SIZE } from "./schemas";

export interface DirectoryUserRow {
  id: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: Role;
  isActive: boolean;
  activeSessions: number;
  groupLabel: string | null;
  linkedCount: number;
  createdAt: Date;
}

export interface UsersRoleCounts {
  total: number;
  active: number;
  byRole: Record<Role, number>;
}

export interface UsersDirectoryResult {
  items: DirectoryUserRow[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  counts: UsersRoleCounts;
}

/**
 * Directorio paginado de usuarios diseñado para escalar a 1.000+ cuentas sin
 * cargar tablas completas en memoria.
 */
export async function listUsersDirectory(options: {
  academicYearId: string | null;
  query?: string;
  role?: Role;
  status?: "active" | "inactive" | "all";
  page?: number;
  pageSize?: number;
}): Promise<UsersDirectoryResult> {
  const { academicYearId, role, status = "all" } = options;
  const search = options.query?.trim() ?? "";
  const pageSize = [25, 50, 100].includes(options.pageSize ?? 0)
    ? options.pageSize!
    : USERS_PAGE_SIZE;
  const requestedPage = Math.max(1, options.page ?? 1);

  const conditions: SQL[] = [];
  if (role) conditions.push(eq(users.role, role));
  if (status === "active") conditions.push(eq(users.isActive, true));
  if (status === "inactive") conditions.push(eq(users.isActive, false));
  if (search) {
    const normalizedText = search
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[%_\\]/g, "\\$&");
    const textPattern = `%${normalizedText}%`;
    const normalizedDoc = search.replace(/[\s.-]+/g, "").replace(/[%_\\]/g, "\\$&");
    const docPattern = `%${normalizedDoc}%`;

    const searchParts: SQL[] = [
      sql`translate(lower(${users.firstName}), 'áéíóúüñ', 'aeiouun') like ${textPattern}`,
      sql`translate(lower(${users.lastName}), 'áéíóúüñ', 'aeiouun') like ${textPattern}`,
      sql`translate(lower(${users.firstName} || ' ' || ${users.lastName}), 'áéíóúüñ', 'aeiouun') like ${textPattern}`,
      ilike(users.email, textPattern),
      ilike(users.documentNumber, docPattern),
    ];

    // Permite buscar también por nombre de grupo (ej. "7A", "3A") para encontrar estudiantes del grupo.
    if (academicYearId) {
      searchParts.push(
        sql`exists (
          select 1 from ${enrollments}
          inner join ${groups} on ${groups.id} = ${enrollments.groupId}
          where ${enrollments.studentId} = ${users.id}
            and ${enrollments.academicYearId} = ${academicYearId}
            and ${enrollments.status} = 'ACTIVE'
            and translate(lower(${groups.name}), 'áéíóúüñ', 'aeiouun') like ${textPattern}
        )`,
      );
    }

    conditions.push(or(...searchParts)!);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [roleStats, totalRows] = await Promise.all([
    db
      .select({
        role: users.role,
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${users.isActive} = true)::int`,
      })
      .from(users)
      .groupBy(users.role),
    db.select({ total: count() }).from(users).where(whereClause),
  ]);

  const byRole: Record<Role, number> = {
    STUDENT: 0,
    GUARDIAN: 0,
    TEACHER: 0,
    COORDINATOR: 0,
    ADMIN: 0,
  };
  let grandTotal = 0;
  let grandActive = 0;
  for (const r of roleStats) {
    byRole[r.role] = r.total;
    grandTotal += r.total;
    grandActive += r.active;
  }

  const total = totalRows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      id: users.id,
      documentType: users.documentType,
      documentNumber: users.documentNumber,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(asc(users.lastName), asc(users.firstName))
    .limit(pageSize)
    .offset(offset);

  if (rows.length === 0) {
    return {
      items: [],
      total,
      page,
      totalPages,
      pageSize,
      counts: { total: grandTotal, active: grandActive, byRole },
    };
  }

  const userIds = rows.map((r) => r.id);
  const studentIds = rows.filter((r) => r.role === "STUDENT").map((r) => r.id);
  const guardianIds = rows.filter((r) => r.role === "GUARDIAN").map((r) => r.id);
  const now = new Date();

  const [sessionCounts, studentPlacements, guardianLinkCounts, studentLinkCounts] = await Promise.all([
    db
      .select({ userId: sessions.userId, total: sql<number>`count(*)::int` })
      .from(sessions)
      .where(and(inArray(sessions.userId, userIds), gt(sessions.expiresAt, now)))
      .groupBy(sessions.userId),
    academicYearId && studentIds.length > 0
      ? db
          .select({
            studentId: enrollments.studentId,
            groupName: groups.name,
            gradeName: grades.name,
          })
          .from(enrollments)
          .innerJoin(groups, eq(groups.id, enrollments.groupId))
          .innerJoin(grades, eq(grades.id, groups.gradeId))
          .where(
            and(
              inArray(enrollments.studentId, studentIds),
              eq(enrollments.academicYearId, academicYearId),
              eq(enrollments.status, "ACTIVE"),
            ),
          )
      : Promise.resolve([]),
    guardianIds.length > 0
      ? db
          .select({ guardianId: guardianLinks.guardianId, total: sql<number>`count(*)::int` })
          .from(guardianLinks)
          .where(inArray(guardianLinks.guardianId, guardianIds))
          .groupBy(guardianLinks.guardianId)
      : Promise.resolve([]),
    studentIds.length > 0
      ? db
          .select({ studentId: guardianLinks.studentId, total: sql<number>`count(*)::int` })
          .from(guardianLinks)
          .where(inArray(guardianLinks.studentId, studentIds))
          .groupBy(guardianLinks.studentId)
      : Promise.resolve([]),
  ]);

  const sessionsMap = new Map(sessionCounts.map((s) => [s.userId, s.total]));
  const groupMap = new Map(studentPlacements.map((p) => [p.studentId, `${p.groupName} · ${p.gradeName}`]));
  const linksMap = new Map<string, number>();
  for (const g of guardianLinkCounts) linksMap.set(g.guardianId, g.total);
  for (const s of studentLinkCounts) linksMap.set(s.studentId, s.total);

  return {
    items: rows.map((r) => ({
      id: r.id,
      documentType: r.documentType,
      documentNumber: r.documentNumber,
      firstName: r.firstName,
      lastName: r.lastName,
      fullName: `${r.firstName} ${r.lastName}`,
      email: r.email,
      phone: r.phone,
      role: r.role,
      isActive: r.isActive,
      activeSessions: sessionsMap.get(r.id) ?? 0,
      groupLabel: groupMap.get(r.id) ?? null,
      linkedCount: linksMap.get(r.id) ?? 0,
      createdAt: r.createdAt,
    })),
    total,
    page,
    totalPages,
    pageSize,
    counts: { total: grandTotal, active: grandActive, byRole },
  };
}

export interface UserFamilyLink {
  linkId: string;
  otherUserId: string;
  otherFullName: string;
  otherDocument: string;
  relationship: GuardianRelationship;
  isFinancialResponsible: boolean;
  canPickUp: boolean;
}

export interface ManagedUserDetail {
  id: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: Role;
  isActive: boolean;
  activeSessions: number;
  links: UserFamilyLink[];
  linkCandidates: Array<{ id: string; label: string }>;
}

/** Carga el detalle completo de un usuario seleccionado para edición, sesiones y vínculos. */
export async function getManagedUserDetail(userId: string): Promise<ManagedUserDetail | null> {
  const [user] = await db
    .select({
      id: users.id,
      documentType: users.documentType,
      documentNumber: users.documentNumber,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  const now = new Date();
  const [sessionRow, links, candidates] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, now))),
    user.role === "GUARDIAN"
      ? db
          .select({
            linkId: guardianLinks.id,
            otherUserId: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            documentType: users.documentType,
            documentNumber: users.documentNumber,
            relationship: guardianLinks.relationship,
            isFinancialResponsible: guardianLinks.isFinancialResponsible,
            canPickUp: guardianLinks.canPickUp,
          })
          .from(guardianLinks)
          .innerJoin(users, eq(users.id, guardianLinks.studentId))
          .where(eq(guardianLinks.guardianId, user.id))
          .orderBy(asc(users.lastName), asc(users.firstName))
      : user.role === "STUDENT"
        ? db
            .select({
              linkId: guardianLinks.id,
              otherUserId: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              documentType: users.documentType,
              documentNumber: users.documentNumber,
              relationship: guardianLinks.relationship,
              isFinancialResponsible: guardianLinks.isFinancialResponsible,
              canPickUp: guardianLinks.canPickUp,
            })
            .from(guardianLinks)
            .innerJoin(users, eq(users.id, guardianLinks.guardianId))
            .where(eq(guardianLinks.studentId, user.id))
            .orderBy(asc(users.lastName), asc(users.firstName))
        : Promise.resolve([]),
    user.role === "GUARDIAN" || user.role === "STUDENT"
      ? db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            documentNumber: users.documentNumber,
          })
          .from(users)
          .where(and(eq(users.role, user.role === "GUARDIAN" ? "STUDENT" : "GUARDIAN"), eq(users.isActive, true)))
          .orderBy(asc(users.lastName), asc(users.firstName))
          .limit(300)
      : Promise.resolve([]),
  ]);

  const alreadyLinked = new Set(links.map((l) => l.otherUserId));

  return {
    ...user,
    activeSessions: sessionRow[0]?.total ?? 0,
    links: links.map((l) => ({
      linkId: l.linkId,
      otherUserId: l.otherUserId,
      otherFullName: `${l.firstName} ${l.lastName}`,
      otherDocument: `${l.documentType} ${l.documentNumber}`,
      relationship: l.relationship,
      isFinancialResponsible: l.isFinancialResponsible,
      canPickUp: l.canPickUp,
    })),
    linkCandidates: candidates
      .filter((c) => !alreadyLinked.has(c.id))
      .map((c) => ({
        id: c.id,
        label: `${c.lastName}, ${c.firstName} · Doc. ${c.documentNumber}`,
      })),
  };
}
