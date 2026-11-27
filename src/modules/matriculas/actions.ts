"use server";

import { and, count, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  academicYears,
  admissionApplications,
  enrollmentDocuments,
  enrollments,
  grades,
  groups,
  guardianLinks,
  levels,
  users,
} from "@/db/schema";
import { DOCUMENT_TYPES } from "@/modules/core/academic-structure/constants";
import { PAYMENT_CHANNELS } from "@/db/schema/matriculas";
import { recordAudit } from "@/modules/core/audit/service";
import { requirePermission, requireSession } from "@/modules/core/auth/guards";
import { hashPassword } from "@/modules/core/auth/password";
import { can } from "@/modules/core/auth/permissions";
import { formText } from "@/modules/core/auth/schemas";
import { getRequestMeta, getSession } from "@/modules/core/auth/session";
import {
  generateInstitutionalEmail,
  generateInstitutionalPassword,
} from "@/modules/core/users/bulk";
import { normalizeDocumentNumber } from "@/modules/core/users/schemas";
import { todayInBogota } from "@/modules/core/academic-structure/queries";
import {
  earlyBirdAtSubmission,
  earlyBirdOnPayment,
  effectiveDiscounts,
  type EarlyBirdStatus,
  type SiblingClaimStatus,
} from "./discount-policy";
import { findLinkedActiveSibling, verifySiblingClaim, type SiblingCheck } from "./siblings";
import { sanitizeAulaText } from "@/modules/aula/sanitize";
import {
  ADMISSION_DOC_KEYS,
  calculateAdmissionFees,
  ENROLLMENT_TYPES,
  generateTrackingCode,
} from "./catalog";
import { savePrivateAdmissionFile } from "./storage";

export interface AdmissionActionState {
  status: "idle" | "success" | "error";
  message?: string;
  trackingCode?: string;
  guardianDocNumber?: string;
  /** Resultado de la verificación de descuentos al radicar. */
  benefits?: { earlyBird: EarlyBirdStatus; sibling: SiblingClaimStatus };
  issuedCredentials?: Array<{ role: string; fullName: string; email: string; documentNumber: string; password: string }>;
}

const createAdmissionSchema = z.object({
  applicationType: z.enum(ENROLLMENT_TYPES),
  targetGradeId: z.uuid({ error: "Selecciona el grado al que aspiras." }),
  studentFirstName: z.string({ error: "Ingresa los nombres del estudiante." }).trim().min(2).max(80),
  studentLastName: z.string({ error: "Ingresa los apellidos del estudiante." }).trim().min(2).max(80),
  studentDocType: z.enum(DOCUMENT_TYPES),
  studentDocNumber: z.string().trim().min(5, "Documento del estudiante inválido.").max(25),
  studentBirthDate: z.string().trim().optional().default(""),
  studentEps: z.string().trim().max(80).optional().default(""),
  studentBloodType: z.string().trim().max(10).optional().default(""),
  previousSchool: z.string().trim().max(120).optional().default(""),
  guardianFirstName: z.string({ error: "Ingresa los nombres del acudiente." }).trim().min(2).max(80),
  guardianLastName: z.string({ error: "Ingresa los apellidos del acudiente." }).trim().min(2).max(80),
  guardianDocType: z.enum(DOCUMENT_TYPES),
  guardianDocNumber: z.string().trim().min(5, "Documento del acudiente inválido.").max(25),
  guardianEmail: z.email({ error: "Ingresa un correo electrónico válido." }).trim().toLowerCase(),
  guardianPhone: z.string().trim().min(7, "Ingresa un teléfono de contacto válido.").max(25),
  address: z.string().trim().max(180).optional().default(""),
  /** La familia declara tener hijos en el colegio; el servidor lo verifica. */
  claimsSibling: z.boolean().default(false),
  siblingDocNumber: z.string().trim().max(25).optional().default(""),
  habeasDataAccepted: z.literal(true, {
    error: "Debes aceptar la Política de Tratamiento de Datos de Menores (Ley 1581).",
  }),
});

