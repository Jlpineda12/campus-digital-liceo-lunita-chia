"use client";

import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useMemo, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { pillButtonClass } from "@/components/ui/PillButton";
import { DOCUMENT_TYPES } from "@/modules/core/academic-structure/constants";
import { PAYMENT_CHANNELS } from "@/db/schema/matriculas";
import {
  createAdmissionApplicationAction,
  uploadAdmissionDocumentAction,
  uploadAdmissionPaymentAction,
  type AdmissionActionState,
} from "@/modules/matriculas/actions";
import {
  ADMISSION_DOC_STATUS_META,
  ADMISSION_STATUS_META,
  calculateAdmissionFees,
  formatCop,
  PAYMENT_CHANNEL_LABELS,
} from "@/modules/matriculas/catalog";
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

  return (
    <li className="grid gap-2.5 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
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
        <p className="mt-0.5 text-xs text-muted">{doc.description}</p>
        {doc.reviewNote && (
          <p className="mt-1 rounded-control bg-red-l/60 px-2.5 py-1 text-xs font-semibold text-red-solid">
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
            className="inline-flex items-center gap-1 rounded-control border border-line-2 bg-white px-2.5 py-1.5 text-xs font-bold text-navy no-underline hover:bg-cloud"
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
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-cobalt/35 bg-cloud px-3 py-1.5 text-xs font-bold text-cobalt hover:bg-blue-l/60"
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

/** Portal interactivo de Admisiones y Matrícula en Línea 2027 (`/matriculas`). */
export function PublicAdmissionsPortal({
  grades,
  renewalCandidates,
  isLoggedGuardian,
  lookedUpApp,
  lookupQuery,
}: {
  grades: PublicGradeOption[];
  renewalCandidates: RenewalChildCandidate[];
  isLoggedGuardian: boolean;
  lookedUpApp: AdmissionApplicationDetail | null;
  lookupQuery: { radicado: string; doc: string };
}) {
  const [mode, setMode] = useState<"apply" | "track">(
    lookedUpApp || lookupQuery.radicado ? "track" : "apply",
  );
  const [applicationType, setApplicationType] = useState<"NEW" | "RENEWAL">(
    renewalCandidates.length > 0 ? "RENEWAL" : "NEW",
  );
  const [selectedRenewalId, setSelectedRenewalId] = useState<string>(renewalCandidates[0]?.studentId ?? "");
  const renewalChild = renewalCandidates.find((c) => c.studentId === selectedRenewalId) ?? null;

  const [selectedGradeId, setSelectedGradeId] = useState<string>(
    renewalChild?.suggestedNextGradeId ?? grades[0]?.id ?? "",
  );
  const [earlyBird, setEarlyBird] = useState(true);
  const [sibling, setSibling] = useState(false);

  const [createState, createAction, creating] = useActionState(createAdmissionApplicationAction, INITIAL);
  const [payState, payAction, paying] = useActionState(uploadAdmissionPaymentAction, INITIAL);

  const selectedGrade = useMemo(
    () => grades.find((g) => g.id === selectedGradeId) ?? grades[0],
    [grades, selectedGradeId],
  );
  const fees = useMemo(
    () =>
      calculateAdmissionFees({
        levelCode: selectedGrade?.levelCode ?? "PRIMARIA",
        hasEarlyBirdDiscount: earlyBird,
        hasSiblingDiscount: sibling,
      }),
    [selectedGrade, earlyBird, sibling],
  );

  const id = useId();
  const uploadedCount = lookedUpApp
    ? lookedUpApp.documents.filter((d) => d.hasFile || d.status === "APPROVED").length
    : 0;
  const approvedCount = lookedUpApp
    ? lookedUpApp.documents.filter((d) => d.status === "APPROVED").length
    : 0;

  return (
    <div className="grid gap-6">
      {/* Encabezado limpio + selector de modo */}
      <div className="card card-lg bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <Chip tone="orange">Admisiones y Matrícula 2027</Chip>
            <h1 className="mt-2.5 text-step-3">Matrícula en línea · Liceo Lunita de Chía</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Radica tu solicitud en minutos, calcula costos con total transparencia y sube los 8 documentos
              en almacenamiento privado protegido por Ley 1581.
            </p>
          </div>

          {!isLoggedGuardian && (
            <Link
              href="/login?rol=padres&next=/matriculas"
              className={pillButtonClass({ variant: "outline", size: "sm" })}
            >
              Soy familia Lunita (Renovación) <ArrowRight aria-hidden />
            </Link>
          )}
        </div>

        <nav aria-label="Modo del portal de matrículas" className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setMode("apply")}
            aria-current={mode === "apply" ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-control border px-4 py-2 text-sm font-bold transition-colors ${
              mode === "apply"
                ? "border-navy bg-navy text-white"
                : "border-line-2 bg-white text-navy hover:bg-cloud"
            }`}
          >
            <Sparkles className="size-4" aria-hidden />
            Nueva solicitud / Renovación
          </button>
          <button
            type="button"
            onClick={() => setMode("track")}
            aria-current={mode === "track" ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-control border px-4 py-2 text-sm font-bold transition-colors ${
              mode === "track"
                ? "border-navy bg-navy text-white"
                : "border-line-2 bg-white text-navy hover:bg-cloud"
            }`}
          >
            <FileCheck2 className="size-4" aria-hidden />
            Subir los 8 documentos / Consultar radicado
          </button>
        </nav>
      </div>

      {/* Confirmación inmediata tras radicar */}
      {createState.status === "success" && createState.trackingCode && createState.guardianDocNumber && (
        <div className="card border-green-solid/40 bg-green-l/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-extrabold text-green-solid uppercase">
                <CheckCircle2 className="size-4" aria-hidden /> Solicitud radicada correctamente
              </p>
              <h2 className="mt-1 text-xl font-black text-navy">
                Código de radicado: <span className="font-mono text-cobalt">{createState.trackingCode}</span>
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                Guarda este código. Ahora puedes abrir tu expediente para cargar los 8 documentos y el soporte de pago.
              </p>
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

      {/* MODO 1: NUEVA SOLICITUD + CALCULADORA DE COSTOS */}
      {mode === "apply" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <form action={createAction} className="card grid gap-5 bg-white">
            {/* Paso 1: Tipo y grado */}
            <section className="grid gap-3 border-b border-line pb-5">
              <p className="text-xs font-extrabold tracking-wider text-cobalt uppercase">
                Paso 1 · Tipo de familia y grado 2027
              </p>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-center gap-3 rounded-control border p-3 ${applicationType === "NEW" ? "border-cobalt bg-cloud" : "border-line-2"}`}>
                  <input
                    type="radio"
                    name="applicationType"
                    value="NEW"
                    checked={applicationType === "NEW"}
                    onChange={() => setApplicationType("NEW")}
                  />
                  <span>
                    <span className="block text-sm font-bold text-navy">Familia nueva</span>
                    <span className="text-xs text-muted">Primer ingreso al Liceo Lunita de Chía</span>
                  </span>
                </label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-control border p-3 ${applicationType === "RENEWAL" ? "border-cobalt bg-cloud" : "border-line-2"}`}>
                  <input
                    type="radio"
                    name="applicationType"
                    value="RENEWAL"
                    checked={applicationType === "RENEWAL"}
                    onChange={() => setApplicationType("RENEWAL")}
                  />
                  <span>
                    <span className="block text-sm font-bold text-navy">Renovación (Familia Lunita)</span>
                    <span className="text-xs text-muted">Estudiante actual del colegio</span>
                  </span>
                </label>
              </div>

              {applicationType === "RENEWAL" && renewalCandidates.length > 0 && (
                <div className="rounded-control border border-green/40 bg-green-l/40 p-3">
                  <label htmlFor={`${id}-ren`} className="field-label text-green-solid">
                    Precargar datos de tu hijo(a)
                  </label>
                  <select
                    id={`${id}-ren`}
                    value={selectedRenewalId}
                    onChange={(e) => {
                      const next = renewalCandidates.find((c) => c.studentId === e.target.value);
                      setSelectedRenewalId(e.target.value);
                      if (next?.suggestedNextGradeId) setSelectedGradeId(next.suggestedNextGradeId);
                    }}
                    className="input min-h-10 text-sm font-bold"
                  >
                    {renewalCandidates.map((c) => (
                      <option key={c.studentId} value={c.studentId}>
                        {c.firstName} {c.lastName} ({c.currentGradeName ?? "Estudiante"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor={`${id}-grade`} className="field-label">
                  Grado al que aspira en 2027
                </label>
                <select
                  id={`${id}-grade`}
                  name="targetGradeId"
                  value={selectedGradeId}
                  onChange={(e) => setSelectedGradeId(e.target.value)}
                  className="input min-h-11 text-base font-bold sm:text-sm"
                >
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.levelName})
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {/* Paso 2: Datos del estudiante */}
            <section key={`stu-${selectedRenewalId}-${applicationType}`} className="grid gap-3 border-b border-line pb-5">
              <p className="text-xs font-extrabold tracking-wider text-cobalt uppercase">
                Paso 2 · Datos del aspirante / estudiante
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${id}-sf`} className="field-label">Nombres</label>
                  <input id={`${id}-sf`} name="studentFirstName" required defaultValue={applicationType === "RENEWAL" ? renewalChild?.firstName ?? "" : ""} className="input min-h-10 text-base sm:text-sm" />
                </div>
                <div>
                  <label htmlFor={`${id}-sl`} className="field-label">Apellidos</label>
                  <input id={`${id}-sl`} name="studentLastName" required defaultValue={applicationType === "RENEWAL" ? renewalChild?.lastName ?? "" : ""} className="input min-h-10 text-base sm:text-sm" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor={`${id}-sdt`} className="field-label">Tipo doc.</label>
                  <select id={`${id}-sdt`} name="studentDocType" defaultValue={applicationType === "RENEWAL" ? renewalChild?.documentType ?? "TI" : "TI"} className="input min-h-10 text-sm">
                    {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${id}-sdn`} className="field-label">Número de documento</label>
                  <input id={`${id}-sdn`} name="studentDocNumber" required defaultValue={applicationType === "RENEWAL" ? renewalChild?.documentNumber ?? "" : ""} placeholder="1072..." className="input min-h-10 text-base sm:text-sm" />
                </div>
                <div>
                  <label htmlFor={`${id}-sbd`} className="field-label">Fecha nacimiento</label>
                  <input id={`${id}-sbd`} name="studentBirthDate" type="date" className="input min-h-10 text-sm" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor={`${id}-eps`} className="field-label">EPS</label>
                  <input id={`${id}-eps`} name="studentEps" placeholder="Sanitas / Sura / Compensar" className="input min-h-10 text-base sm:text-sm" />
                </div>
                <div>
                  <label htmlFor={`${id}-rh`} className="field-label">Grupo y RH</label>
                  <input id={`${id}-rh`} name="studentBloodType" placeholder="O+" className="input min-h-10 text-base sm:text-sm" />
                </div>
                <div>
                  <label htmlFor={`${id}-prev`} className="field-label">Colegio anterior</label>
                  <input id={`${id}-prev`} name="previousSchool" placeholder="Opcional" className="input min-h-10 text-base sm:text-sm" />
                </div>
              </div>
            </section>

            {/* Paso 3: Datos del acudiente */}
            <section key={`gua-${selectedRenewalId}-${applicationType}`} className="grid gap-3 border-b border-line pb-5">
              <p className="text-xs font-extrabold tracking-wider text-cobalt uppercase">
                Paso 3 · Acudiente y responsable financiero
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${id}-gf`} className="field-label">Nombres acudiente</label>
                  <input id={`${id}-gf`} name="guardianFirstName" required defaultValue={applicationType === "RENEWAL" ? renewalChild?.guardianFirstName ?? "" : ""} className="input min-h-10 text-base sm:text-sm" />
                </div>
                <div>
                  <label htmlFor={`${id}-gl`} className="field-label">Apellidos acudiente</label>
                  <input id={`${id}-gl`} name="guardianLastName" required defaultValue={applicationType === "RENEWAL" ? renewalChild?.guardianLastName ?? "" : ""} className="input min-h-10 text-base sm:text-sm" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor={`${id}-gdt`} className="field-label">Tipo doc.</label>
                  <select id={`${id}-gdt`} name="guardianDocType" defaultValue={applicationType === "RENEWAL" ? renewalChild?.guardianDocType ?? "CC" : "CC"} className="input min-h-10 text-sm">
                    {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${id}-gdn`} className="field-label">Documento acudiente</label>
                  <input id={`${id}-gdn`} name="guardianDocNumber" required defaultValue={applicationType === "RENEWAL" ? renewalChild?.guardianDocNumber ?? "" : ""} placeholder="52..." className="input min-h-10 text-base sm:text-sm" />
                </div>
                <div>
                  <label htmlFor={`${id}-gph`} className="field-label">Celular / WhatsApp</label>
                  <input id={`${id}-gph`} name="guardianPhone" required defaultValue={applicationType === "RENEWAL" ? renewalChild?.guardianPhone ?? "" : ""} placeholder="300 000 0000" className="input min-h-10 text-base sm:text-sm" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${id}-gem`} className="field-label">Correo electrónico</label>
                  <input id={`${id}-gem`} name="guardianEmail" type="email" required defaultValue={applicationType === "RENEWAL" ? renewalChild?.guardianEmail ?? "" : ""} placeholder="familia@correo.com" className="input min-h-10 text-base sm:text-sm" />
                </div>
                <div>
                  <label htmlFor={`${id}-addr`} className="field-label">Dirección en Chía / Sabana</label>
                  <input id={`${id}-addr`} name="address" placeholder="Vereda / Barrio y dirección" className="input min-h-10 text-base sm:text-sm" />
                </div>
              </div>
            </section>

            {/* Descuentos + Ley 1581 */}
            <section className="grid gap-3">
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-navy">
                  <input type="checkbox" name="hasEarlyBirdDiscount" checked={earlyBird} onChange={(e) => setEarlyBird(e.target.checked)} />
                  Aplicar descuento pronto pago (10% en matrícula)
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-navy">
                  <input type="checkbox" name="hasSiblingDiscount" checked={sibling} onChange={(e) => setSibling(e.target.checked)} />
                  Descuento por hermanos en el colegio (8% en pensión)
                </label>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-control border border-cobalt/25 bg-cloud/70 p-3.5 text-xs leading-relaxed text-ink-2">
                <input type="checkbox" name="habeasDataAccepted" required className="mt-0.5" />
                <span>
                  <strong className="text-navy">Autorización Ley 1581 de 2012 (Habeas Data de menores):</strong> autorizo
                  al Liceo Lunita de Chía para tratar los datos personales y documentos académicos aquí registrados con
                  fines estrictamente educativos y de matrícula escolar.
                </span>
              </label>

              {createState.status === "error" && createState.message && (
                <p role="alert" className="text-sm font-semibold text-red-solid">
                  {createState.message}
                </p>
              )}

              <div className="flex justify-end">
                <button type="submit" disabled={creating} className={pillButtonClass({ variant: "navy" })}>
                  {creating ? "Radicando solicitud…" : "Radicar solicitud y obtener código"}
                  <ArrowRight aria-hidden />
                </button>
              </div>
            </section>
          </form>

          {/* Calculadora transparente lateral */}
          <aside className="card grid gap-4 bg-white">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <Calculator className="size-4 text-cobalt" aria-hidden />
              <h2 className="text-base font-bold text-navy">Calculadora de costos 2027</h2>
            </div>

            <div className="rounded-control bg-cloud/80 px-3.5 py-2.5">
              <p className="text-[0.68rem] font-extrabold tracking-wider text-muted uppercase">Nivel seleccionado</p>
              <p className="text-sm font-extrabold text-navy">
                {selectedGrade?.name} · {selectedGrade?.levelName}
              </p>
            </div>

            <dl className="grid gap-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Matrícula base</dt>
                <dd className="font-semibold text-navy tabular">{formatCop(fees.enrollmentBase)}</dd>
              </div>
              {fees.enrollmentDiscount > 0 && (
                <div className="flex justify-between text-green-solid">
                  <dt>Pronto pago (-10%)</dt>
                  <dd className="font-bold tabular">-{formatCop(fees.enrollmentDiscount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-2 text-base">
                <dt className="font-extrabold text-navy">Total matrícula</dt>
                <dd className="font-black text-cobalt tabular">{formatCop(fees.enrollmentFinal)}</dd>
              </div>

              <div className="mt-2 flex justify-between">
                <dt className="text-muted">Pensión mensual (Feb–Nov)</dt>
                <dd className="font-semibold text-navy tabular">{formatCop(fees.monthlyBase)}</dd>
              </div>
              {fees.monthlyDiscount > 0 && (
                <div className="flex justify-between text-green-solid">
                  <dt>Descuento hermanos (-8%)</dt>
                  <dd className="font-bold tabular">-{formatCop(fees.monthlyDiscount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-2 text-base">
                <dt className="font-extrabold text-navy">Pensión mensual neta</dt>
                <dd className="font-black text-navy tabular">{formatCop(fees.monthlyFinal)}</dd>
              </div>
            </dl>

            <div className="rounded-control border border-line bg-bg-2/70 p-3 text-xs text-muted">
              <p className="font-bold text-navy">Canales oficiales habilitados:</p>
              <p className="mt-1">Nequi · Daviplata · Bre-B · PSE · Tesorería presencial del colegio.</p>
            </div>
          </aside>
        </div>
      )}

      {/* MODO 2: CONSULTA DE RADICADO + BITÁCORA REAL DE LOS 8 DOCUMENTOS + PAGO */}
      {mode === "track" && (
        <div className="grid gap-6">
          <form method="get" action="/matriculas" className="card grid gap-3 bg-white sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor={`${id}-q-code`} className="field-label">Código de radicado</label>
              <input
                id={`${id}-q-code`}
                name="radicado"
                required
                defaultValue={lookupQuery.radicado}
                placeholder="Ej. ADM-2027-DEMO01"
                className="input min-h-10 font-mono text-sm uppercase"
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
                className="input min-h-10 text-base sm:text-sm"
              />
            </div>
            <button type="submit" className={pillButtonClass({ variant: "navy", size: "sm" })}>
              <Search aria-hidden /> Consultar expediente
            </button>
          </form>

          {lookupQuery.radicado && !lookedUpApp && (
            <div className="card border-orange/40 bg-orange-l/40 text-sm font-semibold text-navy">
              No encontramos una solicitud que coincida con ese código de radicado y documento del acudiente.
              Verifica los datos o radica una nueva solicitud.
            </div>
          )}

          {lookedUpApp && (
            <div className="grid gap-6">
              {/* Estado del expediente */}
              <section className="card grid gap-4 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <p className="font-mono text-xs font-extrabold text-cobalt">{lookedUpApp.trackingCode}</p>
                    <h2 className="mt-0.5 text-xl font-black text-navy">
                      {lookedUpApp.studentFirstName} {lookedUpApp.studentLastName} · {lookedUpApp.targetGradeName}
                    </h2>
                    <p className="text-xs text-muted">
                      Acudiente: {lookedUpApp.guardianFirstName} {lookedUpApp.guardianLastName} · Matrícula estimada:{" "}
                      <strong className="text-navy">{formatCop(lookedUpApp.estimatedEnrollmentCop)}</strong>
                    </p>
                  </div>
                  <Chip tone={ADMISSION_STATUS_META[lookedUpApp.status].tone}>
                    {ADMISSION_STATUS_META[lookedUpApp.status].label}
                  </Chip>
                </div>

                {lookedUpApp.reviewNotes && (
                  <p className="rounded-control bg-cloud px-3.5 py-2.5 text-xs font-semibold text-navy">
                    Nota institucional: {lookedUpApp.reviewNotes}
                  </p>
                )}

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-control bg-bg-2/70 px-3.5 py-2.5">
                    <p className="text-[0.68rem] font-bold text-muted uppercase">Documentos cargados</p>
                    <p className="mt-0.5 text-lg font-black text-navy tabular">{uploadedCount} / 8</p>
                  </div>
                  <div className="rounded-control bg-bg-2/70 px-3.5 py-2.5">
                    <p className="text-[0.68rem] font-bold text-muted uppercase">Aprobados por Secretaría</p>
                    <p className="mt-0.5 text-lg font-black text-green-solid tabular">{approvedCount} / 8</p>
                  </div>
                  <div className="rounded-control bg-bg-2/70 px-3.5 py-2.5">
                    <p className="text-[0.68rem] font-bold text-muted uppercase">Soporte de pago</p>
                    <p className="mt-0.5 text-sm font-extrabold text-navy">
                      {lookedUpApp.paymentReference
                        ? `${lookedUpApp.paymentChannel ? PAYMENT_CHANNEL_LABELS[lookedUpApp.paymentChannel] : ""} · Ref. ${lookedUpApp.paymentReference}`
                        : "Pendiente por reportar"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Bitácora real de los 8 documentos */}
              <section className="card grid gap-3 bg-white p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-cobalt" aria-hidden />
                    <h3 className="text-base font-bold text-navy">Bitácora de los 8 documentos de admisión</h3>
                  </div>
                  <span className="text-xs text-muted">PDF, PNG o JPG · Máx. 5 MB por archivo</span>
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
                <form action={payAction} className="card grid gap-4 bg-white">
                  <div className="flex items-center gap-2 border-b border-line pb-3">
                    <CreditCard className="size-4 text-cobalt" aria-hidden />
                    <h3 className="text-base font-bold text-navy">
                      Paso 4 · Reportar comprobante de pago ({formatCop(lookedUpApp.estimatedEnrollmentCop)})
                    </h3>
                  </div>

                  <input type="hidden" name="trackingCode" value={lookedUpApp.trackingCode} />
                  <input type="hidden" name="guardianDocNumber" value={lookedUpApp.guardianDocNumber} />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor={`${id}-ch`} className="field-label">Medio de pago</label>
                      <select
                        id={`${id}-ch`}
                        name="paymentChannel"
                        defaultValue={lookedUpApp.paymentChannel ?? "NEQUI"}
                        className="input min-h-10 text-sm"
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
                        className="input min-h-10 text-base sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor={`${id}-rec`} className="field-label">Soporte PDF o imagen (opcional)</label>
                      <input
                        id={`${id}-rec`}
                        name="receipt"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        className="mt-1 block w-full text-xs text-ink-2 file:mr-2 file:rounded-control file:border file:border-line-2 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-bold file:text-navy"
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
