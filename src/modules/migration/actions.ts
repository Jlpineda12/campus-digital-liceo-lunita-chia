"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import {
  academicPeriods,
  activities,
  billingCharges,
  billingPayments,
  courseAssignments,
  enrollments,
  grades,
  groups,
  guardianLinks,
  migrationBatches,
  quizQuestions,
  sieeCompetencies,
  sieeGradeColumns,
  studentGrades,
  subjects,
  users,
} from "@/db/schema";
import { MIGRATION_SOURCE_KINDS, type MigrationSourceKind } from "@/db/schema/migration";
import { getCurrentAcademicContext, todayInBogota } from "@/modules/core/academic-structure/queries";
import { recordAudit } from "@/modules/core/audit/service";
import { requireSession } from "@/modules/core/auth/guards";
import { hashPassword } from "@/modules/core/auth/password";
import { can } from "@/modules/core/auth/permissions";
import { formText } from "@/modules/core/auth/schemas";
import { getRequestMeta } from "@/modules/core/auth/session";
import { deriveChargeStatus } from "@/modules/siga/cartera/calculator";
import { ensureCompetencies } from "@/modules/siga/siee-grades/queries";
import {
  parseBillingBalancesRows,
  parseHistoricalGradesRows,
  parseMoodleQuizXml,
  parseStudentsFamiliesRows,
  readSpreadsheetRows,
  type RowIssue,
} from "./parsers";

const MAX_MIGRATION_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

export interface MigrationActionState {
  status: "idle" | "preview" | "executed" | "error";
  message?: string;
  sourceKind?: MigrationSourceKind;
  fileName?: string;
  totalRows?: number;
  validCount?: number;
  createdCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  errorCount?: number;
  issues?: RowIssue[];
  sampleHeaders?: string[];
  sampleRows?: string[][];
}

