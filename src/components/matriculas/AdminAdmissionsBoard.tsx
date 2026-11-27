"use client";

import {
  Award,
  CheckCircle2,
  ExternalLink,
  FileText,
  KeyRound,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { pillButtonClass } from "@/components/ui/PillButton";
import { emitToast } from "@/components/ui/ToastViewport";
import {
  academicDecisionAction,
  formalizeAdmissionAction,
  reviewAdmissionDocumentAction,
  reviewSiblingDiscountAction,
  type AdmissionActionState,
} from "@/modules/matriculas/actions";
import {
  ADMISSION_DOC_STATUS_META,
  ADMISSION_STATUS_META,
  formatCop,
  PAYMENT_CHANNEL_LABELS,
} from "@/modules/matriculas/catalog";
import { EARLY_BIRD_LABELS, SIBLING_LABELS } from "@/modules/matriculas/discount-policy";
import type {
  AdmissionApplicationDetail,
  AdmissionDocView,
  AvailableGroupOption,
} from "@/modules/matriculas/queries";

const INITIAL: AdmissionActionState = { status: "idle" };

function StaffDocReviewRow({ doc }: { doc: AdmissionDocView }) {
  const [state, action, pending] = useActionState(reviewAdmissionDocumentAction, INITIAL);
  const [rejectOpen, setRejectOpen] = useState(false);
  const meta = ADMISSION_DOC_STATUS_META[doc.status];

  useEffect(() => {
    if (state.status === "success" && state.message) {
      emitToast({ title: state.message, tone: "success" });
    } else if (state.status === "error" && state.message) {
      emitToast({ title: "No pudimos actualizar el documento", description: state.message, tone: "error" });
    }
  }, [state]);

  return (
    <li className="grid gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-navy">{doc.label}</span>
            <Chip tone={meta.tone}>{meta.label}</Chip>
          </div>
          {doc.reviewNote && (
            <p className="mt-0.5 text-xs font-semibold text-red-solid">Observación: {doc.reviewNote}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {doc.hasFile && (
            <a
              href={`/api/matriculas/documentos?tipo=doc&id=${doc.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-control border border-line-2 bg-white px-2.5 py-1 text-xs font-bold text-navy no-underline hover:bg-cloud"
            >
              <FileText className="size-3.5 text-cobalt" aria-hidden /> Abrir
            </a>
          )}

          {doc.hasFile && doc.status !== "APPROVED" && (
            <form action={action}>
              <input type="hidden" name="documentId" value={doc.id} />
              <input type="hidden" name="decision" value="APPROVED" />
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-control bg-green-solid px-2.5 py-1 text-xs font-bold text-white hover:brightness-95"
              >
                <CheckCircle2 className="size-3.5" aria-hidden /> Aprobar
              </button>
            </form>
          )}

          {doc.hasFile && (
            <button
              type="button"
              onClick={() => setRejectOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-control border border-line-2 bg-white px-2.5 py-1 text-xs font-semibold text-red-solid hover:bg-red-l/50"
            >
              <XCircle className="size-3.5" aria-hidden /> Subsanar
            </button>
          )}
        </div>
      </div>

      {rejectOpen && (
        <form action={action} className="flex flex-wrap items-center gap-2 rounded-control bg-red-l/35 p-2.5">
          <input type="hidden" name="documentId" value={doc.id} />
          <input type="hidden" name="decision" value="RESUBMIT" />
          <input
            name="reviewNote"
            required
            minLength={4}
            placeholder="Indica qué debe corregir la familia (ej. imagen borrosa o certificado vencido)…"
            className="input min-h-9 flex-1 text-xs font-normal"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-control bg-red-solid px-3 py-1.5 text-xs font-bold text-white"
          >
            Enviar
          </button>
        </form>
      )}
    </li>
  );
}

/** Beneficios verificables: pronto pago (por fecha) y hermanos (verificación + revisión de Secretaría). */
function BenefitsReview({ app, canReview }: { app: AdmissionApplicationDetail; canReview: boolean }) {
  const sibling = app.siblingClaimStatus;
  const canDecide = canReview && sibling !== "NOT_REQUESTED" && app.status !== "ENROLLED";
  const earlyTone =
    app.earlyBirdStatus === "CONFIRMED" ? "green" : app.earlyBirdStatus === "EXPIRED" ? "orange" : "blue";
  const siblingTone =
    sibling === "VERIFIED" ? "green" : sibling === "REJECTED" ? "red" : sibling === "PENDING_REVIEW" ? "orange" : "sky";

  return (
    <div className="grid gap-3 rounded-control border border-line p-3 text-xs">
      <p className="flex items-center gap-1.5 font-bold text-muted uppercase">
        <Award className="size-3.5 text-cobalt" aria-hidden /> Beneficios
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={earlyTone}>Pronto pago · {EARLY_BIRD_LABELS[app.earlyBirdStatus]}</Chip>
        <Chip tone={siblingTone}>Hermanos · {SIBLING_LABELS[sibling]}</Chip>
      </div>
      {sibling !== "NOT_REQUESTED" && (
        <div className="grid gap-1 rounded-control bg-bg-2/70 p-2.5 text-ink-2">
          {app.siblingReferenceDoc && (
            <p>
              Documento declarado del hermano(a): <strong className="tabular">{app.siblingReferenceDoc}</strong>
            </p>
          )}
          {app.siblingVerificationNote && <p>{app.siblingVerificationNote}</p>}
        </div>
      )}
      {canDecide && (
        <div className="flex flex-wrap gap-2">
          {sibling !== "VERIFIED" && (
            <form action={reviewSiblingDiscountAction}>
              <input type="hidden" name="applicationId" value={app.id} />
              <input type="hidden" name="decision" value="VERIFIED" />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-control bg-green-solid px-2.5 py-1.5 text-xs font-bold text-white hover:brightness-95"
              >
                <CheckCircle2 className="size-3.5" aria-hidden /> Aprobar descuento de hermanos
              </button>
            </form>
          )}
          {sibling !== "REJECTED" && (
            <form action={reviewSiblingDiscountAction}>
              <input type="hidden" name="applicationId" value={app.id} />
              <input type="hidden" name="decision" value="REJECTED" />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-control border border-line-2 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-solid hover:bg-red-l/50"
              >
                <XCircle className="size-3.5" aria-hidden /> No aplica
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/** Panel maestro-detalle de revisión documental, aval académico y formalización de Matrículas 2027. */
export function AdminAdmissionsBoard({
  applications,
  groups,
  canFormalize,
}: {
  applications: AdmissionApplicationDetail[];
  groups: AvailableGroupOption[];
  canFormalize: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>(() => applications[0]?.id ?? "");
  const active = applications.find((a) => a.id === selectedId) ?? applications[0] ?? null;

  const [acadState, acadAction, acadPending] = useActionState(academicDecisionAction, INITIAL);
  const [formState, formAction, formPending] = useActionState(formalizeAdmissionAction, INITIAL);

  useEffect(() => {
    if (acadState.status === "success" && acadState.message) {
      emitToast({ title: acadState.message, tone: "success" });
    } else if (acadState.status === "error" && acadState.message) {
      emitToast({ title: "No pudimos registrar la decisión", description: acadState.message, tone: "error" });
    }
  }, [acadState]);

  useEffect(() => {
    if (formState.status === "success" && formState.message) {
      emitToast({ title: "¡Matrícula formalizada!", description: formState.message, tone: "success" });
    } else if (formState.status === "error" && formState.message) {
      emitToast({ title: "No pudimos formalizar", description: formState.message, tone: "error" });
    }
  }, [formState]);

  if (!active) {
    return (
      <div className="card py-12 text-center text-sm text-muted">
        No hay solicitudes de matrícula con este filtro.
      </div>
    );
  }

  const matchingGroups = groups.filter((g) => g.gradeId === active.targetGradeId);
  const candidateGroups = matchingGroups.length > 0 ? matchingGroups : groups;
  const approvedDocs = active.documents.filter((d) => d.status === "APPROVED").length;
  const uploadedDocs = active.documents.filter((d) => d.hasFile).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      {/* Lista izquierda */}
      <aside className="card overflow-hidden bg-white p-0">
        <ul className="divide-y divide-line">
          {applications.map((app) => {
            const isSelected = app.id === active.id;
            const meta = ADMISSION_STATUS_META[app.status];
            return (
              <li key={app.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(app.id)}
                  className={`grid w-full gap-1 px-4 py-3.5 text-left transition-colors ${
                    isSelected
                      ? "border-l-4 border-l-cobalt bg-cloud/80"
                      : "border-l-4 border-l-transparent hover:bg-bg-2/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[0.7rem] font-extrabold text-cobalt">{app.trackingCode}</span>
                    <Chip tone={meta.tone}>{meta.label}</Chip>
                  </div>
                  <p className="truncate text-sm font-extrabold text-navy">
                    {app.studentFirstName} {app.studentLastName}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {app.targetGradeName} · {app.applicationType === "NEW" ? "Familia nueva" : "Renovación"}
                  </p>
                  {app.siblingClaimStatus === "PENDING_REVIEW" && (
                    <p className="text-[0.68rem] font-bold text-orange-solid">● Descuento de hermanos por revisar</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Detalle y acciones a la derecha */}
      <div className="grid gap-5">
        <section className="card grid gap-4 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="font-mono text-xs font-extrabold text-cobalt">
                {active.trackingCode} · {active.applicationType === "NEW" ? "Familia nueva" : "Renovación"}
              </p>
              <h2 className="mt-0.5 text-xl font-black text-navy">
                {active.studentFirstName} {active.studentLastName}
              </h2>
              <p className="text-xs text-muted">
                Aspira a <strong className="text-navy">{active.targetGradeName}</strong> · Doc:{" "}
                {active.studentDocType} {active.studentDocNumber}
              </p>
            </div>
            <Chip tone={ADMISSION_STATUS_META[active.status].tone}>
              {ADMISSION_STATUS_META[active.status].label}
            </Chip>
          </div>

          <dl className="grid gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-control bg-bg-2/70 p-3">
              <dt className="font-bold text-muted uppercase">Acudiente</dt>
              <dd className="mt-1 font-bold text-navy">
                {active.guardianFirstName} {active.guardianLastName}
              </dd>
              <dd className="text-muted">
                {active.guardianDocType} {active.guardianDocNumber} · {active.guardianPhone}
              </dd>
              <dd className="truncate text-muted">{active.guardianEmail}</dd>
            </div>
            <div className="rounded-control bg-bg-2/70 p-3">
              <dt className="font-bold text-muted uppercase">Salud y origen</dt>
              <dd className="mt-1 font-bold text-navy">
                EPS: {active.studentEps || "Sin registrar"} · RH: {active.studentBloodType || "—"}
              </dd>
              <dd className="text-muted">Origen: {active.previousSchool || "No especificado"}</dd>
              <dd className="mt-1 inline-flex items-center gap-1 font-semibold text-green-solid">
                <ShieldCheck className="size-3.5" aria-hidden /> Ley 1581 aceptada
              </dd>
            </div>
            <div className="rounded-control bg-bg-2/70 p-3">
              <dt className="font-bold text-muted uppercase">Costos y pago</dt>
              <dd className="mt-1 font-extrabold text-cobalt tabular">
                Matrícula: {formatCop(active.estimatedEnrollmentCop)}
              </dd>
              <dd className="text-muted tabular">Pensión: {formatCop(active.estimatedMonthlyCop)}/mes</dd>
              {active.paymentReference ? (
                <dd className="mt-1 font-bold text-navy">
                  {active.paymentChannel ? PAYMENT_CHANNEL_LABELS[active.paymentChannel] : ""} · Ref.{" "}
                  {active.paymentReference}
                  {active.hasPaymentReceipt && (
                    <a
                      href={`/api/matriculas/documentos?tipo=pago&id=${active.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1.5 inline-flex items-center gap-0.5 text-sky-solid"
                    >
                      Ver <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )}
                </dd>
              ) : (
                <dd className="mt-1 text-orange-solid">Pago pendiente de reporte</dd>
              )}
            </div>
          </dl>

          <BenefitsReview app={active} canReview={canFormalize} />
        </section>

        {/* Credenciales generadas tras formalizar */}
        {formState.status === "success" && formState.issuedCredentials && formState.issuedCredentials.length > 0 && (
          <section className="card grid gap-3 border-green-solid/40 bg-green-l/45">
            <div className="flex items-center gap-2 text-sm font-extrabold text-green-solid">
              <KeyRound className="size-4" aria-hidden />
              Credenciales institucionales generadas (entregar a la familia)
            </div>
            <ul className="grid gap-2 text-xs">
              {formState.issuedCredentials.map((cred) => (
                <li key={cred.documentNumber} className="rounded-control bg-white px-3 py-2 font-medium text-navy">
                  <strong>{cred.role}:</strong> {cred.fullName} · Doc: <code>{cred.documentNumber}</code> · Correo:{" "}
                  <code>{cred.email}</code> · Clave inicial: <code className="font-black text-cobalt">{cred.password}</code>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Revisión de los 8 documentos */}
        <section className="card grid gap-2 bg-white p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h3 className="text-sm font-extrabold text-navy">
              Bitácora de 8 documentos ({uploadedDocs} cargados · {approvedDocs} aprobados)
            </h3>
          </div>
          <ul className="divide-y divide-line">
            {active.documents.map((doc) => (
              <StaffDocReviewRow key={doc.id} doc={doc} />
            ))}
          </ul>
        </section>

        {/* Decisiones: Aval académico (Coordinación/Admin) y Formalización (solo Admin) */}
        {active.status !== "ENROLLED" && (
          <div className="grid gap-4 md:grid-cols-2">
            <form action={acadAction} className="card grid gap-3 bg-white">
              <div className="flex items-center gap-2">
                <Award className="size-4 text-purple-solid" aria-hidden />
                <h3 className="text-sm font-bold text-navy">Aval académico (Coordinación)</h3>
              </div>
              <input type="hidden" name="applicationId" value={active.id} />
              <textarea
                name="reviewNotes"
                rows={2}
                defaultValue={active.reviewNotes}
                placeholder="Observaciones de entrevista, cupo o valoración académica…"
                className="input min-h-16 py-2 text-xs font-normal"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  name="decision"
                  value="ACADEMIC_APPROVED"
                  disabled={acadPending}
                  className={pillButtonClass({ variant: "navy", size: "sm" })}
                >
                  Otorgar aval académico
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="REJECTED"
                  disabled={acadPending}
                  className={pillButtonClass({ variant: "outline", size: "sm" })}
                >
                  Rechazar
                </button>
              </div>
            </form>

            {canFormalize && (
              <form action={formAction} className="card grid gap-3 border-cobalt/30 bg-white">
                <div className="flex items-center gap-2">
                  <UserCheck className="size-4 text-cobalt" aria-hidden />
                  <h3 className="text-sm font-bold text-navy">Formalizar matrícula (Secretaría)</h3>
                </div>
                <input type="hidden" name="applicationId" value={active.id} />
                <div>
                  <label htmlFor="formalize-group" className="field-label">
                    Asignar grupo destino
                  </label>
                  <select id="formalize-group" name="groupId" className="input min-h-10 text-sm font-bold">
                    {candidateGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.gradeName}) · {g.enrolledCount}/{g.capacity} cupos
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[0.72rem] text-muted">
                  Crea o vincula estudiante + acudiente, activa la matrícula oficial y genera credenciales si es familia
                  nueva.
                </p>
                <button type="submit" disabled={formPending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
                  {formPending ? "Formalizando…" : "Aprobar y formalizar matrícula"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