/** Radica una nueva solicitud de matrícula o renovación 2027 (ruta pública o familia autenticada). */
export async function createAdmissionApplicationAction(
  _prev: AdmissionActionState,
  formData: FormData,
): Promise<AdmissionActionState> {
  const parsed = createAdmissionSchema.safeParse({
    applicationType: formText(formData, "applicationType") || "NEW",
    targetGradeId: formText(formData, "targetGradeId"),
    studentFirstName: formText(formData, "studentFirstName"),
    studentLastName: formText(formData, "studentLastName"),
    studentDocType: formText(formData, "studentDocType") || "TI",
    studentDocNumber: normalizeDocumentNumber(formText(formData, "studentDocNumber") ?? ""),
    studentBirthDate: formText(formData, "studentBirthDate") ?? "",
    studentEps: formText(formData, "studentEps") ?? "",
    studentBloodType: formText(formData, "studentBloodType") ?? "",
    previousSchool: formText(formData, "previousSchool") ?? "",
    guardianFirstName: formText(formData, "guardianFirstName"),
    guardianLastName: formText(formData, "guardianLastName"),
    guardianDocType: formText(formData, "guardianDocType") || "CC",
    guardianDocNumber: normalizeDocumentNumber(formText(formData, "guardianDocNumber") ?? ""),
    guardianEmail: formText(formData, "guardianEmail"),
    guardianPhone: formText(formData, "guardianPhone"),
    address: formText(formData, "address") ?? "",
    claimsSibling: formData.get("claimsSibling") === "on",
    siblingDocNumber: normalizeDocumentNumber(formText(formData, "siblingDocNumber") ?? ""),
    habeasDataAccepted: formData.get("habeasDataAccepted") === "on",
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos del formulario." };
  }
  const input = parsed.data;

  const [gradeRow] = await db
    .select({ id: grades.id, levelCode: levels.code })
    .from(grades)
    .innerJoin(levels, eq(levels.id, grades.levelId))
    .where(eq(grades.id, input.targetGradeId))
    .limit(1);
  if (!gradeRow) {
    return { status: "error", message: "El grado seleccionado no es válido." };
  }

  const session = await getSession();

  // Descuentos verificados en servidor (nunca autodeclarados).
  const earlyBird = earlyBirdAtSubmission(todayInBogota());
  let siblingCheck: SiblingCheck | null = null;
  if (session?.user.role === "GUARDIAN") {
    const [current] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.documentNumber, input.studentDocNumber))
      .limit(1);
    siblingCheck = await findLinkedActiveSibling(session.user.id, current?.id ?? null);
  }
  if (!siblingCheck && input.claimsSibling) {
    if (input.siblingDocNumber.length < 5) {
      return { status: "error", message: "Escribe el número de documento del hermano(a) que estudia en el Liceo." };
    }
    siblingCheck = await verifySiblingClaim({
      guardianDocNumber: input.guardianDocNumber,
      siblingDocNumber: input.siblingDocNumber,
      studentDocNumber: input.studentDocNumber,
      targetYear: 2027,
    });
  }
  const siblingStatus: SiblingClaimStatus = siblingCheck?.status ?? "NOT_REQUESTED";
  const discounts = effectiveDiscounts({ earlyBird, sibling: siblingStatus });
  const fees = calculateAdmissionFees({ levelCode: gradeRow.levelCode, ...discounts });

  const { ip } = await getRequestMeta();
  const trackingCode = generateTrackingCode(2027);
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(input.studentBirthDate) ? input.studentBirthDate : null;

  await db.transaction(async (tx) => {
    const [existingStudent] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.documentNumber, input.studentDocNumber))
      .limit(1);

    const [created] = await tx
      .insert(admissionApplications)
      .values({
        trackingCode,
        targetYear: 2027,
        applicationType: input.applicationType,
        status: "SUBMITTED",
        targetGradeId: gradeRow.id,
        existingStudentId: existingStudent?.id ?? null,
        existingGuardianId: session?.user.role === "GUARDIAN" ? session.user.id : null,
        studentFirstName: sanitizeAulaText(input.studentFirstName),
        studentLastName: sanitizeAulaText(input.studentLastName),
        studentDocType: input.studentDocType,
        studentDocNumber: input.studentDocNumber,
        studentBirthDate: birthDate,
        studentEps: sanitizeAulaText(input.studentEps),
        studentBloodType: sanitizeAulaText(input.studentBloodType).toUpperCase().slice(0, 6),
        previousSchool: sanitizeAulaText(input.previousSchool),
        guardianFirstName: sanitizeAulaText(input.guardianFirstName),
        guardianLastName: sanitizeAulaText(input.guardianLastName),
        guardianDocType: input.guardianDocType,
        guardianDocNumber: input.guardianDocNumber,
        guardianEmail: input.guardianEmail,
        guardianPhone: sanitizeAulaText(input.guardianPhone),
        address: sanitizeAulaText(input.address),
        earlyBirdStatus: earlyBird,
        siblingClaimStatus: siblingStatus,
        siblingReferenceDoc: input.claimsSibling ? input.siblingDocNumber || null : null,
        siblingVerificationNote: siblingCheck?.note ?? null,
        hasSiblingDiscount: discounts.hasSiblingDiscount,
        hasEarlyBirdDiscount: discounts.hasEarlyBirdDiscount,
        estimatedEnrollmentCop: fees.enrollmentFinal,
        estimatedMonthlyCop: fees.monthlyFinal,
        habeasDataAcceptedAt: new Date(),
        habeasDataIp: ip,
        habeasDataVersion: "2026-v1",
      })
      .returning({ id: admissionApplications.id });

    await tx.insert(enrollmentDocuments).values(
      ADMISSION_DOC_KEYS.map((docKey) => ({
        applicationId: created!.id,
        docKey,
        status: "PENDING" as const,
      })),
    );

    await recordAudit(
      {
        actorUserId: session?.user.id ?? null,
        action: "ADMISSION_SUBMITTED",
        entityType: "admission_application",
        entityId: created!.id,
        after: {
          trackingCode,
          applicationType: input.applicationType,
          targetGradeId: gradeRow.id,
        },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return {
    status: "success",
    message: `¡Solicitud radicada! Guarda tu código ${trackingCode} para subir los 8 documentos y consultar avances.`,
    trackingCode,
    guardianDocNumber: input.guardianDocNumber,
    benefits: { earlyBird, sibling: siblingStatus },
  };
}

/** Sube uno de los 8 documentos obligatorios a almacenamiento privado (validando radicado + doc acudiente). */
export async function uploadAdmissionDocumentAction(
  _prev: AdmissionActionState,
  formData: FormData,
): Promise<AdmissionActionState> {
  const trackingCode = (formText(formData, "trackingCode") ?? "").trim().toUpperCase();
  const guardianDocNumber = normalizeDocumentNumber(formText(formData, "guardianDocNumber") ?? "");
  const docKey = formText(formData, "docKey") ?? "";
  const rawFile = formData.get("file");

  if (!trackingCode || guardianDocNumber.length < 5 || !ADMISSION_DOC_KEYS.includes(docKey)) {
    return { status: "error", message: "Datos del expediente inválidos." };
  }
  if (!(rawFile instanceof File) || rawFile.size === 0) {
    return { status: "error", message: "Selecciona un archivo PDF o imagen (máx. 5 MB)." };
  }

  const [app] = await db
    .select({ id: admissionApplications.id, status: admissionApplications.status })
    .from(admissionApplications)
    .where(
      and(
        eq(admissionApplications.trackingCode, trackingCode),
        eq(admissionApplications.guardianDocNumber, guardianDocNumber),
      ),
    )
    .limit(1);
  if (!app) return { status: "error", message: "No encontramos una solicitud con esos datos." };
  if (app.status === "ENROLLED" || app.status === "REJECTED") {
    return { status: "error", message: "Esta solicitud ya fue cerrada y no admite nuevos archivos." };
  }

  const stored = await savePrivateAdmissionFile(rawFile);
  if (!stored.ok) return { status: "error", message: stored.message };

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(enrollmentDocuments)
      .values({
        applicationId: app.id,
        docKey,
        status: "UPLOADED",
        storageKey: stored.storageKey,
        originalFileName: stored.originalName,
        fileSizeBytes: stored.sizeBytes,
        reviewNote: "",
        uploadedAt: now,
      })
      .onConflictDoUpdate({
        target: [enrollmentDocuments.applicationId, enrollmentDocuments.docKey],
        set: {
          status: "UPLOADED",
          storageKey: stored.storageKey,
          originalFileName: stored.originalName,
          fileSizeBytes: stored.sizeBytes,
          reviewNote: "",
          uploadedAt: now,
        },
      });

    if (app.status === "SUBMITTED") {
      await tx
        .update(admissionApplications)
        .set({ status: "DOCS_REVIEW", updatedAt: now })
        .where(eq(admissionApplications.id, app.id));
    }
  });

  refresh();
  return { status: "success", message: "Documento cargado en almacenamiento seguro para revisión de Secretaría." };
}

