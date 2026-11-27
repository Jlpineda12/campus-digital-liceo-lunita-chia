import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  academicYears,
  admissionApplications,
  enrollments,
  groups,
  guardianLinks,
  users,
} from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import type { DbExecutor } from "@/modules/core/audit/service";
import type { SiblingClaimStatus } from "./discount-policy";

const guardian = alias(users, "sibling_guardian");

export interface SiblingCheck {
  status: Exclude<SiblingClaimStatus, "NOT_REQUESTED" | "REJECTED">;
  /** Evidencia para Secretaría. Nunca se muestra a la familia (Ley 1581). */
  note: string;
}

/**
 * Verifica el descuento de hermanos en servidor. Es VERIFICADO solo si el
 * hermano(a) declarado tiene matrícula ACTIVA en el año vigente y está vinculado
 * al MISMO acudiente (por documento) que radica la solicitud. En cualquier otro
 * caso queda EN REVISIÓN para Secretaría, sin revelar a la familia si el
 * documento existe (evita enumerar estudiantes).
 */
export async function verifySiblingClaim(
  input: { guardianDocNumber: string; siblingDocNumber: string; studentDocNumber: string; targetYear: number },
  executor: DbExecutor = db,
): Promise<SiblingCheck> {
  const { guardianDocNumber, siblingDocNumber, studentDocNumber, targetYear } = input;
  if (siblingDocNumber === studentDocNumber) {
    return { status: "PENDING_REVIEW", note: "El documento del hermano(a) coincide con el del aspirante." };
  }

  const [match] = await executor
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      groupName: groups.name,
    })
    .from(users)
    .innerJoin(enrollments, eq(enrollments.studentId, users.id))
    .innerJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .innerJoin(groups, eq(groups.id, enrollments.groupId))
    .innerJoin(guardianLinks, eq(guardianLinks.studentId, users.id))
    .innerJoin(guardian, eq(guardian.id, guardianLinks.guardianId))
    .where(
      and(
        eq(users.documentNumber, siblingDocNumber),
        eq(users.role, "STUDENT"),
        eq(users.isActive, true),
        eq(enrollments.status, "ACTIVE"),
        eq(academicYears.isCurrent, true),
        eq(guardian.documentNumber, guardianDocNumber),
      ),
    )
    .limit(1);
  if (match) {
    return {
      status: "VERIFIED",
      note: `Hermano(a) matriculado: ${match.firstName} ${match.lastName} · ${match.groupName}, mismo acudiente.`,
    };
  }

  // Hermanos que se matriculan juntos este mismo proceso.
  const [inProcess] = await executor
    .select({ trackingCode: admissionApplications.trackingCode, status: admissionApplications.status })
    .from(admissionApplications)
    .where(
      and(
        eq(admissionApplications.studentDocNumber, siblingDocNumber),
        eq(admissionApplications.guardianDocNumber, guardianDocNumber),
        eq(admissionApplications.targetYear, targetYear),
        ne(admissionApplications.status, "REJECTED"),
      ),
    )
    .limit(1);
  if (inProcess) {
    return {
      status: "PENDING_REVIEW",
      note: `Hermano(a) en proceso de admisión (radicado ${inProcess.trackingCode}). Aprobar cuando ambos queden matriculados.`,
    };
  }

  return {
    status: "PENDING_REVIEW",
    note: "Sin coincidencia automática (otro acudiente registrado o documento distinto). Verificar con el Registro Civil.",
  };
}

/** Hermanos de una familia ya registrada (acudiente con sesión): otros hijos con matrícula activa. */
export async function findLinkedActiveSibling(
  guardianId: string,
  excludeStudentId: string | null,
  executor: DbExecutor = db,
): Promise<SiblingCheck | null> {
  const rows = await executor
    .select({ studentId: users.id, firstName: users.firstName, lastName: users.lastName, groupName: groups.name })
    .from(guardianLinks)
    .innerJoin(users, eq(users.id, guardianLinks.studentId))
    .innerJoin(enrollments, eq(enrollments.studentId, users.id))
    .innerJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .innerJoin(groups, eq(groups.id, enrollments.groupId))
    .where(
      and(
        eq(guardianLinks.guardianId, guardianId),
        eq(users.isActive, true),
        eq(enrollments.status, "ACTIVE"),
        eq(academicYears.isCurrent, true),
      ),
    );
  const sibling = rows.find((r) => r.studentId !== excludeStudentId);
  return sibling
    ? {
        status: "VERIFIED",
        note: `Hermano(a) matriculado: ${sibling.firstName} ${sibling.lastName} · ${sibling.groupName} (familia con sesión).`,
      }
    : null;
}
