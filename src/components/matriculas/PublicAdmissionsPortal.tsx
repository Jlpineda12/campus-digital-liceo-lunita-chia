"use client";

import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { AdmissionApplyWizard } from "@/components/matriculas/AdmissionApplyWizard";
import { Chip } from "@/components/ui/Chip";
import { pillButtonClass } from "@/components/ui/PillButton";
import { emitToast } from "@/components/ui/ToastViewport";
import { PAYMENT_CHANNELS } from "@/db/schema/matriculas";
import type { Tone } from "@/modules/core/auth/roles";
import {
  createAdmissionApplicationAction,
  uploadAdmissionDocumentAction,
  uploadAdmissionPaymentAction,
  type AdmissionActionState,
} from "@/modules/matriculas/actions";
import {
  ADMISSION_DOC_STATUS_META,
  ADMISSION_STATUS_META,
  formatCop,
  PAYMENT_CHANNEL_LABELS,
} from "@/modules/matriculas/catalog";
import {
  EARLY_BIRD_LABELS,
  SIBLING_LABELS,
  type EarlyBirdStatus,
  type SiblingClaimStatus,
} from "@/modules/matriculas/discount-policy";
import type {
  AdmissionApplicationDetail,
  AdmissionDocView,
  PublicGradeOption,
  RenewalChildCandidate,
} from "@/modules/matriculas/queries";

const INITIAL: AdmissionActionState = { status: "idle" };

