"use client";

import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CalendarClock,
  Check,
  CreditCard,
  Lock,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import { DOCUMENT_TYPES } from "@/modules/core/academic-structure/constants";
import type { AdmissionActionState } from "@/modules/matriculas/actions";
import { calculateAdmissionFees, formatCop } from "@/modules/matriculas/catalog";
import {
  daysUntil,
  EARLY_BIRD_DEADLINE_2027,
  earlyBirdAtSubmission,
} from "@/modules/matriculas/discount-policy";
import type { PublicGradeOption, RenewalChildCandidate } from "@/modules/matriculas/queries";

const STEPS = [
  { title: "Grado", hint: "Tipo de familia y grado 2027" },
  { title: "Estudiante", hint: "Datos del Registro Civil o TI" },
  { title: "Acudiente", hint: "Responsable y contacto" },
  { title: "Beneficios", hint: "Descuentos y confirmación" },
] as const;

const DEADLINE_LABEL = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
}).format(new Date(`${EARLY_BIRD_DEADLINE_2027}T12:00:00Z`));

interface Summary {
  student: string;
  studentDoc: string;
  guardian: string;
  contact: string;
}

/**
 * Asistente de solicitud de matrícula en 4 pasos. Todos los pasos viven en el
 * mismo `<form>` (los ocultos también se envían); cada paso se valida con
 * `reportValidity()` antes de avanzar, así la familia nunca se pierde.
 * Los descuentos NO se autodeclaran: pronto pago depende de la fecha y
 * hermanos se verifica en servidor.
 */