function normalizeMatch(s: string): string {
  return s
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Ejecuta validación previa (mode="preview") o importación real idempotente (mode="execute")
 * para los 4 flujos oficiales de Fase 5. Exclusivo rol `ADMIN` (`migration.run`).
 */
export async function runMigrationAction(
  _prev: MigrationActionState,
  formData: FormData,
): Promise<MigrationActionState> {
  const actor = await requireSession();
  if (!can(actor.role, "migration.run")) {
    return { status: "error", message: "Acceso exclusivo de Rectoría y Secretaría." };
  }

  const context = await getCurrentAcademicContext();
  if (!context) {
    return { status: "error", message: "No hay un año lectivo vigente configurado." };
  }

  const rawKind = formText(formData, "sourceKind") ?? "";
  if (!(MIGRATION_SOURCE_KINDS as readonly string[]).includes(rawKind)) {
    return { status: "error", message: "Selecciona un tipo de migración válido." };
  }
  const sourceKind = rawKind as MigrationSourceKind;
  const mode = formText(formData, "mode") === "execute" ? "execute" : "preview";
  const targetQuizId = formText(formData, "targetQuizId") ?? "";

  const rawFile = formData.get("file");
  if (!(rawFile instanceof File) || rawFile.size === 0) {
    return { status: "error", message: "Adjunta un archivo Excel (.xlsx), CSV o Moodle XML." };
  }
  if (rawFile.size > MAX_MIGRATION_FILE_BYTES) {
    return { status: "error", message: "El archivo supera el límite máximo de 8 MB." };
  }

  const fileName = rawFile.name.slice(0, 120);
  const buffer = Buffer.from(await rawFile.arrayBuffer());
  const { ip } = await getRequestMeta();

  /* -------------------------------------------------------------------------
     FLUJO 1: ESTUDIANTES + ACUDIENTES + MATRÍCULA (UNIFICACIÓN POR DOCUMENTO)
     ------------------------------------------------------------------------- */
  if (sourceKind === "STUDENTS_FAMILIES") {
    let rawRows: Array<Record<string, string>>;
    try {
      rawRows = await readSpreadsheetRows(buffer, fileName);
    } catch {
      return { status: "error", message: "No pudimos leer el archivo. Verifica que sea un .xlsx o .csv válido." };
    }
    if (rawRows.length === 0) {
      return { status: "error", message: "El archivo no contiene filas de datos." };
    }

    const { valid, issues } = parseStudentsFamiliesRows(rawRows);
    const allGroups = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.academicYearId, context.year.id));
    const groupByName = new Map(allGroups.map((g) => [g.name.toUpperCase(), g.id]));

    const resolvedValid = valid.filter((r) => {
      if (!groupByName.has(r.groupName.toUpperCase())) {
        issues.push({
          rowNumber: r.rowNumber,
          severity: "error",
          message: `Grupo «${r.groupName}» no existe en ${context.year.name}.`,
        });
        return false;
      }
      return true;
    });

    const sampleHeaders = ["Doc.", "Estudiante", "Grupo", "Acudiente", "Correo"];
    const sampleRows = resolvedValid.slice(0, 12).map((r) => [
      `${r.documentType} ${r.documentNumber}`,
      `${r.firstName} ${r.lastName}`,
      r.groupName,
      r.guardianDoc ? `${r.guardianFirstName ?? ""} ${r.guardianLastName ?? ""} (${r.guardianDoc})`.trim() : "—",
      r.email,
    ]);

    if (mode === "preview") {
      return {
        status: "preview",
        message: `Validación completada: ${resolvedValid.length} fila(s) listas para importar.`,
        sourceKind,
        fileName,
        totalRows: rawRows.length,
        validCount: resolvedValid.length,
        errorCount: issues.filter((i) => i.severity === "error").length,
        issues: issues.slice(0, 30),
        sampleHeaders,
        sampleRows,
      };
    }

    if (resolvedValid.length === 0) {
      return {
        status: "error",
        message: "No hay filas válidas para importar. Corrige los errores reportados.",
        sourceKind,
        fileName,
        issues: issues.slice(0, 30),
      };
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Clave inicial segura por defecto para cuentas nuevas migradas (el usuario la cambia en primer acceso)
    const defaultPwdHash = await hashPassword("Lunita2026*");

    await db.transaction(async (tx) => {
      for (const row of resolvedValid) {
        const groupId = groupByName.get(row.groupName.toUpperCase())!;

        // 1. Upsert estudiante por documentNumber (llave única de identidad)
        const [existingStudent] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.documentNumber, row.documentNumber))
          .limit(1);

        let studentId: string;
        if (existingStudent) {
          studentId = existingStudent.id;
          await tx
            .update(users)
            .set({
              firstName: row.firstName,
              lastName: row.lastName,
              documentType: row.documentType,
            })
            .where(eq(users.id, studentId));
          updatedCount += 1;
        } else {
          const [createdStudent] = await tx
            .insert(users)
            .values({
              email: row.email,
              documentType: row.documentType,
              documentNumber: row.documentNumber,
              firstName: row.firstName,
              lastName: row.lastName,
              role: "STUDENT",
              isActive: true,
              passwordHash: defaultPwdHash,
            })
            .onConflictDoNothing({ target: users.email })
            .returning({ id: users.id });

          if (!createdStudent) {
            // Si el correo ya existía en otro usuario, creamos con correo basado en documento
            const [fallback] = await tx
              .insert(users)
              .values({
                email: `est.${row.documentNumber.toLowerCase()}@campus.lunita.edu.co`,
                documentType: row.documentType,
                documentNumber: row.documentNumber,
                firstName: row.firstName,
                lastName: row.lastName,
                role: "STUDENT",
                isActive: true,
                passwordHash: defaultPwdHash,
              })
              .returning({ id: users.id });
            studentId = fallback!.id;
          } else {
            studentId = createdStudent.id;
          }
          createdCount += 1;
        }

        // 2. Matrícula idempotente en el año vigente
        await tx
          .insert(enrollments)
          .values({
            studentId,
            groupId,
            academicYearId: context.year.id,
            enrollmentType: "RENEWAL",
            status: "ACTIVE",
          })
          .onConflictDoUpdate({
            target: [enrollments.studentId, enrollments.academicYearId],
            set: { groupId, status: "ACTIVE" },
          });

        // 3. Acudiente y vínculo familiar financiero si viene en el Excel
        if (row.guardianDoc && row.guardianFirstName && row.guardianLastName) {
          const [existingGuard] = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.documentNumber, row.guardianDoc))
            .limit(1);

          let guardianId: string;
          if (existingGuard) {
            guardianId = existingGuard.id;
          } else {
            const gEmail = row.guardianEmail || `acu.${row.guardianDoc.toLowerCase()}@campus.lunita.edu.co`;
            const [createdGuard] = await tx
              .insert(users)
              .values({
                email: gEmail,
                documentType: "CC",
                documentNumber: row.guardianDoc,
                firstName: row.guardianFirstName,
                lastName: row.guardianLastName,
                phone: row.guardianPhone,
                role: "GUARDIAN",
                isActive: true,
                passwordHash: defaultPwdHash,
              })
              .onConflictDoNothing({ target: users.email })
              .returning({ id: users.id });

            if (!createdGuard) {
              const [fallbackG] = await tx
                .insert(users)
                .values({
                  email: `acu.${row.guardianDoc.toLowerCase()}@campus.lunita.edu.co`,
                  documentType: "CC",
                  documentNumber: row.guardianDoc,
                  firstName: row.guardianFirstName,
                  lastName: row.guardianLastName,
                  phone: row.guardianPhone,
                  role: "GUARDIAN",
                  isActive: true,
                  passwordHash: defaultPwdHash,
                })
                .returning({ id: users.id });
              guardianId = fallbackG!.id;
            } else {
              guardianId = createdGuard.id;
            }
          }

          await tx
            .insert(guardianLinks)
            .values({
              guardianId,
              studentId,
              relationship: row.guardianRelationship,
              isFinancialResponsible: true,
            })
            .onConflictDoNothing();
        }
      }

      skippedCount = Math.max(0, rawRows.length - resolvedValid.length);
      const errorCount = issues.filter((i) => i.severity === "error").length;

      const [batch] = await tx
        .insert(migrationBatches)
        .values({
          academicYearId: context.year.id,
          sourceKind,
          fileName,
          totalRows: rawRows.length,
          createdCount,
          updatedCount,
          skippedCount,
          errorCount,
          summaryJson: { issuesCount: issues.length },
          executedBy: actor.id,
        })
        .returning({ id: migrationBatches.id });

      await recordAudit(
        {
          actorUserId: actor.id,
          action: "MIGRATION_EXECUTED",
          entityType: "migration_batch",
          entityId: batch!.id,
          after: { sourceKind, fileName, createdCount, updatedCount, skippedCount, errorCount },
          ipAddress: ip,
        },
        tx,
      );
    });

    refresh();
    return {
      status: "executed",
      message: `Migración completada: ${createdCount} creados, ${updatedCount} actualizados, ${skippedCount} omitidos.`,
      sourceKind,
      fileName,
      totalRows: rawRows.length,
      validCount: resolvedValid.length,
      createdCount,
      updatedCount,
      skippedCount,
      errorCount: issues.filter((i) => i.severity === "error").length,
      issues: issues.slice(0, 30),
      sampleHeaders,
      sampleRows,
    };
  }

  /* -------------------------------------------------------------------------
     FLUJO 2: HISTÓRICO DE NOTAS SIEE (DESDE SIGA ANTERIOR)
     ------------------------------------------------------------------------- */
  if (sourceKind === "HISTORICAL_GRADES") {
    let rawRows: Array<Record<string, string>>;
    try {
      rawRows = await readSpreadsheetRows(buffer, fileName);
    } catch {
      return { status: "error", message: "No pudimos leer el archivo Excel/CSV de notas." };
    }
    if (rawRows.length === 0) return { status: "error", message: "El archivo no contiene filas de notas." };

    const { valid, issues } = parseHistoricalGradesRows(rawRows);
    const [enrRows, periodRows, courseRows] = await Promise.all([
      db
        .select({
          enrollmentId: enrollments.id,
          groupId: enrollments.groupId,
          documentNumber: users.documentNumber,
          studentName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        })
        .from(enrollments)
        .innerJoin(users, eq(users.id, enrollments.studentId))
        .where(and(eq(enrollments.academicYearId, context.year.id), eq(enrollments.status, "ACTIVE"))),
      db
        .select({ id: academicPeriods.id, orderNumber: academicPeriods.number, name: academicPeriods.name })
        .from(academicPeriods)
        .where(eq(academicPeriods.academicYearId, context.year.id)),
      db
        .select({
          courseAssignmentId: courseAssignments.id,
          groupId: courseAssignments.groupId,
          subjectName: subjects.name,
          assessmentMode: grades.assessmentMode,
        })
        .from(courseAssignments)
        .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
        .innerJoin(groups, eq(groups.id, courseAssignments.groupId))
        .innerJoin(grades, eq(grades.id, groups.gradeId))
        .where(eq(courseAssignments.academicYearId, context.year.id)),
    ]);

    const enrByDoc = new Map(enrRows.map((e) => [e.documentNumber.toUpperCase(), e]));
    const periodByNum = new Map(periodRows.map((p) => [p.orderNumber, p]));
    const courseByGroupSubject = new Map(
      courseRows.map((c) => [`${c.groupId}:${normalizeMatch(c.subjectName)}`, c]),
    );

    const matched: Array<{
      row: (typeof valid)[number];
      enrollmentId: string;
      studentName: string;
      periodId: string;
      periodName: string;
      courseAssignmentId: string;
      assessmentMode: (typeof courseRows)[number]["assessmentMode"];
    }> = [];

    for (const r of valid) {
      const enr = enrByDoc.get(r.studentDocument);
      if (!enr) {
        issues.push({ rowNumber: r.rowNumber, severity: "error", message: `Estudiante ${r.studentDocument} no está matriculado en ${context.year.name}.` });
        continue;
      }
      const period = periodByNum.get(r.periodOrder);
      if (!period) {
        issues.push({ rowNumber: r.rowNumber, severity: "error", message: `Periodo ${r.periodOrder} no existe en ${context.year.name}.` });
        continue;
      }
      const course = courseByGroupSubject.get(`${enr.groupId}:${normalizeMatch(r.subjectName)}`);
      if (!course) {
        issues.push({ rowNumber: r.rowNumber, severity: "error", message: `Asignatura «${r.subjectName}» no está asignada al grupo de ${enr.studentName}.` });
        continue;
      }
      matched.push({
        row: r,
        enrollmentId: enr.enrollmentId,
        studentName: enr.studentName,
        periodId: period.id,
        periodName: period.name,
        courseAssignmentId: course.courseAssignmentId,
        assessmentMode: course.assessmentMode,
      });
    }

    const sampleHeaders = ["Estudiante", "Asignatura", "Periodo", "Dimensión", "Nota SIEE"];
    const sampleRows = matched.slice(0, 12).map((m) => [
      m.studentName,
      m.row.subjectName,
      m.periodName,
      m.row.dimension,
      m.row.score.toFixed(1),
    ]);

    if (mode === "preview") {
      return {
        status: "preview",
        message: `Validación completada: ${matched.length} calificación(es) listas para cargar a SIGA.`,
        sourceKind,
        fileName,
        totalRows: rawRows.length,
        validCount: matched.length,
        errorCount: issues.filter((i) => i.severity === "error").length,
        issues: issues.slice(0, 30),
        sampleHeaders,
        sampleRows,
      };
    }

    if (matched.length === 0) {
      return { status: "error", message: "No hay notas válidas para importar.", sourceKind, fileName, issues: issues.slice(0, 30) };
    }

    // Garantizar competencias SIEE antes de abrir la transacción
    const seenCoursePeriods = new Set<string>();
    for (const m of matched) {
      const k = `${m.courseAssignmentId}:${m.periodId}`;
      if (!seenCoursePeriods.has(k)) {
        seenCoursePeriods.add(k);
        await ensureCompetencies(m.courseAssignmentId, m.periodId, m.assessmentMode);
      }
    }

    let createdCount = 0;
    const now = new Date();
    const columnCache = new Map<string, string>();

    await db.transaction(async (tx) => {
      for (const m of matched) {
        const colKey = `${m.courseAssignmentId}:${m.periodId}:${m.row.dimension}:${m.row.columnTitle}`;
        let columnId = columnCache.get(colKey);

        if (!columnId) {
          const [comp] = await tx
            .select({ id: sieeCompetencies.id })
            .from(sieeCompetencies)
            .where(
              and(
                eq(sieeCompetencies.courseAssignmentId, m.courseAssignmentId),
                eq(sieeCompetencies.periodId, m.periodId),
                eq(sieeCompetencies.dimension, m.row.dimension),
              ),
            )
            .limit(1);
          if (!comp) continue;

          const [existingCol] = await tx
            .select({ id: sieeGradeColumns.id })
            .from(sieeGradeColumns)
            .where(and(eq(sieeGradeColumns.competencyId, comp.id), eq(sieeGradeColumns.title, m.row.columnTitle)))
            .limit(1);

          if (existingCol) {
            columnId = existingCol.id;
          } else {
            const [createdCol] = await tx
              .insert(sieeGradeColumns)
              .values({
                courseAssignmentId: m.courseAssignmentId,
                periodId: m.periodId,
                competencyId: comp.id,
                title: m.row.columnTitle,
                weightPercent: 100,
                createdBy: actor.id,
              })
              .returning({ id: sieeGradeColumns.id });
            columnId = createdCol!.id;
          }
          columnCache.set(colKey, columnId);
        }

        await tx
          .insert(studentGrades)
          .values({
            columnId,
            enrollmentId: m.enrollmentId,
            numericScore: m.row.score,
            updatedBy: actor.id,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [studentGrades.columnId, studentGrades.enrollmentId],
            set: { numericScore: m.row.score, updatedBy: actor.id, updatedAt: now },
          });
        createdCount += 1;
      }

      const skippedCount = Math.max(0, rawRows.length - matched.length);
      const errorCount = issues.filter((i) => i.severity === "error").length;

      const [batch] = await tx
        .insert(migrationBatches)
        .values({
          academicYearId: context.year.id,
          sourceKind,
          fileName,
          totalRows: rawRows.length,
          createdCount,
          updatedCount: 0,
          skippedCount,
          errorCount,
          executedBy: actor.id,
        })
        .returning({ id: migrationBatches.id });

      await recordAudit(
        {
          actorUserId: actor.id,
          action: "MIGRATION_EXECUTED",
          entityType: "migration_batch",
          entityId: batch!.id,
          after: { sourceKind, fileName, createdCount, skippedCount, errorCount },
          ipAddress: ip,
        },
        tx,
      );
    });

    refresh();
    return {
      status: "executed",
      message: `${createdCount} calificación(es) histórica(s) migradas correctamente a SIGA.`,
      sourceKind,
      fileName,
      totalRows: rawRows.length,
      validCount: matched.length,
      createdCount,
      updatedCount: 0,
      skippedCount: Math.max(0, rawRows.length - matched.length),
      errorCount: issues.filter((i) => i.severity === "error").length,
      issues: issues.slice(0, 30),
      sampleHeaders,
      sampleRows,
    };
  }

  /* -------------------------------------------------------------------------
     FLUJO 3: CARTERA / PAGOS HISTÓRICOS (MEGA-EXCEL FEB–NOV)
     ------------------------------------------------------------------------- */
  if (sourceKind === "BILLING_BALANCES") {
    let rawRows: Array<Record<string, string>>;
    try {
      rawRows = await readSpreadsheetRows(buffer, fileName);
    } catch {
      return { status: "error", message: "No pudimos leer el archivo Excel/CSV de cartera." };
    }
    if (rawRows.length === 0) return { status: "error", message: "El archivo no contiene filas de pagos." };

    const { valid, issues } = parseBillingBalancesRows(rawRows);
    const [enrRows, chargesRows, existingPayments] = await Promise.all([
      db
        .select({
          enrollmentId: enrollments.id,
          documentNumber: users.documentNumber,
          studentName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        })
        .from(enrollments)
        .innerJoin(users, eq(users.id, enrollments.studentId))
        .where(and(eq(enrollments.academicYearId, context.year.id), eq(enrollments.status, "ACTIVE"))),
      db
        .select()
        .from(billingCharges)
        .where(eq(billingCharges.academicYearId, context.year.id)),
      db.select({ referenceCode: billingPayments.referenceCode }).from(billingPayments),
    ]);

    const enrByDoc = new Map(enrRows.map((e) => [e.documentNumber.toUpperCase(), e]));
    const chargeByKey = new Map(chargesRows.map((c) => [`${c.enrollmentId}:${c.billingMonth}`, c]));
    const existingRefs = new Set(existingPayments.map((p) => p.referenceCode));

    const matched: Array<{
      row: (typeof valid)[number];
      studentName: string;
      charge: (typeof chargesRows)[number];
    }> = [];

    for (const r of valid) {
      const enr = enrByDoc.get(r.studentDocument);
      if (!enr) {
        issues.push({ rowNumber: r.rowNumber, severity: "error", message: `Estudiante ${r.studentDocument} no está matriculado en ${context.year.name}.` });
        continue;
      }
      const ch = chargeByKey.get(`${enr.enrollmentId}:${r.billingMonth}`);
      if (!ch) {
        issues.push({ rowNumber: r.rowNumber, severity: "error", message: `No existe cargo para ${enr.studentName} en el mes ${r.billingMonth}. Sincroniza cartera primero.` });
        continue;
      }
      if (existingRefs.has(r.referenceCode)) {
        issues.push({ rowNumber: r.rowNumber, severity: "warning", message: `Referencia ${r.referenceCode} ya fue registrada antes; se omite para no duplicar.` });
        continue;
      }
      matched.push({ row: r, studentName: enr.studentName, charge: ch });
    }

    const sampleHeaders = ["Estudiante", "Concepto", "Valor COP", "Canal", "Referencia"];
    const sampleRows = matched.slice(0, 12).map((m) => [
      m.studentName,
      m.charge.concept,
      `$${m.row.paidCop.toLocaleString("es-CO")}`,
      m.row.channel,
      m.row.referenceCode,
    ]);

    if (mode === "preview") {
      return {
        status: "preview",
        message: `Validación completada: ${matched.length} pago(s) listos para aplicar en Cartera.`,
        sourceKind,
        fileName,
        totalRows: rawRows.length,
        validCount: matched.length,
        errorCount: issues.filter((i) => i.severity === "error").length,
        issues: issues.slice(0, 30),
        sampleHeaders,
        sampleRows,
      };
    }

    if (matched.length === 0) {
      return { status: "error", message: "No hay pagos nuevos válidos para aplicar.", sourceKind, fileName, issues: issues.slice(0, 30) };
    }

    let createdCount = 0;
    const today = todayInBogota();

    await db.transaction(async (tx) => {
      for (let i = 0; i < matched.length; i++) {
        const m = matched[i]!;
        const receiptNumber = `MIG-${context.year.year}-${Date.now().toString().slice(-5)}${i}`;
        const paidAt = new Date(`${m.row.paidDate}T12:00:00-05:00`);

        await tx.insert(billingPayments).values({
          chargeId: m.charge.id,
          amountCop: m.row.paidCop,
          channel: m.row.channel,
          referenceCode: m.row.referenceCode,
          receiptNumber,
          notes: `Migrado desde ${fileName}`,
          recordedBy: actor.id,
          paidAt: Number.isNaN(paidAt.getTime()) ? new Date() : paidAt,
        });

        const [freshCharge] = await tx
          .select()
          .from(billingCharges)
          .where(eq(billingCharges.id, m.charge.id))
          .limit(1);

        if (freshCharge) {
          const newPaid = freshCharge.paidCop + m.row.paidCop;
          const nextStatus = deriveChargeStatus(
            {
              amountCop: freshCharge.amountCop,
              discountCop: freshCharge.discountCop,
              paidCop: newPaid,
              dueDate: freshCharge.dueDate,
              status: freshCharge.status,
            },
            today,
          );
          await tx
            .update(billingCharges)
            .set({ paidCop: newPaid, status: nextStatus, updatedAt: new Date() })
            .where(eq(billingCharges.id, freshCharge.id));
        }
        createdCount += 1;
      }

      const skippedCount = Math.max(0, rawRows.length - matched.length);
      const errorCount = issues.filter((i) => i.severity === "error").length;

      const [batch] = await tx
        .insert(migrationBatches)
        .values({
          academicYearId: context.year.id,
          sourceKind,
          fileName,
          totalRows: rawRows.length,
          createdCount,
          updatedCount: 0,
          skippedCount,
          errorCount,
          executedBy: actor.id,
        })
        .returning({ id: migrationBatches.id });

      await recordAudit(
        {
          actorUserId: actor.id,
          action: "MIGRATION_EXECUTED",
          entityType: "migration_batch",
          entityId: batch!.id,
          after: { sourceKind, fileName, createdCount, skippedCount, errorCount },
          ipAddress: ip,
        },
        tx,
      );
    });

    refresh();
    return {
      status: "executed",
      message: `${createdCount} pago(s) migrados y conciliados en Cartera Escolar.`,
      sourceKind,
      fileName,
      totalRows: rawRows.length,
      validCount: matched.length,
      createdCount,
      updatedCount: 0,
      skippedCount: Math.max(0, rawRows.length - matched.length),
      errorCount: issues.filter((i) => i.severity === "error").length,
      issues: issues.slice(0, 30),
      sampleHeaders,
      sampleRows,
    };
  }

  /* -------------------------------------------------------------------------
     FLUJO 4: BANCO DE PREGUNTAS MOODLE XML → ÓRBITA VIRTUAL
     ------------------------------------------------------------------------- */
  if (!targetQuizId) {
    return { status: "error", message: "Selecciona el cuestionario de destino en Órbita Virtual." };
  }

  const [targetQuiz] = await db
    .select({ id: activities.id, title: activities.title })
    .from(activities)
    .where(and(eq(activities.id, targetQuizId), eq(activities.type, "QUIZ")))
    .limit(1);
  if (!targetQuiz) {
    return { status: "error", message: "El cuestionario destino seleccionado no existe." };
  }

  const xmlText = buffer.toString("utf-8");
  const { valid: parsedQuestions, issues } = parseMoodleQuizXml(xmlText);

  const sampleHeaders = ["#", "Tipo", "Enunciado", "Opciones", "Puntos"];
  const sampleRows = parsedQuestions.slice(0, 12).map((q, idx) => [
    String(idx + 1),
    q.questionType === "TRUE_FALSE" ? "V / F" : q.questionType === "MULTI_CHOICE" ? "Múltiple" : "Única",
    q.prompt.slice(0, 90),
    `${q.options.length} opciones`,
    String(q.points),
  ]);

  if (mode === "preview") {
    return {
      status: "preview",
      message: `Moodle XML analizado: ${parsedQuestions.length} pregunta(s) listas para «${targetQuiz.title}».`,
      sourceKind,
      fileName,
      totalRows: parsedQuestions.length + issues.length,
      validCount: parsedQuestions.length,
      errorCount: issues.filter((i) => i.severity === "error").length,
      issues: issues.slice(0, 30),
      sampleHeaders,
      sampleRows,
    };
  }

  if (parsedQuestions.length === 0) {
    return { status: "error", message: "No se encontraron preguntas válidas en el Moodle XML.", sourceKind, fileName, issues: issues.slice(0, 30) };
  }

  let createdCount = 0;
  await db.transaction(async (tx) => {
    const [cnt] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(quizQuestions)
      .where(eq(quizQuestions.activityId, targetQuiz.id));
    const baseOrder = cnt?.total ?? 0;

    for (let i = 0; i < parsedQuestions.length; i++) {
      const q = parsedQuestions[i]!;
      await tx.insert(quizQuestions).values({
        activityId: targetQuiz.id,
        questionType: q.questionType,
        promptSanitized: q.prompt,
        optionsJson: q.options,
        correctAnswerJson: q.correctOptionIds,
        points: q.points,
        displayOrder: baseOrder + i,
      });
      createdCount += 1;
    }

    const errorCount = issues.filter((i) => i.severity === "error").length;
    const [batch] = await tx
      .insert(migrationBatches)
      .values({
        academicYearId: context.year.id,
        sourceKind,
        fileName,
        totalRows: parsedQuestions.length + issues.length,
        createdCount,
        updatedCount: 0,
        skippedCount: issues.length,
        errorCount,
        summaryJson: { targetQuizId: targetQuiz.id, targetQuizTitle: targetQuiz.title },
        executedBy: actor.id,
      })
      .returning({ id: migrationBatches.id });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "MIGRATION_EXECUTED",
        entityType: "migration_batch",
        entityId: batch!.id,
        after: { sourceKind, fileName, targetQuizTitle: targetQuiz.title, createdCount },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return {
    status: "executed",
    message: `${createdCount} pregunta(s) de Moodle XML importadas en «${targetQuiz.title}».`,
    sourceKind,
    fileName,
    totalRows: parsedQuestions.length + issues.length,
    validCount: parsedQuestions.length,
    createdCount,
    updatedCount: 0,
    skippedCount: issues.length,
    errorCount: issues.filter((i) => i.severity === "error").length,
    issues: issues.slice(0, 30),
    sampleHeaders,
    sampleRows,
  };
}
