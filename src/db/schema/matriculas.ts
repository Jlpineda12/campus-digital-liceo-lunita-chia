import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { EARLY_BIRD_STATUSES, SIBLING_CLAIM_STATUSES } from "@/modules/matriculas/discount-policy";
import { createdAt, id, isoDate, timestamptz } from "./_helpers";
import { academicYears, grades, groups, users } from "./core";
import { documentType, enrollmentType } from "./enums";
import { enrollments } from "./siga";

/* ---------------------------------------------------------------------------
   Fase 4: Admisiones / Matrículas en Línea y Cartera Escolar
   --------------------------------------------------------------------------- */

export const ADMISSION_STATUSES = [
  "SUBMITTED",
  "DOCS_REVIEW",
  "ACADEMIC_APPROVED",
  "PAYMENT_REVIEW",
  "ENROLLED",
  "REJECTED",
] as const;
export type AdmissionStatus = (typeof ADMISSION_STATUSES)[number];
export const admissionStatus = pgEnum("admission_status", ADMISSION_STATUSES);

/** Estados verificables de los descuentos (ver modules/matriculas/discount-policy.ts). */
export const earlyBirdStatus = pgEnum("early_bird_status", EARLY_BIRD_STATUSES);
export const siblingClaimStatus = pgEnum("sibling_claim_status", SIBLING_CLAIM_STATUSES);

export const ADMISSION_DOC_STATUSES = [
  "PENDING",
  "UPLOADED",
  "APPROVED",
  "RESUBMIT",
] as const;
export type AdmissionDocStatus = (typeof ADMISSION_DOC_STATUSES)[number];
export const admissionDocStatus = pgEnum("admission_doc_status", ADMISSION_DOC_STATUSES);

export const BILLING_CHARGE_TYPES = [
  "ENROLLMENT_FEE",
  "TUITION",
  "TRANSPORT",
  "OTHER",
] as const;
export type BillingChargeType = (typeof BILLING_CHARGE_TYPES)[number];
export const billingChargeType = pgEnum("billing_charge_type", BILLING_CHARGE_TYPES);

export const BILLING_CHARGE_STATUSES = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "WAIVED",
] as const;
export type BillingChargeStatus = (typeof BILLING_CHARGE_STATUSES)[number];
export const billingChargeStatus = pgEnum("billing_charge_status", BILLING_CHARGE_STATUSES);

export const PAYMENT_CHANNELS = [
  "NEQUI",
  "DAVIPLATA",
  "BRE_B",
  "PSE",
  "BANK_TRANSFER",
  "CASH_OFFICE",
] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];
export const paymentChannel = pgEnum("payment_channel", PAYMENT_CHANNELS);