/** Registra referencia y comprobante de pago de matrícula (Paso 4 de `/matriculas`). */
export async function uploadAdmissionPaymentAction(
  _prev: AdmissionActionState,
  formData: FormData,
): Promise<AdmissionActionState> {
  const trackingCode = (formText(formData, "trackingCode") ?? "").trim().toUpperCase();
  const guardianDocNumber = normalizeDocumentNumber(formText(formData, "guardianDocNumber") ?? "");
  const channelRaw = formText(formData, "paymentChannel") ?? "";
  const paymentReference = sanitizeAulaText(formText(formData, "paymentReference") ?? "").slice(0, 60);

  const parsedChannel = z.enum(PAYMENT_CHANNELS).safeParse(channelRaw);
  if (!parsedChannel.success) {
    return { status: "error", message: "Selecciona el medio de pago utilizado." };
  }
  if (!trackingCode || guardianDocNumber.length < 5 || paymentReference.length < 3) {
    return { status: "error", message: "Indica la referencia o número de comprobante de pago." };
  }

  const [app] = await db
    .select({
      id: admissionApplications.id,
      status: admissionApplications.status,
      paymentReceiptKey: admissionApplications.paymentReceiptKey,
      paymentReportedAt: admissionApplications.paymentReportedAt,
      earlyBirdStatus: admissionApplications.earlyBirdStatus,
      siblingClaimStatus: admissionApplications.siblingClaimStatus,
      levelCode: levels.code,
    })
    .from(admissionApplications)
    .innerJoin(grades, eq(grades.id, admissionApplications.targetGradeId))
    .innerJoin(levels, eq(levels.id, grades.levelId))
    .where(
      and(
        eq(admissionApplications.trackingCode, trackingCode),
        eq(admissionApplications.guardianDocNumber, guardianDocNumber),
      ),
    )
    .limit(1);
  if (!app) return { status: "error", message: "Expediente no encontrado." };
  if (app.status === "ENROLLED") {
    return { status: "error", message: "Esta matrícula ya fue formalizada." };
  }

  let receiptKey = app.paymentReceiptKey;
  const rawFile = formData.get("receipt");
  if (rawFile instanceof File && rawFile.size > 0) {
    const stored = await savePrivateAdmissionFile(rawFile);
    if (!stored.ok) return { status: "error", message: stored.message };
    receiptKey = stored.storageKey;
  }

  // La PRIMERA fecha de reporte define el pronto pago (reenviar el soporte no la cambia).
  const reportedAt = app.paymentReportedAt ?? new Date();
  const earlyBird = earlyBirdOnPayment(app.earlyBirdStatus, todayInBogota(reportedAt));
  const discounts = effectiveDiscounts({ earlyBird, sibling: app.siblingClaimStatus });
  const fees = calculateAdmissionFees({ levelCode: app.levelCode, ...discounts });
  await db
    .update(admissionApplications)
    .set({
      paymentChannel: parsedChannel.data,
      paymentReference,
      paymentReceiptKey: receiptKey,
      paymentReportedAt: reportedAt,
      earlyBirdStatus: earlyBird,
      ...discounts,
      estimatedEnrollmentCop: fees.enrollmentFinal,
      estimatedMonthlyCop: fees.monthlyFinal,
      status: "PAYMENT_REVIEW",
      updatedAt: new Date(),
    })
    .where(eq(admissionApplications.id, app.id));

  refresh();
  return {
    status: "success",
    message: "Soporte de pago registrado. Secretaría validará el ingreso para formalizar la matrícula.",
  };
}