function DocumentUploadRow({
  doc,
  trackingCode,
  guardianDocNumber,
  locked,
}: {
  doc: AdmissionDocView;
  trackingCode: string;
  guardianDocNumber: string;
  locked: boolean;
}) {
  const [state, action, pending] = useActionState(uploadAdmissionDocumentAction, INITIAL);
  const meta = ADMISSION_DOC_STATUS_META[doc.status];
  const fileId = useId();

  useEffect(() => {
    if (state.status === "success" && state.message) {
      emitToast({ title: "Documento guardado", description: state.message, tone: "success" });
    } else if (state.status === "error" && state.message) {
      emitToast({ title: "No pudimos subir el documento", description: state.message, tone: "error" });
    }
  }, [state]);

  return (
    <li className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-navy">{doc.label}</p>
          <Chip tone={meta.tone}>{meta.label}</Chip>
          {!doc.required && (
            <span className="rounded-pill bg-bg-2 px-2 py-0.5 text-[0.68rem] font-semibold text-muted">
              Opcional para este nivel
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">{doc.description}</p>
        {doc.reviewNote && (
          <p className="mt-1.5 rounded-control bg-red-l/60 px-3 py-1.5 text-xs font-semibold text-red-solid">
            Observación Secretaría: {doc.reviewNote}
          </p>
        )}
        {state.message && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`mt-1 text-xs font-semibold ${
              state.status === "error" ? "text-red-solid" : "text-green-solid"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {doc.hasFile && (
          <a
            href={`/api/matriculas/documentos?tipo=doc&id=${doc.id}&radicado=${encodeURIComponent(trackingCode)}&doc=${encodeURIComponent(guardianDocNumber)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-control border border-line-2 bg-white px-3 py-2 text-xs font-bold text-navy no-underline hover:bg-cloud"
          >
            <FileText className="size-3.5 text-cobalt" aria-hidden /> Ver archivo
          </a>
        )}
        {!locked && doc.status !== "APPROVED" && (
          <form action={action} className="flex items-center gap-2">
            <input type="hidden" name="trackingCode" value={trackingCode} />
            <input type="hidden" name="guardianDocNumber" value={guardianDocNumber} />
            <input type="hidden" name="docKey" value={doc.docKey} />
            <label
              htmlFor={fileId}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-cobalt/35 bg-cloud px-3.5 py-2 text-xs font-bold text-cobalt transition-colors hover:bg-cobalt hover:text-white"
            >
              <Upload className="size-3.5" aria-hidden />
              {pending ? "Subiendo…" : doc.hasFile ? "Reemplazar" : "Subir archivo"}
            </label>
            <input
              id={fileId}
              name="file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              disabled={pending}
              onChange={(e) => {
                if (e.currentTarget.files?.length) e.currentTarget.form?.requestSubmit();
              }}
              className="sr-only"
            />
          </form>
        )}
      </div>
    </li>
  );
}

const EARLY_BIRD_TONE: Record<EarlyBirdStatus, Tone> = {
  NOT_ELIGIBLE: "sky",
  ELIGIBLE: "blue",
  CONFIRMED: "green",
  EXPIRED: "orange",
};
const SIBLING_TONE: Record<SiblingClaimStatus, Tone> = {
  NOT_REQUESTED: "sky",
  VERIFIED: "green",
  PENDING_REVIEW: "orange",
  REJECTED: "red",
};

/** Estado de los beneficios con lenguaje neutro (nunca revela datos de otros estudiantes). */
function BenefitChips({ benefits }: { benefits: { earlyBird: EarlyBirdStatus; sibling: SiblingClaimStatus } }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-bold text-muted">Beneficios:</span>
      <Chip tone={EARLY_BIRD_TONE[benefits.earlyBird]}>Pronto pago · {EARLY_BIRD_LABELS[benefits.earlyBird]}</Chip>
      {benefits.sibling !== "NOT_REQUESTED" && (
        <Chip tone={SIBLING_TONE[benefits.sibling]}>Hermanos · {SIBLING_LABELS[benefits.sibling]}</Chip>
      )}
    </div>
  );
}

/** Portal interactivo de Admisiones y Matrícula en Línea 2027 (`/matriculas`). */
export function PublicAdmissionsPortal({
  grades,
  renewalCandidates,
  isLoggedGuardian,
  lookedUpApp,
  lookupQuery,
  today,
}: {
  grades: PublicGradeOption[];
  renewalCandidates: RenewalChildCandidate[];
  isLoggedGuardian: boolean;
  lookedUpApp: AdmissionApplicationDetail | null;
  lookupQuery: { radicado: string; doc: string };
  /** Fecha de hoy en Bogotá (YYYY-MM-DD), calculada en servidor para evitar desfases. */
  today: string;
}) {
  const [mode, setMode] = useState<"apply" | "track">(
    lookedUpApp || lookupQuery.radicado ? "track" : "apply",
  );

  const [createState, createAction, creating] = useActionState(createAdmissionApplicationAction, INITIAL);
  const [payState, payAction, paying] = useActionState(uploadAdmissionPaymentAction, INITIAL);

  useEffect(() => {
    if (createState.status === "success" && createState.trackingCode) {
      emitToast({
        title: "Solicitud radicada",
        description: `Tu código es ${createState.trackingCode}.`,
        tone: "success",
      });
    } else if (createState.status === "error" && createState.message) {
      emitToast({ title: "Revisa el formulario", description: createState.message, tone: "error" });
    }
  }, [createState]);

  useEffect(() => {
    if (payState.status === "success" && payState.message) {
      emitToast({ title: "Comprobante enviado", description: payState.message, tone: "success" });
    } else if (payState.status === "error" && payState.message) {
      emitToast({ title: "No pudimos enviar el soporte", description: payState.message, tone: "error" });
    }
  }, [payState]);

  const id = useId();
  const uploadedCount = lookedUpApp
    ? lookedUpApp.documents.filter((d) => d.hasFile || d.status === "APPROVED").length
    : 0;
  const approvedCount = lookedUpApp
    ? lookedUpApp.documents.filter((d) => d.status === "APPROVED").length
    : 0;
  const progressPct = Math.round((uploadedCount / 8) * 100);

  return (
    <div className="grid gap-6">
      {/* Barra flotante de navegación de modo + acceso renovación */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-2.5 shadow-md">
        <nav aria-label="Modo del portal de matrículas" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setMode("apply")}
            aria-current={mode === "apply" ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              mode === "apply"
                ? "bg-cobalt text-white shadow-xs"
                : "text-navy hover:bg-cloud"
            }`}
          >
            <Sparkles className="size-4" aria-hidden />
            Nueva solicitud / Renovación
          </button>
          <button
            type="button"
            onClick={() => setMode("track")}
            aria-current={mode === "track" ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              mode === "track"
                ? "bg-cobalt text-white shadow-xs"
                : "text-navy hover:bg-cloud"
            }`}
          >
            <FileCheck2 className="size-4" aria-hidden />
            Subir 8 documentos / Consultar radicado
          </button>
        </nav>

        {!isLoggedGuardian && (
          <Link
            href="/login?rol=padres&next=/matriculas"
            className="inline-flex items-center gap-1.5 rounded-xl border border-cobalt/25 bg-cloud/80 px-3.5 py-2 text-xs font-bold text-cobalt no-underline transition-colors hover:bg-cobalt hover:text-white"
          >
            <UserCheck className="size-3.5" aria-hidden />
            Soy familia Lunita (precargar datos)
          </Link>
        )}
      </div>

      {/* Confirmación inmediata tras radicar */}
      {createState.status === "success" && createState.trackingCode && createState.guardianDocNumber && (
        <div className="rounded-2xl border border-green-solid/35 bg-green-l/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-green-solid uppercase">
                <CheckCircle2 className="size-4" aria-hidden /> Solicitud radicada correctamente
              </p>
              <h2 className="mt-1 text-2xl font-black text-navy">
                Radicado: <span className="font-mono text-cobalt">{createState.trackingCode}</span>
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                Guarda este código. Ahora abre tu expediente para subir los 8 documentos y el comprobante de pago.
              </p>
              {createState.benefits && <BenefitChips benefits={createState.benefits} />}
            </div>
            <Link
              href={`/matriculas?radicado=${encodeURIComponent(createState.trackingCode)}&doc=${encodeURIComponent(createState.guardianDocNumber)}`}
              className={pillButtonClass({ variant: "navy" })}
            >
              Abrir mi bitácora de documentos <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      )}

      {mode === "apply" && (
        <AdmissionApplyWizard
          key={createState.trackingCode ?? "borrador"}
          grades={grades}
          renewalCandidates={renewalCandidates}
          isLoggedGuardian={isLoggedGuardian}
          today={today}
          createAction={createAction}
          createState={createState}
          creating={creating}
        />
      )}

      {/* =================================================================
          MODO 2: CONSULTA DE RADICADO + BITÁCORA DE LOS 8 DOCUMENTOS + PAGO
         ================================================================= */}
      {mode === "track" && (
        <div className="grid gap-6">
          <form
            method="get"
            action="/matriculas"
            className="grid gap-4 rounded-2xl border border-line bg-white p-6 shadow-xs sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <div>
              <label htmlFor={`${id}-q-code`} className="field-label">Código de radicado</label>
              <input
                id={`${id}-q-code`}
                name="radicado"
                required
                defaultValue={lookupQuery.radicado}
                placeholder="Ej. ADM-2027-DEMO01"
                className="input mt-1 min-h-11 font-mono text-sm uppercase"
              />
            </div>
            <div>
              <label htmlFor={`${id}-q-doc`} className="field-label">Documento del acudiente</label>
              <input
                id={`${id}-q-doc`}
                name="doc"
                required
                defaultValue={lookupQuery.doc}
                placeholder="Número sin puntos"
                className="input mt-1 min-h-11 text-sm tabular"
              />
            </div>
            <button type="submit" className={pillButtonClass({ variant: "navy" })}>
              <Search aria-hidden /> Consultar expediente
            </button>
          </form>

          {!lookupQuery.radicado && !lookedUpApp && (
            <div className="rounded-2xl border border-dashed border-cobalt/30 bg-white p-8 text-center">
              <Users className="mx-auto size-10 text-cobalt/75" aria-hidden />
              <h2 className="mt-3 text-base font-extrabold text-navy">Consulta tu expediente de admisión</h2>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted">
                Ingresa el código de radicado que recibiste al registrar la solicitud junto con el número de documento
                del acudiente para subir los 8 documentos o reportar el comprobante de pago.
              </p>
            </div>
          )}

          {lookupQuery.radicado && !lookedUpApp && (
            <div className="rounded-2xl border border-orange-solid/40 bg-orange-l/50 p-5 text-sm font-semibold text-navy">
              No encontramos una solicitud que coincida con ese código de radicado y documento del acudiente.
              Verifica los datos o radica una nueva solicitud.
            </div>
          )}

          {lookedUpApp && (
            <div className="grid gap-6">
              {/* Resumen del expediente */}
              <section className="grid gap-4 rounded-2xl border border-line bg-white p-6 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <p className="font-mono text-xs font-extrabold text-cobalt">{lookedUpApp.trackingCode}</p>
                    <h2 className="mt-0.5 text-xl font-black text-navy">
                      {lookedUpApp.studentFirstName} {lookedUpApp.studentLastName} · {lookedUpApp.targetGradeName}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Acudiente: {lookedUpApp.guardianFirstName} {lookedUpApp.guardianLastName} · Matrícula estimada:{" "}
                      <strong className="text-navy">{formatCop(lookedUpApp.estimatedEnrollmentCop)}</strong>
                    </p>
                  </div>
                  <Chip tone={ADMISSION_STATUS_META[lookedUpApp.status].tone}>
                    {ADMISSION_STATUS_META[lookedUpApp.status].label}
                  </Chip>
                </div>

                <BenefitChips
                  benefits={{ earlyBird: lookedUpApp.earlyBirdStatus, sibling: lookedUpApp.siblingClaimStatus }}
                />

                {lookedUpApp.reviewNotes && (
                  <p className="rounded-xl bg-cloud px-4 py-3 text-xs font-semibold text-navy">
                    Nota institucional: {lookedUpApp.reviewNotes}
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-line bg-bg-2/60 px-4 py-3">
                    <p className="text-[0.68rem] font-bold text-muted uppercase">Documentos cargados</p>
                    <p className="mt-1 text-xl font-black text-navy tabular">{uploadedCount} / 8</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-cobalt" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-line bg-bg-2/60 px-4 py-3">
                    <p className="text-[0.68rem] font-bold text-muted uppercase">Aprobados por Secretaría</p>
                    <p className="mt-1 text-xl font-black text-green-solid tabular">{approvedCount} / 8</p>
                  </div>
                  <div className="rounded-xl border border-line bg-bg-2/60 px-4 py-3">
                    <p className="text-[0.68rem] font-bold text-muted uppercase">Soporte de pago</p>
                    <p className="mt-1 text-sm font-extrabold text-navy">
                      {lookedUpApp.paymentReference
                        ? `${lookedUpApp.paymentChannel ? PAYMENT_CHANNEL_LABELS[lookedUpApp.paymentChannel] : ""} · Ref. ${lookedUpApp.paymentReference}`
                        : "Pendiente por reportar"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Bitácora real de los 8 documentos */}
              <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-[#F8FAFF] px-5 py-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-cobalt" aria-hidden />
                    <h3 className="text-base font-extrabold text-navy">Bitácora de los 8 documentos de admisión</h3>
                  </div>
                  <span className="text-xs font-semibold text-muted">PDF, PNG o JPG · Máx. 5 MB por archivo</span>
                </div>
                <ul className="divide-y divide-line">
                  {lookedUpApp.documents.map((doc) => (
                    <DocumentUploadRow
                      key={doc.docKey}
                      doc={doc}
                      trackingCode={lookedUpApp.trackingCode}
                      guardianDocNumber={lookedUpApp.guardianDocNumber}
                      locked={lookedUpApp.status === "ENROLLED" || lookedUpApp.status === "REJECTED"}
                    />
                  ))}
                </ul>
              </section>

              {/* Paso 4: Reportar comprobante de pago */}
              {lookedUpApp.status !== "ENROLLED" && lookedUpApp.status !== "REJECTED" && (
                <form action={payAction} className="grid gap-4 rounded-2xl border border-line bg-white p-6 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-line pb-3">
                    <CreditCard className="size-4 text-cobalt" aria-hidden />
                    <h3 className="text-base font-extrabold text-navy">
                      Paso 4 · Reportar comprobante de pago ({formatCop(lookedUpApp.estimatedEnrollmentCop)})
                    </h3>
                  </div>

                  <input type="hidden" name="trackingCode" value={lookedUpApp.trackingCode} />
                  <input type="hidden" name="guardianDocNumber" value={lookedUpApp.guardianDocNumber} />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor={`${id}-ch`} className="field-label">Medio de pago</label>
                      <select
                        id={`${id}-ch`}
                        name="paymentChannel"
                        defaultValue={lookedUpApp.paymentChannel ?? "NEQUI"}
                        className="input mt-1 min-h-11 text-sm"
                      >
                        {PAYMENT_CHANNELS.map((c) => (
                          <option key={c} value={c}>{PAYMENT_CHANNEL_LABELS[c]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`${id}-ref`} className="field-label">Número de referencia</label>
                      <input
                        id={`${id}-ref`}
                        name="paymentReference"
                        required
                        defaultValue={lookedUpApp.paymentReference ?? ""}
                        placeholder="Ej. NQ-849201"
                        className="input mt-1 min-h-11 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor={`${id}-rec`} className="field-label">Soporte PDF o imagen (opcional)</label>
                      <input
                        id={`${id}-rec`}
                        name="receipt"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        className="mt-2 block w-full text-xs text-ink-2 file:mr-2 file:rounded-control file:border file:border-line-2 file:bg-cloud file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-cobalt"
                      />
                    </div>
                  </div>

                  {payState.message && (
                    <p
                      role={payState.status === "error" ? "alert" : "status"}
                      className={`text-sm font-semibold ${
                        payState.status === "error" ? "text-red-solid" : "text-green-solid"
                      }`}
                    >
                      {payState.message}
                    </p>
                  )}

                  <div className="flex justify-end">
                    <button type="submit" disabled={paying} className={pillButtonClass({ variant: "navy", size: "sm" })}>
                      {paying ? "Enviando soporte…" : "Enviar comprobante a Secretaría"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