/** Solicitud de matrícula (Familia Nueva o Renovación) con consentimiento Ley 1581. */
export const admissionApplications = pgTable(
  "admission_applications",
  {
    id: id(),
    /** Código legible de seguimiento (ej. ADM-2027-4821). */
    trackingCode: text("tracking_code").notNull().unique(),
    targetYear: smallint("target_year").notNull().default(2027),
    applicationType: enrollmentType("application_type").notNull(),
    status: admissionStatus("status").notNull().default("SUBMITTED"),
    targetGradeId: uuid("target_grade_id")
      .notNull()
      .references(() => grades.id),
    /** Usuario estudiante existente cuando es Renovación (o creado al formalizar). */
    existingStudentId: uuid("existing_student_id").references(() => users.id, { onDelete: "set null" }),
    existingGuardianId: uuid("existing_guardian_id").references(() => users.id, { onDelete: "set null" }),
    // Datos del aspirante / estudiante
    studentFirstName: text("student_first_name").notNull(),
    studentLastName: text("student_last_name").notNull(),
    studentDocType: documentType("student_doc_type").notNull(),
    studentDocNumber: text("student_doc_number").notNull(),
    studentBirthDate: isoDate("student_birth_date"),
    studentEps: text("student_eps").notNull().default(""),
    studentBloodType: text("student_blood_type").notNull().default(""),
    previousSchool: text("previous_school").notNull().default(""),
    // Datos del acudiente / responsable financiero
    guardianFirstName: text("guardian_first_name").notNull(),
    guardianLastName: text("guardian_last_name").notNull(),
    guardianDocType: documentType("guardian_doc_type").notNull(),
    guardianDocNumber: text("guardian_doc_number").notNull(),
    guardianEmail: text("guardian_email").notNull(),
    guardianPhone: text("guardian_phone").notNull(),
    address: text("address").notNull().default(""),
    // Descuentos: estado verificable + bandera efectiva derivada (nunca autodeclarada)
    earlyBirdStatus: earlyBirdStatus("early_bird_status").notNull().default("NOT_ELIGIBLE"),
    siblingClaimStatus: siblingClaimStatus("sibling_claim_status").notNull().default("NOT_REQUESTED"),
    /** Documento del hermano(a) que declara la familia. */
    siblingReferenceDoc: text("sibling_reference_doc"),
    /** Evidencia para Secretaría (no se muestra a la familia). */
    siblingVerificationNote: text("sibling_verification_note"),
    siblingReviewedBy: uuid("sibling_reviewed_by").references(() => users.id, { onDelete: "set null" }),
    siblingReviewedAt: timestamptz("sibling_reviewed_at"),
    hasSiblingDiscount: boolean("has_sibling_discount").notNull().default(false),
    hasEarlyBirdDiscount: boolean("has_early_bird_discount").notNull().default(false),
    estimatedEnrollmentCop: integer("estimated_enrollment_cop").notNull().default(0),
    estimatedMonthlyCop: integer("estimated_monthly_cop").notNull().default(0),
    // Consentimiento Ley 1581 (Habeas Data de menores)
    habeasDataAcceptedAt: timestamptz("habeas_data_accepted_at").notNull(),
    habeasDataIp: text("habeas_data_ip"),
    habeasDataVersion: text("habeas_data_version").notNull().default("2026-v1"),
    // Soporte de pago de matrícula (almacenamiento privado)
    paymentChannel: paymentChannel("payment_channel"),
    paymentReference: text("payment_reference"),
    paymentReceiptKey: text("payment_receipt_key"),
    /** Fecha en que la familia reportó el pago: define si el pronto pago se confirma. */
    paymentReportedAt: timestamptz("payment_reported_at"),
    paymentVerifiedAt: timestamptz("payment_verified_at"),
    // Revisión Coordinación y Formalización Secretaría
    academicReviewedBy: uuid("academic_reviewed_by").references(() => users.id, { onDelete: "set null" }),
    academicReviewedAt: timestamptz("academic_reviewed_at"),
    reviewNotes: text("review_notes").notNull().default(""),
    assignedGroupId: uuid("assigned_group_id").references(() => groups.id, { onDelete: "set null" }),
    formalizedEnrollmentId: uuid("formalized_enrollment_id").references(() => enrollments.id, {
      onDelete: "set null",
    }),
    formalizedBy: uuid("formalized_by").references(() => users.id, { onDelete: "set null" }),
    formalizedAt: timestamptz("formalized_at"),
    createdAt: createdAt(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("admission_applications_status_idx").on(t.status, t.createdAt),
    index("admission_applications_guardian_doc_idx").on(t.guardianDocNumber),
    index("admission_applications_student_doc_idx").on(t.studentDocNumber),
  ],
);

/** Bitácora real de los 8 documentos obligatorios de matrícula por solicitud. */
export const enrollmentDocuments = pgTable(
  "enrollment_documents",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => admissionApplications.id, { onDelete: "cascade" }),
    docKey: text("doc_key").notNull(),
    status: admissionDocStatus("status").notNull().default("PENDING"),
    storageKey: text("storage_key"),
    originalFileName: text("original_file_name"),
    fileSizeBytes: integer("file_size_bytes"),
    reviewNote: text("review_note").notNull().default(""),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamptz("reviewed_at"),
    uploadedAt: timestamptz("uploaded_at"),
  },
  (t) => [uniqueIndex("enrollment_documents_app_key_uq").on(t.applicationId, t.docKey)],
);

/* ---------------------------------------------------------------------------
   Cartera y Pagos Escolares (SIGA Financiero)
   --------------------------------------------------------------------------- */

export const billingCharges = pgTable(
  "billing_charges",
  {
    id: id(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    chargeType: billingChargeType("charge_type").notNull(),
    /** 0 = Matrícula, 2..11 = Febrero..Noviembre */
    billingMonth: smallint("billing_month").notNull().default(0),
    concept: text("concept").notNull(),
    amountCop: integer("amount_cop").notNull(),
    discountCop: integer("discount_cop").notNull().default(0),
    paidCop: integer("paid_cop").notNull().default(0),
    dueDate: isoDate("due_date").notNull(),
    status: billingChargeStatus("status").notNull().default("PENDING"),
    createdAt: createdAt(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("billing_charges_enrollment_concept_uq").on(
      t.enrollmentId,
      t.chargeType,
      t.billingMonth,
    ),
    index("billing_charges_year_status_idx").on(t.academicYearId, t.status),
    index("billing_charges_enrollment_idx").on(t.enrollmentId, t.dueDate),
  ],
);

export const billingPayments = pgTable(
  "billing_payments",
  {
    id: id(),
    chargeId: uuid("charge_id")
      .notNull()
      .references(() => billingCharges.id, { onDelete: "cascade" }),
    amountCop: integer("amount_cop").notNull(),
    channel: paymentChannel("channel").notNull(),
    referenceCode: text("reference_code").notNull(),
    receiptNumber: text("receipt_number").notNull().unique(),
    notes: text("notes").notNull().default(""),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    paidAt: timestamptz("paid_at").notNull().defaultNow(),
  },
  (t) => [index("billing_payments_charge_idx").on(t.chargeId, t.paidAt)],
);