/** Revisa individualmente uno de los 8 documentos (`APPROVED` o `RESUBMIT`) — Coordinación o Secretaría. */
export async function reviewAdmissionDocumentAction(
  _prev: AdmissionActionState,
  formData: FormData,
): Promise<AdmissionActionState> {
  const actor = await requireSession();
  if (!can(actor.role, "enrollment.review")) {
    return { status: "error", message: "No tienes permiso para revisar documentos de admisión." };
  }

  const documentId = formText(formData, "documentId") ?? "";
  const decision = formText(formData, "decision");
  const reviewNote = sanitizeAulaText(formText(formData, "reviewNote") ?? "").slice(0, 300);

  if (!z.uuid().safeParse(documentId).success || (decision !== "APPROVED" && decision !== "RESUBMIT")) {
    return { status: "error", message: "Decisión de revisión inválida." };
  }
  if (decision === "RESUBMIT" && reviewNote.length < 4) {
    return { status: "error", message: "Escribe qué debe corregir la familia al solicitar subsanación." };
  }

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx
      .update(enrollmentDocuments)
      .set({
        status: decision,
        reviewNote: decision === "APPROVED" ? "" : reviewNote,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
      })
      .where(eq(enrollmentDocuments.id, documentId));

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "ADMISSION_DOC_REVIEWED",
        entityType: "enrollment_document",
        entityId: documentId,
        after: { decision, reviewNote },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return {
    status: "success",
    message: decision === "APPROVED" ? "Documento aprobado." : "Subsanación solicitada a la familia.",
  };
}

