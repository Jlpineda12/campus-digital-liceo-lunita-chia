import type { LevelCode } from "@/modules/core/academic-structure/constants";
import type {
  AdmissionDocStatus,
  AdmissionStatus,
  BillingChargeStatus,
  PaymentChannel,
} from "@/db/schema/matriculas";

/**
 * Catálogo puro de Matrículas 2027 (bitácora de 8 documentos, tabla de costos
 * por nivel y descuentos transparentes).
 */

export const ENROLLMENT_TYPES = ["NEW", "RENEWAL"] as const;
export type EnrollmentType = (typeof ENROLLMENT_TYPES)[number];

export interface AdmissionDocSpec {
  key: string;
  label: string;
  description: string;
  requiredFor: readonly LevelCode[];
}

export const ADMISSION_DOCUMENTS: readonly AdmissionDocSpec[] = [
  {
    key: "registro_civil",
    label: "Registro civil o Tarjeta de identidad",
    description: "Copia legible por ambas caras del documento del estudiante.",
    requiredFor: ["PREESCOLAR", "PRIMARIA", "BACHILLERATO"],
  },
  {
    key: "documento_acudiente",
    label: "Documento del acudiente principal",
    description: "Cédula de ciudadanía o extranjería del responsable financiero.",
    requiredFor: ["PREESCOLAR", "PRIMARIA", "BACHILLERATO"],
  },
  {
    key: "certificado_eps",
    label: "Certificado de afiliación a EPS",
    description: "Certificado vigente de salud (expedición menor a 30 días).",
    requiredFor: ["PREESCOLAR", "PRIMARIA", "BACHILLERATO"],
  },
  {
    key: "boletin_anterior",
    label: "Último boletín o certificado de notas",
    description: "Requerido para ingreso o traslado a Primaria y Bachillerato.",
    requiredFor: ["PRIMARIA", "BACHILLERATO"],
  },
  {
    key: "carnet_vacunas",
    label: "Carné de vacunación actualizado",
    description: "Esquema PAI al día (obligatorio para Preescolar y Primaria).",
    requiredFor: ["PREESCOLAR", "PRIMARIA"],
  },
  {
    key: "certificado_medico",
    label: "Certificado médico y tamizaje visual",
    description: "Valoración médica general de aptitud escolar.",
    requiredFor: ["PREESCOLAR", "PRIMARIA", "BACHILLERATO"],
  },
  {
    key: "foto_estudiante",
    label: "Fotografía reciente del estudiante",
    description: "Foto tipo documento en fondo azul claro o blanco (PNG/JPG).",
    requiredFor: ["PREESCOLAR", "PRIMARIA", "BACHILLERATO"],
  },
  {
    key: "paz_y_salvo_anterior",
    label: "Paz y salvo institución anterior",
    description: "Aplica para traslados o renovación interna del año anterior.",
    requiredFor: ["PREESCOLAR", "PRIMARIA", "BACHILLERATO"],
  },
] as const;

export const ADMISSION_DOC_KEYS = ADMISSION_DOCUMENTS.map((d) => d.key);

export const FEE_SCHEDULE_2027: Record<LevelCode, { enrollmentCop: number; monthlyCop: number }> = {
  PREESCOLAR: { enrollmentCop: 780_000, monthlyCop: 560_000 },
  PRIMARIA: { enrollmentCop: 860_000, monthlyCop: 620_000 },
  BACHILLERATO: { enrollmentCop: 940_000, monthlyCop: 690_000 },
};

export const EARLY_BIRD_DISCOUNT_RATE = 0.1; // 10% en matrícula
export const SIBLING_DISCOUNT_RATE = 0.08; // 8% en pensión mensual

export interface FeeCalculation {
  enrollmentBase: number;
  enrollmentDiscount: number;
  enrollmentFinal: number;
  monthlyBase: number;
  monthlyDiscount: number;
  monthlyFinal: number;
}

/** Calcula costos transparentes de matrícula y pensión con descuentos aplicables. */
export function calculateAdmissionFees(options: {
  levelCode: LevelCode;
  hasEarlyBirdDiscount?: boolean;
  hasSiblingDiscount?: boolean;
}): FeeCalculation {
  const base = FEE_SCHEDULE_2027[options.levelCode];
  const enrollmentDiscount = options.hasEarlyBirdDiscount
    ? Math.round(base.enrollmentCop * EARLY_BIRD_DISCOUNT_RATE)
    : 0;
  const monthlyDiscount = options.hasSiblingDiscount
    ? Math.round(base.monthlyCop * SIBLING_DISCOUNT_RATE)
    : 0;

  return {
    enrollmentBase: base.enrollmentCop,
    enrollmentDiscount,
    enrollmentFinal: base.enrollmentCop - enrollmentDiscount,
    monthlyBase: base.monthlyCop,
    monthlyDiscount,
    monthlyFinal: base.monthlyCop - monthlyDiscount,
  };
}

export function formatCop(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateTrackingCode(targetYear = 2027): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]!;
  }
  return `ADM-${targetYear}-${suffix}`;
}

export const ADMISSION_STATUS_META: Record<
  AdmissionStatus,
  { label: string; tone: "sky" | "orange" | "purple" | "blue" | "green" | "red" }
> = {
  SUBMITTED: { label: "Radicada", tone: "sky" },
  DOCS_REVIEW: { label: "Revisión documental", tone: "orange" },
  ACADEMIC_APPROVED: { label: "Aval académico", tone: "purple" },
  PAYMENT_REVIEW: { label: "Pago por validar", tone: "blue" },
  ENROLLED: { label: "Matriculada", tone: "green" },
  REJECTED: { label: "Rechazada", tone: "red" },
};

export const ADMISSION_DOC_STATUS_META: Record<
  AdmissionDocStatus,
  { label: string; tone: "sky" | "orange" | "green" | "red" }
> = {
  PENDING: { label: "Pendiente", tone: "orange" },
  UPLOADED: { label: "En revisión", tone: "sky" },
  APPROVED: { label: "Aprobado", tone: "green" },
  RESUBMIT: { label: "Subsanar", tone: "red" },
};

export const PAYMENT_CHANNEL_LABELS: Record<PaymentChannel, string> = {
  NEQUI: "Nequi",
  DAVIPLATA: "Daviplata",
  BRE_B: "Bre-B (Llave instantánea)",
  PSE: "PSE / Botón bancario",
  BANK_TRANSFER: "Transferencia bancaria",
  CASH_OFFICE: "Tesorería del colegio",
};

export const BILLING_STATUS_META: Record<
  BillingChargeStatus,
  { label: string; tone: "green" | "orange" | "sky" | "red" }
> = {
  PAID: { label: "Pagado", tone: "green" },
  PARTIAL: { label: "Abono parcial", tone: "sky" },
  PENDING: { label: "Pendiente", tone: "orange" },
  OVERDUE: { label: "En mora", tone: "red" },
  WAIVED: { label: "Exonerado", tone: "green" },
};