export function AdmissionApplyWizard({
  grades,
  renewalCandidates,
  isLoggedGuardian,
  today,
  createAction,
  createState,
  creating,
}: {
  grades: PublicGradeOption[];
  renewalCandidates: RenewalChildCandidate[];
  isLoggedGuardian: boolean;
  today: string;
  createAction: (formData: FormData) => void;
  createState: AdmissionActionState;
  creating: boolean;
}) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [applicationType, setApplicationType] = useState<"NEW" | "RENEWAL">(
    renewalCandidates.length > 0 ? "RENEWAL" : "NEW",
  );
  const [selectedRenewalId, setSelectedRenewalId] = useState<string>(renewalCandidates[0]?.studentId ?? "");
  const renewalChild = renewalCandidates.find((c) => c.studentId === selectedRenewalId) ?? null;
  const [selectedGradeId, setSelectedGradeId] = useState<string>(
    renewalChild?.suggestedNextGradeId ?? grades[0]?.id ?? "",
  );
  const [claimsSibling, setClaimsSibling] = useState(false);

  const earlyBirdOpen = earlyBirdAtSubmission(today) === "ELIGIBLE";
  const daysLeft = daysUntil(today);
  const prefill = (value: string | null | undefined, fallback = "") =>
    applicationType === "RENEWAL" ? value ?? fallback : fallback;

  const selectedGrade = useMemo(
    () => grades.find((g) => g.id === selectedGradeId) ?? grades[0],
    [grades, selectedGradeId],
  );
  const fees = useMemo(
    () =>
      calculateAdmissionFees({
        levelCode: selectedGrade?.levelCode ?? "PRIMARIA",
        hasEarlyBirdDiscount: earlyBirdOpen,
        hasSiblingDiscount: claimsSibling,
      }),
    [selectedGrade, earlyBirdOpen, claimsSibling],
  );

  function stepIsValid(index: number): boolean {
    const section = formRef.current?.querySelector<HTMLElement>(`[data-step="${index}"]`);
    if (!section) return true;
    const fields = section.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select");
    for (const field of fields) {
      if (!field.checkValidity()) {
        // Mostrar el paso antes de señalar el campo, para que el foco sea visible.
        setStep(index);
        requestAnimationFrame(() => field.reportValidity());
        return false;
      }
    }
    return true;
  }

  function readSummary() {
    const data = new FormData(formRef.current ?? undefined);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    setSummary({
      student: `${text("studentFirstName")} ${text("studentLastName")}`.trim(),
      studentDoc: `${text("studentDocType")} ${text("studentDocNumber")}`.trim(),
      guardian: `${text("guardianFirstName")} ${text("guardianLastName")}`.trim(),
      contact: [text("guardianEmail"), text("guardianPhone")].filter(Boolean).join(" · "),
    });
  }

  function goTo(target: number) {
    if (target <= step) {
      setStep(target);
      return;
    }
    for (let s = step; s < target; s++) {
      if (!stepIsValid(s)) return;
    }
    if (target === STEPS.length - 1) readSummary();
    setStep(target);
    setReached((r) => Math.max(r, target));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    // Enter en un campo avanza de paso en lugar de enviar un formulario incompleto.
    const target = event.target as HTMLElement;
    if (event.key === "Enter" && target.tagName === "INPUT" && step < STEPS.length - 1) {
      event.preventDefault();
      goTo(step + 1);
    }
  }

  const sectionClass = "grid gap-5 rounded-2xl border border-line bg-white p-6 shadow-xs";
  const isLast = step === STEPS.length - 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:items-start">
      <form ref={formRef} action={createAction} onKeyDown={onKeyDown} className="grid scroll-mt-6 gap-5">
        {/* Progreso */}
        <nav aria-label="Pasos de la solicitud" className="rounded-2xl border border-line bg-white p-4 shadow-xs">
          <ol className="grid grid-cols-4 gap-2">
            {STEPS.map((s, i) => {
              const done = i < step;
              const current = i === step;
              const reachable = i <= reached;
              return (
                <li key={s.title}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    disabled={!reachable && i !== step + 1}
                    aria-current={current ? "step" : undefined}
                    className="group grid w-full gap-2 rounded-xl p-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt disabled:cursor-not-allowed"
                  >
                    <span
                      className={`h-1.5 rounded-full transition-colors duration-300 ${
                        done || current ? "bg-cobalt" : "bg-line"
                      }`}
                    />
                    <span className="flex items-center gap-2">
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-lg text-xs font-black transition-colors ${
                          done
                            ? "bg-green-solid text-white"
                            : current
                              ? "bg-cobalt text-yellow"
                              : "bg-bg-2 text-muted"
                        }`}
                      >
                        {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block truncate text-xs font-extrabold ${current ? "text-navy" : "text-muted"}`}
                        >
                          {s.title}
                        </span>
                        <span className="hidden truncate text-[0.68rem] text-muted md:block">{s.hint}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="sr-only" aria-live="polite">
            Paso {step + 1} de {STEPS.length}: {STEPS[step]?.hint}
          </p>
        </nav>

        {/* Paso 1 · Grado */}
        <section data-step="0" hidden={step !== 0} className={sectionClass}>
          <header>
            <h2 className="text-lg font-extrabold text-navy">¿Para quién es la matrícula 2027?</h2>
            <p className="text-sm text-muted">Con esto calculamos los valores exactos del grado.</p>
          </header>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Tipo de familia</legend>
            {(
              [
                ["NEW", "Familia nueva", "Primer ingreso al Liceo Lunita de Chía"],
                ["RENEWAL", "Renovación", "Estudiante actual que continúa en 2027"],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all ${
                  applicationType === value
                    ? "border-cobalt bg-cloud/70"
                    : "border-line bg-white hover:border-line-2 hover:bg-bg-2/40"
                }`}
              >
                <input
                  type="radio"
                  name="applicationType"
                  value={value}
                  checked={applicationType === value}
                  onChange={() => setApplicationType(value)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-extrabold text-navy">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {applicationType === "RENEWAL" && renewalCandidates.length > 0 && (
            <div className="rounded-xl border border-green-solid/35 bg-green-l/45 p-4">
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
                className="input mt-1 min-h-11 bg-white text-sm font-bold"
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
              required
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
              className="input mt-1 min-h-11 text-sm font-bold"
            >
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} — {g.levelName}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Paso 2 · Estudiante */}
        <section
          key={`stu-${selectedRenewalId}-${applicationType}`}
          data-step="1"
          hidden={step !== 1}
          className={sectionClass}
        >
          <header>
            <h2 className="text-lg font-extrabold text-navy">Datos del estudiante</h2>
            <p className="text-sm text-muted">Tal como aparecen en el Registro Civil o la Tarjeta de Identidad.</p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-sf`} className="field-label">Nombres *</label>
              <input
                id={`${id}-sf`}
                name="studentFirstName"
                required
                minLength={2}
                autoComplete="off"
                defaultValue={prefill(renewalChild?.firstName)}
                placeholder="Ej. Samuel Alejandro"
                className="input mt-1 min-h-11 text-sm"
              />
            </div>
            <div>
              <label htmlFor={`${id}-sl`} className="field-label">Apellidos *</label>
              <input
                id={`${id}-sl`}
                name="studentLastName"
                required
                minLength={2}
                autoComplete="off"
                defaultValue={prefill(renewalChild?.lastName)}
                placeholder="Ej. Torres Méndez"
                className="input mt-1 min-h-11 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor={`${id}-sdt`} className="field-label">Tipo de documento *</label>
              <select
                id={`${id}-sdt`}
                name="studentDocType"
                defaultValue={prefill(renewalChild?.documentType, "TI")}
                className="input mt-1 min-h-11 text-sm"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-sdn`} className="field-label">Número de documento *</label>
              <input
                id={`${id}-sdn`}
                name="studentDocNumber"
                required
                minLength={5}
                inputMode="numeric"
                defaultValue={prefill(renewalChild?.documentNumber)}
                placeholder="Sin puntos ni espacios"
                className="input mt-1 min-h-11 text-sm tabular"
              />
            </div>
            <div>
              <label htmlFor={`${id}-sbd`} className="field-label">Fecha de nacimiento</label>
              <input id={`${id}-sbd`} name="studentBirthDate" type="date" className="input mt-1 min-h-11 text-sm" />
            </div>
          </div>

          <details className="group rounded-xl border border-line bg-bg-2/40 px-4 py-3">
            <summary className="cursor-pointer text-sm font-bold text-navy">
              Salud y colegio anterior <span className="font-normal text-muted">(opcional)</span>
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor={`${id}-eps`} className="field-label">EPS</label>
                <input id={`${id}-eps`} name="studentEps" placeholder="Sanitas / Sura / Compensar" className="input mt-1 min-h-11 text-sm" />
              </div>
              <div>
                <label htmlFor={`${id}-rh`} className="field-label">Grupo sanguíneo y RH</label>
                <input id={`${id}-rh`} name="studentBloodType" placeholder="Ej. O+" className="input mt-1 min-h-11 text-sm" />
              </div>
              <div>
                <label htmlFor={`${id}-prev`} className="field-label">Colegio anterior</label>
                <input id={`${id}-prev`} name="previousSchool" className="input mt-1 min-h-11 text-sm" />
              </div>
            </div>
          </details>
        </section>

        {/* Paso 3 · Acudiente */}
        <section
          key={`gua-${selectedRenewalId}-${applicationType}`}
          data-step="2"
          hidden={step !== 2}
          className={sectionClass}
        >
          <header>
            <h2 className="text-lg font-extrabold text-navy">Acudiente y responsable financiero</h2>
            <p className="text-sm text-muted">A este contacto le enviamos el estado del proceso y los accesos al Campus.</p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-gf`} className="field-label">Nombres *</label>
              <input
                id={`${id}-gf`}
                name="guardianFirstName"
                required
                minLength={2}
                autoComplete="given-name"
                defaultValue={prefill(renewalChild?.guardianFirstName)}
                className="input mt-1 min-h-11 text-sm"
              />
            </div>
            <div>
              <label htmlFor={`${id}-gl`} className="field-label">Apellidos *</label>
              <input
                id={`${id}-gl`}
                name="guardianLastName"
                required
                minLength={2}
                autoComplete="family-name"
                defaultValue={prefill(renewalChild?.guardianLastName)}
                className="input mt-1 min-h-11 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor={`${id}-gdt`} className="field-label">Tipo de documento *</label>
              <select
                id={`${id}-gdt`}
                name="guardianDocType"
                defaultValue={prefill(renewalChild?.guardianDocType, "CC")}
                className="input mt-1 min-h-11 text-sm"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-gdn`} className="field-label">Número de documento *</label>
              <input
                id={`${id}-gdn`}
                name="guardianDocNumber"
                required
                minLength={5}
                inputMode="numeric"
                defaultValue={prefill(renewalChild?.guardianDocNumber)}
                placeholder="Sin puntos"
                className="input mt-1 min-h-11 text-sm tabular"
              />
            </div>
            <div>
              <label htmlFor={`${id}-gph`} className="field-label">Celular / WhatsApp *</label>
              <input
                id={`${id}-gph`}
                name="guardianPhone"
                type="tel"
                required
                minLength={7}
                autoComplete="tel"
                defaultValue={prefill(renewalChild?.guardianPhone)}
                placeholder="300 000 0000"
                className="input mt-1 min-h-11 text-sm tabular"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-gem`} className="field-label">Correo electrónico *</label>
              <input
                id={`${id}-gem`}
                name="guardianEmail"
                type="email"
                required
                autoComplete="email"
                defaultValue={prefill(renewalChild?.guardianEmail)}
                placeholder="familia@correo.com"
                className="input mt-1 min-h-11 text-sm"
              />
            </div>
            <div>
              <label htmlFor={`${id}-addr`} className="field-label">Dirección en Chía / Sabana</label>
              <input
                id={`${id}-addr`}
                name="address"
                autoComplete="street-address"
                placeholder="Vereda / barrio y dirección"
                className="input mt-1 min-h-11 text-sm"
              />
            </div>
          </div>
        </section>

        {/* Paso 4 · Beneficios y confirmación */}
        <section data-step="3" hidden={step !== 3} className={sectionClass}>
          <header>
            <h2 className="text-lg font-extrabold text-navy">Beneficios y confirmación</h2>
            <p className="text-sm text-muted">
              Los descuentos no se marcan a mano: el Campus los valida con fechas y matrículas reales.
            </p>
          </header>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Pronto pago: automático por fecha */}
            <div
              className={`rounded-xl border p-4 ${
                earlyBirdOpen ? "border-green-solid/40 bg-green-l/45" : "border-line bg-bg-2/50"
              }`}
            >
              <p className="inline-flex items-center gap-2 text-sm font-extrabold text-navy">
                <CalendarClock className="size-4 text-cobalt" aria-hidden /> Pronto pago · −10% matrícula
              </p>
              {earlyBirdOpen ? (
                <>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
                    Se aplica <strong>automáticamente</strong> y se confirma si reportas el pago a más tardar el{" "}
                    <strong>{DEADLINE_LABEL}</strong>.
                  </p>
                  <p className="mt-2 inline-flex rounded-pill bg-white px-2.5 py-1 text-xs font-extrabold text-green-solid">
                    {daysLeft === 0 ? "Hoy es el último día" : `Quedan ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  La fecha de pronto pago ({DEADLINE_LABEL}) ya pasó. La matrícula se liquida con el valor pleno.
                </p>
              )}
            </div>

            {/* Hermanos: se declara y el servidor lo verifica */}
            <div className={`rounded-xl border p-4 ${claimsSibling ? "border-cobalt/40 bg-cloud/60" : "border-line bg-white"}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="claimsSibling"
                  checked={claimsSibling}
                  onChange={(e) => setClaimsSibling(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="inline-flex items-center gap-2 text-sm font-extrabold text-navy">
                    <Users className="size-4 text-cobalt" aria-hidden /> Hermanos en el Liceo · −8% pensión
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {isLoggedGuardian
                      ? "Con tu sesión de familia lo verificamos al instante."
                      : "Marca si otro hijo(a) estudia hoy con nosotros."}
                  </span>
                </span>
              </label>
              {claimsSibling && (
                <div className="mt-3">
                  <label htmlFor={`${id}-sib`} className="field-label">
                    Documento del hermano(a) que estudia en el Liceo{isLoggedGuardian ? "" : " *"}
                  </label>
                  <input
                    id={`${id}-sib`}
                    name="siblingDocNumber"
                    required={!isLoggedGuardian}
                    minLength={5}
                    inputMode="numeric"
                    placeholder="Sin puntos"
                    className="input mt-1 min-h-11 bg-white text-sm tabular"
                  />
                  <p className="mt-1.5 text-[0.72rem] leading-relaxed text-muted">
                    Lo comparamos con las matrículas activas y el acudiente registrado. Si no coincide, Secretaría lo
                    revisa y te avisa.
                  </p>
                </div>
              )}
            </div>
          </div>

          {summary && (
            <dl className="grid gap-x-6 gap-y-3 rounded-xl border border-line bg-bg-2/40 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[0.68rem] font-bold text-muted uppercase">Estudiante</dt>
                <dd className="font-bold text-navy">{summary.student}</dd>
                <dd className="text-xs text-muted tabular">{summary.studentDoc}</dd>
              </div>
              <div>
                <dt className="text-[0.68rem] font-bold text-muted uppercase">Grado 2027</dt>
                <dd className="font-bold text-navy">{selectedGrade?.name}</dd>
                <dd className="text-xs text-muted">{applicationType === "RENEWAL" ? "Renovación" : "Familia nueva"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[0.68rem] font-bold text-muted uppercase">Acudiente</dt>
                <dd className="font-bold text-navy">{summary.guardian}</dd>
                <dd className="text-xs text-muted">{summary.contact}</dd>
              </div>
            </dl>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-cobalt/25 bg-cloud/65 p-4 text-xs leading-relaxed text-ink-2">
            <input type="checkbox" name="habeasDataAccepted" required className="mt-0.5 shrink-0" />
            <span>
              <strong className="text-navy">Autorización Ley 1581 de 2012 (datos de menores):</strong> autorizo al
              Liceo Lunita de Chía a tratar los datos y documentos aquí registrados solo con fines educativos y de
              matrícula.
            </span>
          </label>

          {createState.status === "error" && createState.message && (
            <p role="alert" className="text-sm font-semibold text-red-solid">
              {createState.message}
            </p>
          )}
        </section>

        {/* Navegación del asistente */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            className={`${pillButtonClass({ variant: "outline" })} disabled:invisible`}
          >
            <ArrowLeft aria-hidden /> Atrás
          </button>
          <span className="text-xs font-semibold text-muted tabular">
            Paso {step + 1} de {STEPS.length}
          </span>
          {isLast ? (
            <button type="submit" disabled={creating} className={pillButtonClass({ variant: "navy" })}>
              {creating ? "Radicando…" : "Radicar solicitud"}
              <ArrowRight aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={() => goTo(step + 1)} className={pillButtonClass({ variant: "navy" })}>
              Continuar <ArrowRight aria-hidden />
            </button>
          )}
        </div>
      </form>

      {/* Calculadora transparente lateral */}
      <aside className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm lg:sticky lg:top-6">
        <div
          className="px-5 py-5 text-white"
          style={{ background: "linear-gradient(130deg, #0F1747 0%, #242A82 60%, #303296 100%)" }}
        >
          <div className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-yellow uppercase">
            <Calculator className="size-4" aria-hidden /> Calculadora 2027
          </div>
          <p className="mt-2 text-lg font-black text-white">
            {selectedGrade?.name} · {selectedGrade?.levelName}
          </p>
          <p className="mt-0.5 text-xs text-white/80">Valores estimados, sin cobros ocultos.</p>
        </div>

        <dl className="grid gap-2.5 p-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Matrícula</dt>
            <dd className="font-semibold text-navy tabular">{formatCop(fees.enrollmentBase)}</dd>
          </div>
          {fees.enrollmentDiscount > 0 && (
            <div className="flex justify-between gap-2 text-green-solid">
              <dt className="inline-flex items-start gap-1">
                <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  Pronto pago
                  <span className="block text-[0.68rem] font-semibold">si pagas hasta el {DEADLINE_LABEL}</span>
                </span>
              </dt>
              <dd className="font-bold tabular">−{formatCop(fees.enrollmentDiscount)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between rounded-xl bg-cloud/80 px-3.5 py-2.5">
            <dt className="text-xs font-extrabold text-navy uppercase">Total matrícula</dt>
            <dd className="text-xl font-black text-cobalt tabular">{formatCop(fees.enrollmentFinal)}</dd>
          </div>

          <div className="mt-2 flex justify-between">
            <dt className="text-muted">Pensión mensual (feb–nov)</dt>
            <dd className="font-semibold text-navy tabular">{formatCop(fees.monthlyBase)}</dd>
          </div>
          {fees.monthlyDiscount > 0 && (
            <div className="flex justify-between gap-2 text-orange-solid">
              <dt className="inline-flex items-start gap-1">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  Hermanos (−8%)
                  <span className="block text-[0.68rem] font-semibold">por verificar</span>
                </span>
              </dt>
              <dd className="font-bold tabular">−{formatCop(fees.monthlyDiscount)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-line pt-2.5">
            <dt className="text-sm font-extrabold text-navy">Pensión neta</dt>
            <dd className="text-lg font-black text-navy tabular">{formatCop(fees.monthlyFinal)}</dd>
          </div>
        </dl>

        <div className="grid gap-3 border-t border-line p-5 pt-4 text-xs text-muted">
          <p className="inline-flex items-start gap-1.5 leading-relaxed">
            <CreditCard className="mt-0.5 size-3.5 shrink-0 text-cobalt" aria-hidden />
            Nequi · Daviplata · Bre-B · PSE · Transferencia · Tesorería
          </p>
          <p className="inline-flex items-start gap-1.5 leading-relaxed">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-cobalt" aria-hidden />
            Documentos en bóveda privada con acceso exclusivo de Secretaría.
          </p>
        </div>
      </aside>
    </div>
  );
}