/** Aval académico (Coordinación o Secretaría) o rechazo motivado de la solicitud. */
export async function academicDecisionAction(
  _prev: AdmissionActionState,
  formData: FormData,
): Promise<AdmissionActionState> {
  const actor = await requireSession();
  if (!can(actor.role, "enrollment.approve.academic")) {
    return { status: "error", message: "No tienes permiso para emitir aval académico." };
  }

  const applicationId = formText(formData, "applicationId") ?? "";
  const decision = formText(formData, "decision");
  const reviewNotes = sanitizeAulaText(formText(formData, "reviewNotes") ?? "").slice(0, 600);

  if (!z.uuid().safeParse(applicationId).success || (decision !== "ACADEMIC_APPROVED" && decision !== "REJECTED")) {
    return { status: "error", message: "Parámetros de decisión inválidos." };
  }
  if (decision === "REJECTED" && reviewNotes.length < 5) {
    return { status: "error", message: "Indica el motivo del rechazo para trazabilidad." };
  }

  const { ip } = await getRequestMeta();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(admissionApplications)
      .set({
        status: decision,
        academicReviewedBy: actor.id,
        academicReviewedAt: now,
        reviewNotes,
        updatedAt: now,
      })
      .where(eq(admissionApplications.id, applicationId));

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "ADMISSION_ACADEMIC_APPROVED",
        entityType: "admission_application",
        entityId: applicationId,
        after: { status: decision, reviewNotes },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return {
    status: "success",
    message:
      decision === "ACADEMIC_APPROVED"
        ? "Aval académico otorgado. Lista para formalización de Secretaría."
        : "Solicitud marcada como rechazada.",
  };
}

/**
 * Formaliza la matrícula (EXCLUSIVO `ADMIN` / Secretaría y Rectoría):
 * en una transacción verifica cupo del grupo, crea/reutiliza cuentas de estudiante y
 * acudiente (generando credenciales seguras si son nuevos), vincula `guardian_links`,
 * registra `enrollments` y deja traza `ENROLLMENT_APPROVED`.
 */
export async function formalizeAdmissionAction(
  _prev: AdmissionActionState,
  formData: FormData,
): Promise<AdmissionActionState> {
  const actor = await requireSession();
  if (!can(actor.role, "enrollment.formalize")) {
    return { status: "error", message: "Solo Secretaría o Rectoría pueden formalizar matrículas." };
  }

  const applicationId = formText(formData, "applicationId") ?? "";
  const groupId = formText(formData, "groupId") ?? "";
  if (!z.uuid().safeParse(applicationId).success || !z.uuid().safeParse(groupId).success) {
    return { status: "error", message: "Selecciona un grupo válido para formalizar la matrícula." };
  }

  const [app] = await db
    .select()
    .from(admissionApplications)
    .where(eq(admissionApplications.id, applicationId))
    .limit(1);
  if (!app) return { status: "error", message: "Solicitud no encontrada." };
  if (app.status === "ENROLLED") {
    return { status: "error", message: "Esta solicitud ya fue formalizada anteriormente." };
  }

  const [targetGroup] = await db
    .select({
      id: groups.id,
      name: groups.name,
      academicYearId: groups.academicYearId,
      capacity: groups.capacity,
    })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!targetGroup) return { status: "error", message: "Grupo destino no encontrado." };

  const [enrolledCountRow] = await db
    .select({ total: count() })
    .from(enrollments)
    .where(and(eq(enrollments.groupId, targetGroup.id), eq(enrollments.status, "ACTIVE")));
  if ((enrolledCountRow?.total ?? 0) >= targetGroup.capacity) {
    return {
      status: "error",
      message: `El grupo ${targetGroup.name} alcanzó su cupo máximo (${targetGroup.capacity} estudiantes).`,
    };
  }

  const existingEmails = new Set(
    (await db.select({ email: users.email }).from(users))
      .map((u) => u.email?.toLowerCase())
      .filter((e): e is string => Boolean(e)),
  );

  const issuedCredentials: NonNullable<AdmissionActionState["issuedCredentials"]> = [];
  const { ip } = await getRequestMeta();
  const now = new Date();

  const [activeYear] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(eq(academicYears.id, targetGroup.academicYearId))
    .limit(1);
  if (!activeYear) return { status: "error", message: "Año lectivo no encontrado." };

  await db.transaction(async (tx) => {
    // 1. Estudiante: reutiliza por documento o crea cuenta nueva con contraseña institucional
    let [student] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.documentNumber, app.studentDocNumber))
      .limit(1);

    if (!student) {
      const studentEmail = generateInstitutionalEmail(
        app.studentFirstName,
        app.studentLastName,
        app.studentDocNumber,
        existingEmails,
      );
      const rawPassword = generateInstitutionalPassword(
        app.studentFirstName,
        app.studentLastName,
        app.studentDocNumber,
      );
      const [createdStudent] = await tx
        .insert(users)
        .values({
          documentType: app.studentDocType,
          documentNumber: app.studentDocNumber,
          email: studentEmail,
          passwordHash: await hashPassword(rawPassword),
          firstName: app.studentFirstName,
          lastName: app.studentLastName,
          role: "STUDENT",
          isActive: true,
        })
        .returning({ id: users.id });
      student = createdStudent!;
      issuedCredentials.push({
        role: "Estudiante",
        fullName: `${app.studentFirstName} ${app.studentLastName}`,
        email: studentEmail,
        documentNumber: app.studentDocNumber,
        password: rawPassword,
      });
    }

    // 2. Acudiente: reutiliza por documento o crea cuenta nueva
    let [guardian] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.documentNumber, app.guardianDocNumber))
      .limit(1);

    if (!guardian) {
      const guardianEmail = existingEmails.has(app.guardianEmail.toLowerCase())
        ? generateInstitutionalEmail(
            app.guardianFirstName,
            app.guardianLastName,
            app.guardianDocNumber,
            existingEmails,
          )
        : app.guardianEmail.toLowerCase();
      existingEmails.add(guardianEmail);
      const rawPassword = generateInstitutionalPassword(
        app.guardianFirstName,
        app.guardianLastName,
        app.guardianDocNumber,
      );
      const [createdGuardian] = await tx
        .insert(users)
        .values({
          documentType: app.guardianDocType,
          documentNumber: app.guardianDocNumber,
          email: guardianEmail,
          passwordHash: await hashPassword(rawPassword),
          firstName: app.guardianFirstName,
          lastName: app.guardianLastName,
          role: "GUARDIAN",
          phone: app.guardianPhone,
          isActive: true,
        })
        .returning({ id: users.id });
      guardian = createdGuardian!;
      issuedCredentials.push({
        role: "Acudiente",
        fullName: `${app.guardianFirstName} ${app.guardianLastName}`,
        email: guardianEmail,
        documentNumber: app.guardianDocNumber,
        password: rawPassword,
      });
    }

    // 3. Vínculo familiar
    await tx
      .insert(guardianLinks)
      .values({
        guardianId: guardian.id,
        studentId: student.id,
        relationship: "ACUDIENTE",
        isFinancialResponsible: true,
        canPickUp: true,
      })
      .onConflictDoNothing();

    // 4. Matrícula oficial en el grupo seleccionado
    const [enrollment] = await tx
      .insert(enrollments)
      .values({
        studentId: student.id,
        academicYearId: targetGroup.academicYearId,
        groupId: targetGroup.id,
        status: "ACTIVE",
        enrollmentType: app.applicationType,
        enrolledAt: now,
      })
      .onConflictDoUpdate({
        target: [enrollments.studentId, enrollments.academicYearId],
        set: {
          groupId: targetGroup.id,
          status: "ACTIVE",
          enrollmentType: app.applicationType,
        },
      })
      .returning({ id: enrollments.id });

    // 5. Actualizar solicitud como formalizada
    await tx
      .update(admissionApplications)
      .set({
        status: "ENROLLED",
        existingStudentId: student.id,
        existingGuardianId: guardian.id,
        assignedGroupId: targetGroup.id,
        formalizedEnrollmentId: enrollment!.id,
        formalizedBy: actor.id,
        formalizedAt: now,
        paymentVerifiedAt: app.paymentVerifiedAt ?? now,
        updatedAt: now,
      })
      .where(eq(admissionApplications.id, app.id));

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "ENROLLMENT_APPROVED",
        entityType: "admission_application",
        entityId: app.id,
        after: {
          trackingCode: app.trackingCode,
          groupId: targetGroup.id,
          enrollmentId: enrollment!.id,
          newAccountsCreated: issuedCredentials.length,
        },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return {
    status: "success",
    message: `¡Matrícula formalizada en el grupo ${targetGroup.name}!${
      issuedCredentials.length > 0 ? " Se generaron las credenciales de acceso abajo." : ""
    }`,
    issuedCredentials,
  };
}

/**
 * Secretaría aprueba o rechaza un descuento de hermanos que quedó en revisión.
 * Recalcula el valor a pagar y deja registro en la auditoría.
 */
export async function reviewSiblingDiscountAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("enrollment.formalize");
  const parsed = z
    .object({ applicationId: z.uuid(), decision: z.enum(["VERIFIED", "REJECTED"]) })
    .safeParse({ applicationId: formText(formData, "applicationId"), decision: formText(formData, "decision") });
  if (!parsed.success) return;
  const { applicationId, decision } = parsed.data;

  const [app] = await db
    .select({
      earlyBirdStatus: admissionApplications.earlyBirdStatus,
      siblingClaimStatus: admissionApplications.siblingClaimStatus,
      status: admissionApplications.status,
      levelCode: levels.code,
    })
    .from(admissionApplications)
    .innerJoin(grades, eq(grades.id, admissionApplications.targetGradeId))
    .innerJoin(levels, eq(levels.id, grades.levelId))
    .where(eq(admissionApplications.id, applicationId))
    .limit(1);
  if (!app || app.status === "ENROLLED" || app.siblingClaimStatus === "NOT_REQUESTED") return;

  const discounts = effectiveDiscounts({ earlyBird: app.earlyBirdStatus, sibling: decision });
  const fees = calculateAdmissionFees({ levelCode: app.levelCode, ...discounts });
  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx
      .update(admissionApplications)
      .set({
        siblingClaimStatus: decision,
        siblingReviewedBy: actor.id,
        siblingReviewedAt: new Date(),
        ...discounts,
        estimatedEnrollmentCop: fees.enrollmentFinal,
        estimatedMonthlyCop: fees.monthlyFinal,
        updatedAt: new Date(),
      })
      .where(eq(admissionApplications.id, applicationId));
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "ADMISSION_DISCOUNT_REVIEWED",
        entityType: "admission_application",
        entityId: applicationId,
        before: { sibling: app.siblingClaimStatus },
        after: { sibling: decision, monthlyCop: fees.monthlyFinal },
        ipAddress: ip,
      },
      tx,
    );
  });
  refresh();
}
