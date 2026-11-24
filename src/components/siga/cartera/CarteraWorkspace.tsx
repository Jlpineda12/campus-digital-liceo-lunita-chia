"use client";

import {
  AlertCircle,
  ArrowUpDown,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Filter,
  Lock,
  Percent,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  Table2,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { pillButtonClass } from "@/components/ui/PillButton";
import { emitToast } from "@/components/ui/ToastViewport";
import { PAYMENT_CHANNELS, type PaymentChannel } from "@/db/schema/matriculas";
import { LEVEL_CODES, LEVEL_LABELS, type LevelCode } from "@/modules/core/academic-structure/constants";
import {
  BILLING_STATUS_META,
  formatCop,
  PAYMENT_CHANNEL_LABELS,
} from "@/modules/matriculas/catalog";
import {
  applyDiscountOrWaiveAction,
  generateYearChargesAction,
  issuePazYSalvoAction,
  recordPaymentAction,
  type CarteraActionState,
} from "@/modules/siga/cartera/actions";
import { BILLING_MONTH_COLUMNS } from "@/modules/siga/cartera/calculator";
import type {
  AdminBillingAccountRow,
  BillingChargeView,
  CourseGroupOption,
  FamilyBillingStatement,
  LedgerReceiptRow,
} from "@/modules/siga/cartera/queries";

const INITIAL: CarteraActionState = { status: "idle" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Bogota",
});

function PazYSalvoButton({
  enrollmentId,
  existingCode,
  compact = false,
}: {
  enrollmentId: string;
  existingCode: string | null;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(issuePazYSalvoAction, INITIAL);

  useEffect(() => {
    if (state.status === "success" && state.message) {
      emitToast({ title: "Paz y Salvo listo", description: state.message, tone: "success" });
    } else if (state.status === "error" && state.message) {
      emitToast({ title: "No pudimos emitir el Paz y Salvo", description: state.message, tone: "error" });
    }
  }, [state]);

  if (existingCode) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href={`/verificar/${existingCode}`}
          target="_blank"
          className="inline-flex items-center gap-1 rounded-pill border border-green-solid/35 bg-green-l/55 px-2.5 py-1 text-[0.72rem] font-extrabold text-green-solid no-underline hover:bg-green-l"
        >
          <ShieldCheck className="size-3.5" aria-hidden />
          {compact ? "Paz y Salvo" : `Paz y Salvo · ${existingCode}`}
          <ExternalLink className="size-3" aria-hidden />
        </Link>
        {!compact && (
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex items-center gap-1 rounded-control border border-line-2 bg-white px-2.5 py-1 text-xs font-bold text-navy hover:bg-cloud"
          >
            <Printer className="size-3.5" aria-hidden /> Imprimir
          </button>
        )}
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <button
        type="submit"
        disabled={pending}
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-pill border border-green-solid/35 bg-green-l/40 px-2.5 py-1 text-[0.7rem] font-bold text-green-solid hover:bg-green-l"
            : pillButtonClass({ variant: "navy", size: "sm" })
        }
      >
        <ShieldCheck className="size-3.5" aria-hidden />
        {pending ? "…" : compact ? "Emitir PyS" : "Emitir Paz y Salvo QR"}
      </button>
    </form>
  );
}

/* ===========================================================================
   VISTA FAMILIA / RESPONSABLE FINANCIERO
   =========================================================================== */

export function FamilyCarteraView({
  statement,
  yearName,
}: {
  statement: FamilyBillingStatement;
  yearName: string;
}) {
  const { summary, charges, pazYSalvo } = statement;
  const paidPct = summary.totalNetCop > 0 ? Math.round((summary.totalPaidCop / summary.totalNetCop) * 100) : 100;
  const byMonth = new Map(charges.map((c) => [c.billingMonth, c]));

  return (
    <div className="grid gap-6">
      <section className="card grid gap-5 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-cobalt uppercase">
              <Lock className="size-3.5" aria-hidden /> Estado de cuenta privado · {yearName}
            </p>
            <h2 className="mt-0.5 text-xl font-black text-navy">
              {statement.studentName} · {statement.gradeName} ({statement.groupName})
            </h2>
          </div>

          {summary.isClear ? (
            <PazYSalvoButton
              enrollmentId={statement.enrollmentId}
              existingCode={pazYSalvo?.verificationCode ?? null}
            />
          ) : (
            <Chip tone={summary.overdueCount > 0 ? "red" : "orange"}>
              {summary.overdueCount > 0
                ? `${summary.overdueCount} cuota${summary.overdueCount === 1 ? "" : "s"} vencida${summary.overdueCount === 1 ? "" : "s"}`
                : "Con saldo pendiente"}
            </Chip>
          )}
        </div>

        {/* Línea visual rápida Matrícula + Feb → Nov */}
        <div>
          <p className="mb-2 text-[0.7rem] font-extrabold tracking-wider text-muted uppercase">
            Calendario de pagos del año (Matrícula + Febrero a Noviembre)
          </p>
          <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
            {BILLING_MONTH_COLUMNS.map((m) => {
              const ch = byMonth.get(m.month);
              const tone = !ch
                ? "border-line bg-bg-2/60 text-muted"
                : ch.status === "PAID" || ch.status === "WAIVED"
                  ? "border-green-solid/35 bg-green-l/60 text-green-solid"
                  : ch.status === "OVERDUE"
                    ? "border-red-solid/40 bg-red-l/65 text-red-solid"
                    : ch.status === "PARTIAL"
                      ? "border-sky-solid/40 bg-sky-l/65 text-sky-solid"
                      : "border-orange-solid/35 bg-orange-l/60 text-orange-solid";

              return (
                <li
                  key={m.month}
                  title={ch ? `${ch.concept}: ${BILLING_STATUS_META[ch.status].label}` : m.label}
                  className={`flex flex-col items-center justify-center rounded-control border px-2 py-2 text-center ${tone}`}
                >
                  <span className="text-[0.72rem] font-extrabold">{m.shortLabel}</span>
                  <span className="mt-1">
                    {!ch ? (
                      "—"
                    ) : ch.status === "PAID" || ch.status === "WAIVED" ? (
                      <Check className="size-3.5" aria-hidden />
                    ) : ch.status === "OVERDUE" ? (
                      <AlertCircle className="size-3.5" aria-hidden />
                    ) : (
                      <Clock className="size-3.5" aria-hidden />
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="grid divide-y divide-line rounded-control border border-line bg-bg-2/50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-4 py-3.5">
            <p className="text-[0.7rem] font-bold text-muted uppercase">Total anual neto</p>
            <p className="mt-1 text-xl font-black text-navy tabular">{formatCop(summary.totalNetCop)}</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[0.7rem] font-bold text-muted uppercase">Pagado ({paidPct}%)</p>
            <p className="mt-1 text-xl font-black text-green-solid tabular">{formatCop(summary.totalPaidCop)}</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[0.7rem] font-bold text-muted uppercase">Saldo pendiente</p>
            <p className="mt-1 text-xl font-black text-cobalt tabular">{formatCop(summary.totalPendingCop)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-cloud/75 px-4 py-3 text-xs text-ink-2">
          <span className="inline-flex items-center gap-2 font-semibold text-navy">
            <CreditCard className="size-4 text-cobalt" aria-hidden />
            Medios de pago: Nequi · Daviplata · Bre-B · PSE · Tesorería del colegio.
          </span>
          <span className="text-muted">Solo el responsable financiero autorizado puede ver esta información.</span>
        </div>
      </section>

      {charges.length === 0 ? (
        <div className="card py-10 text-center text-sm text-muted">
          Aún no se han generado cuotas para este año lectivo.
        </div>
      ) : (
        <section className="card overflow-hidden bg-white p-0">
          <div className="border-b border-line px-5 py-3.5">
            <h3 className="text-sm font-extrabold text-navy">Detalle de cuotas y recibos oficiales</h3>
          </div>
          <ul className="divide-y divide-line">
            {charges.map((c) => {
              const meta = BILLING_STATUS_META[c.status];
              return (
                <li key={c.id} className="grid gap-2 px-5 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-navy">{c.concept}</p>
                      <Chip tone={meta.tone}>{meta.label}</Chip>
                      {c.discountCop > 0 && (
                        <span className="rounded-pill bg-purple-l px-2 py-0.5 text-[0.68rem] font-bold text-purple-solid">
                          Descuento -{formatCop(c.discountCop)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted tabular">
                      Vence: {c.dueDate} · Valor neto: {formatCop(c.netCop)}
                      {c.paidCop > 0 && ` · Abonado: ${formatCop(c.paidCop)}`}
                    </p>
                    {c.payments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.payments.map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1 rounded-pill bg-green-l/55 px-2.5 py-0.5 text-[0.7rem] font-bold text-green-solid"
                          >
                            <Receipt className="size-3" aria-hidden />
                            {p.receiptNumber} · {PAYMENT_CHANNEL_LABELS[p.channel]} · {dateFormat.format(p.paidAt)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-right tabular">
                    <p className="text-sm font-black text-navy">
                      {c.pendingCop > 0 ? formatCop(c.pendingCop) : "Saldado"}
                    </p>
                    <p className="text-[0.68rem] text-muted">{c.pendingCop > 0 ? "Saldo" : "Al día"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ===========================================================================
   MODAL INTERACTIVO DE CUOTA (REGISTRAR PAGO O APLICAR BECA / DESCUENTO)
   =========================================================================== */

function ChargeDetailModal({
  studentName,
  groupName,
  charge,
  onClose,
}: {
  studentName: string;
  groupName: string;
  charge: BillingChargeView;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"pay" | "discount">("pay");
  const [payState, payAction, paying] = useActionState(recordPaymentAction, INITIAL);
  const [discState, discAction, savingDisc] = useActionState(applyDiscountOrWaiveAction, INITIAL);

  useEffect(() => {
    if (payState.status === "success" && payState.message) {
      emitToast({ title: "Pago registrado", description: payState.message, tone: "success" });
    } else if (payState.status === "error" && payState.message) {
      emitToast({ title: "No pudimos registrar el pago", description: payState.message, tone: "error" });
    }
  }, [payState]);

  useEffect(() => {
    if (discState.status === "success" && discState.message) {
      emitToast({ title: "Ajuste aplicado", description: discState.message, tone: "success" });
    } else if (discState.status === "error" && discState.message) {
      emitToast({ title: "No pudimos aplicar el ajuste", description: discState.message, tone: "error" });
    }
  }, [discState]);

  const meta = BILLING_STATUS_META[charge.status];

  return (
    <div className="fixed inset-0 z-60 grid place-items-center bg-navy/55 p-4 backdrop-blur-xs">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Gestionar ${charge.concept}`}
        className="card max-h-[90dvh] w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <p className="text-[0.7rem] font-extrabold tracking-wider text-cobalt uppercase">
              {studentName} · Grupo {groupName}
            </p>
            <h2 className="mt-0.5 text-lg font-black text-navy">{charge.concept}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle de cuota"
            className="grid size-8 place-items-center rounded-control text-muted hover:bg-cloud hover:text-navy"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* Resumen financiero de la celda */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-control border border-line bg-bg-2/70 p-3 text-xs sm:grid-cols-4">
          <div>
            <p className="font-bold text-muted uppercase">Base</p>
            <p className="mt-0.5 font-extrabold text-navy tabular">{formatCop(charge.amountCop)}</p>
          </div>
          <div>
            <p className="font-bold text-muted uppercase">Descuento</p>
            <p className="mt-0.5 font-extrabold text-purple-solid tabular">-{formatCop(charge.discountCop)}</p>
          </div>
          <div>
            <p className="font-bold text-muted uppercase">Pagado</p>
            <p className="mt-0.5 font-extrabold text-green-solid tabular">{formatCop(charge.paidCop)}</p>
          </div>
          <div>
            <p className="font-bold text-muted uppercase">Saldo</p>
            <p className="mt-0.5 font-black text-cobalt tabular">{formatCop(charge.pendingCop)}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted tabular">Fecha límite: {charge.dueDate}</span>
          <Chip tone={meta.tone}>{meta.label}</Chip>
        </div>

        {/* Selector de acción: Registrar Pago vs Descuento/Beca */}
        <div className="mt-4 flex gap-1.5 border-b border-line pb-3">
          <button
            type="button"
            onClick={() => setTab("pay")}
            className={`inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === "pay" ? "bg-navy text-white" : "bg-bg-2 text-navy hover:bg-cloud"
            }`}
          >
            <CreditCard className="size-3.5" aria-hidden /> Registrar pago
          </button>
          <button
            type="button"
            onClick={() => setTab("discount")}
            className={`inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === "discount" ? "bg-navy text-white" : "bg-bg-2 text-navy hover:bg-cloud"
            }`}
          >
            <Percent className="size-3.5" aria-hidden /> Beca / descuento / exonerar
          </button>
        </div>

        {tab === "pay" ? (
          charge.pendingCop <= 0 ? (
            <div className="mt-4 flex items-center gap-2 rounded-control bg-green-l/55 px-4 py-3 text-sm font-bold text-green-solid">
              <CheckCircle2 className="size-4" aria-hidden /> Esta cuota ya está totalmente cubierta.
            </div>
          ) : (
            <form action={payAction} className="mt-4 grid gap-3">
              <input type="hidden" name="chargeId" value={charge.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">Monto a abonar (COP)</label>
                  <input
                    name="amountCop"
                    type="number"
                    min={1000}
                    max={charge.pendingCop}
                    defaultValue={charge.pendingCop}
                    required
                    className="input min-h-10 text-base font-bold tabular sm:text-sm"
                  />
                </div>
                <div>
                  <label className="field-label">Canal de pago</label>
                  <select name="channel" defaultValue="NEQUI" className="input min-h-10 text-sm">
                    {PAYMENT_CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {PAYMENT_CHANNEL_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label">Referencia / N° transacción</label>
                <input
                  name="referenceCode"
                  required
                  placeholder="Ej. NQ-847291 o PSE-9021"
                  className="input min-h-10 text-base sm:text-sm"
                />
              </div>
              <div>
                <label className="field-label">Nota interna (opcional)</label>
                <input
                  name="notes"
                  placeholder="Ej. Pago verificado en extracto bancario"
                  className="input min-h-10 text-base font-normal sm:text-sm"
                />
              </div>
              {payState.message && (
                <p
                  role={payState.status === "error" ? "alert" : "status"}
                  className={`text-xs font-semibold ${
                    payState.status === "error" ? "text-red-solid" : "text-green-solid"
                  }`}
                >
                  {payState.message}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className={pillButtonClass({ variant: "outline", size: "sm" })}>
                  Cerrar
                </button>
                <button type="submit" disabled={paying} className={pillButtonClass({ variant: "navy", size: "sm" })}>
                  {paying ? "Registrando…" : "Guardar pago y emitir recibo"}
                </button>
              </div>
            </form>
          )
        ) : (
          <form action={discAction} className="mt-4 grid gap-3">
            <input type="hidden" name="chargeId" value={charge.id} />
            <div>
              <label className="field-label">Descuento en COP (ej. beca o hermanos)</label>
              <input
                name="discountCop"
                type="number"
                min={0}
                max={charge.amountCop}
                defaultValue={charge.discountCop}
                className="input min-h-10 text-base font-bold tabular sm:text-sm"
              />
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-navy">
              <input type="checkbox" name="waive" defaultChecked={charge.status === "WAIVED"} />
              Exonerar esta cuota al 100% (beca total / acuerdo rectoral)
            </label>
            <div>
              <label className="field-label">Motivo obligatorio (trazabilidad en auditoría)</label>
              <input
                name="reason"
                required
                minLength={4}
                placeholder="Ej. Beca académica 50% autorizada por Rectoría"
                className="input min-h-10 text-base font-normal sm:text-sm"
              />
            </div>
            {discState.message && (
              <p
                role={discState.status === "error" ? "alert" : "status"}
                className={`text-xs font-semibold ${
                  discState.status === "error" ? "text-red-solid" : "text-green-solid"
                }`}
              >
                {discState.message}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className={pillButtonClass({ variant: "outline", size: "sm" })}>
                Cerrar
              </button>
              <button type="submit" disabled={savingDisc} className={pillButtonClass({ variant: "navy", size: "sm" })}>
                {savingDisc ? "Aplicando…" : "Aplicar ajuste auditado"}
              </button>
            </div>
          </form>
        )}

        {/* Historial de recibos de esta cuota */}
        {charge.payments.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-[0.7rem] font-extrabold tracking-wider text-muted uppercase">
              Recibos registrados en esta cuota ({charge.payments.length})
            </p>
            <ul className="mt-2 grid gap-1.5">
              {charge.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-cloud/75 px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-mono font-extrabold text-cobalt">{p.receiptNumber}</span>
                    <span className="ml-2 font-semibold text-navy">{PAYMENT_CHANNEL_LABELS[p.channel]}</span>
                    <span className="ml-1.5 text-muted">· Ref. {p.referenceCode}</span>
                  </div>
                  <span className="font-black text-green-solid tabular">
                    {formatCop(p.amountCop)} · {dateFormat.format(p.paidAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

/* ===========================================================================
   VISTA TESORERÍA / RECTORÍA: MATRIZ MENSUAL (FEB–NOV) + GRÁFICAS EJECUTIVAS
   =========================================================================== */

type StatusFilter = "all" | "clear" | "pending" | "overdue" | "discounted";
type SortOrder = "course" | "name" | "debt_desc" | "overdue_desc";

function matchesBillingStatus(
  a: AdminBillingAccountRow,
  target: StatusFilter,
  monthFilter: "ALL" | number,
) {
  if (target === "all") return true;
  if (monthFilter === "ALL") {
    if (target === "clear") return a.isClear;
    if (target === "overdue") return a.overdueCount > 0;
    if (target === "pending") return !a.isClear && a.overdueCount === 0 && a.charges.length > 0;
    return a.charges.some((c) => c.discountCop > 0 || c.status === "WAIVED");
  }
  const ch = a.charges.find((c) => c.billingMonth === monthFilter);
  if (!ch) return false;
  if (target === "clear") return ch.status === "PAID" || ch.status === "WAIVED";
  if (target === "overdue") return ch.status === "OVERDUE";
  if (target === "pending") return ch.status === "PENDING" || ch.status === "PARTIAL";
  return ch.discountCop > 0 || ch.status === "WAIVED";
}

export function AdminCarteraBoard({
  academicYearId,
  yearNumber,
  courseGroups,
  accounts,
  ledgerReceipts,
}: {
  academicYearId: string;
  yearNumber: number;
  courseGroups: CourseGroupOption[];
  accounts: AdminBillingAccountRow[];
  ledgerReceipts: LedgerReceiptRow[];
}) {
  const [viewMode, setViewMode] = useState<"matrix" | "analytics">("matrix");
  const [levelFilter, setLevelFilter] = useState<"ALL" | LevelCode>("ALL");
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [monthFilter, setMonthFilter] = useState<"ALL" | number>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("course");
  const [query, setQuery] = useState("");
  const [selectedCell, setSelectedCell] = useState<{
    enrollmentId: string;
    chargeId: string;
  } | null>(null);

  const [genState, genAction, generating] = useActionState(generateYearChargesAction, INITIAL);

  useEffect(() => {
    if (genState.status === "success" && genState.message) {
      emitToast({ title: "Cartera sincronizada", description: genState.message, tone: "success" });
    } else if (genState.status === "error" && genState.message) {
      emitToast({ title: "Error al sincronizar cartera", description: genState.message, tone: "error" });
    }
  }, [genState]);

  // Cursos visibles según el nivel educativo seleccionado
  const visibleCourseGroups = useMemo(
    () => (levelFilter === "ALL" ? courseGroups : courseGroups.filter((g) => g.levelCode === levelFilter)),
    [courseGroups, levelFilter],
  );

  // Al cambiar de nivel, limpiar curso si ya no pertenece a ese nivel
  const handleSelectLevel = (nextLevel: "ALL" | LevelCode) => {
    setLevelFilter(nextLevel);
    if (nextLevel !== "ALL" && groupFilter !== "ALL") {
      const stillMatches = courseGroups.some(
        (g) => g.groupName === groupFilter && g.levelCode === nextLevel,
      );
      if (!stillMatches) setGroupFilter("ALL");
    }
  };

  // 1) Alcance estructural (Nivel + Curso): alimenta KPIs, gráficas, recibos y exportación Excel
  const scopeAccounts = useMemo(
    () =>
      accounts.filter((a) => {
        if (levelFilter !== "ALL" && a.levelCode !== levelFilter) return false;
        if (groupFilter !== "ALL" && a.groupName !== groupFilter) return false;
        return true;
      }),
    [accounts, levelFilter, groupFilter],
  );

  // Contadores dinámicos de estado para el Nivel + Curso + Mes actuales
  const statusCounts = useMemo(() => {
    let clear = 0;
    let pending = 0;
    let overdue = 0;
    let discounted = 0;
    for (const a of scopeAccounts) {
      if (monthFilter === "ALL") {
        if (a.isClear) clear += 1;
        else if (a.overdueCount > 0) overdue += 1;
        else if (a.charges.length > 0) pending += 1;
        if (a.charges.some((c) => c.discountCop > 0 || c.status === "WAIVED")) discounted += 1;
      } else {
        const ch = a.charges.find((c) => c.billingMonth === monthFilter);
        if (!ch) continue;
        if (ch.status === "PAID" || ch.status === "WAIVED") clear += 1;
        else if (ch.status === "OVERDUE") overdue += 1;
        else pending += 1;
        if (ch.discountCop > 0 || ch.status === "WAIVED") discounted += 1;
      }
    }
    return { all: scopeAccounts.length, clear, pending, overdue, discounted };
  }, [scopeAccounts, monthFilter]);

  // 2) Cuentas filtradas y ordenadas para la Matriz Mensual
  const filteredAccounts = useMemo(() => {
    const qNorm = query
      .trim()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();

    const list = scopeAccounts.filter((a) => {
      if (!matchesBillingStatus(a, statusFilter, monthFilter)) return false;
      if (!qNorm) return true;
      const hay = `${a.studentName} ${a.documentNumber} ${a.groupName} ${a.gradeName}`
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
      return hay.includes(qNorm);
    });

    const sorted = [...list];
    if (sortOrder === "name") {
      sorted.sort((a, b) => a.studentName.localeCompare(b.studentName, "es"));
    } else if (sortOrder === "debt_desc") {
      sorted.sort((a, b) => b.totalPendingCop - a.totalPendingCop || a.studentName.localeCompare(b.studentName, "es"));
    } else if (sortOrder === "overdue_desc") {
      sorted.sort((a, b) => b.overdueCount - a.overdueCount || b.totalPendingCop - a.totalPendingCop);
    } else {
      sorted.sort(
        (a, b) =>
          a.gradeOrder - b.gradeOrder ||
          a.groupName.localeCompare(b.groupName, "es") ||
          a.studentName.localeCompare(b.studentName, "es"),
      );
    }
    return sorted;
  }, [scopeAccounts, monthFilter, statusFilter, query, sortOrder]);

  // KPIs reactivos según Nivel + Curso seleccionado
  const scopeTotals = useMemo(() => {
    const totalBilledCop = scopeAccounts.reduce((s, a) => s + a.totalNetCop, 0);
    const totalCollectedCop = scopeAccounts.reduce((s, a) => s + a.totalPaidCop, 0);
    const totalPendingCop = scopeAccounts.reduce((s, a) => s + a.totalPendingCop, 0);
    const collectionPercent =
      totalBilledCop > 0 ? Math.round((totalCollectedCop / totalBilledCop) * 100) : 100;
    return {
      totalStudents: scopeAccounts.length,
      totalBilledCop,
      totalCollectedCop,
      totalPendingCop,
      collectionPercent,
      clearCount: scopeAccounts.filter((a) => a.isClear).length,
      pendingCount: scopeAccounts.filter((a) => !a.isClear && a.overdueCount === 0 && a.charges.length > 0).length,
      overdueCount: scopeAccounts.filter((a) => a.overdueCount > 0).length,
    };
  }, [scopeAccounts]);

  // Resumen mensual y canales reactivos según Nivel + Curso seleccionado
  const scopeMonthlySummary = useMemo(() => {
    return BILLING_MONTH_COLUMNS.map((m) => {
      let billedCop = 0;
      let collectedCop = 0;
      let pendingCop = 0;
      let paidCount = 0;
      let overdueCount = 0;
      for (const acc of scopeAccounts) {
        const ch = acc.charges.find((c) => c.billingMonth === m.month);
        if (!ch || ch.status === "WAIVED") continue;
        billedCop += ch.netCop;
        collectedCop += Math.min(ch.netCop, ch.paidCop);
        pendingCop += ch.pendingCop;
        if (ch.status === "PAID") paidCount += 1;
        if (ch.status === "OVERDUE") overdueCount += 1;
      }
      return {
        month: m.month,
        shortLabel: m.shortLabel,
        label: m.label,
        billedCop,
        collectedCop,
        pendingCop,
        paidCount,
        overdueCount,
        collectionPercent: billedCop > 0 ? Math.round((collectedCop / billedCop) * 100) : 0,
      };
    });
  }, [scopeAccounts]);

  const scopeReceipts = useMemo(
    () =>
      ledgerReceipts.filter((r) => {
        if (levelFilter !== "ALL" && r.levelCode !== levelFilter) return false;
        if (groupFilter !== "ALL" && r.groupName !== groupFilter) return false;
        return true;
      }),
    [ledgerReceipts, levelFilter, groupFilter],
  );

  const scopeChannelSummary = useMemo(() => {
    const map = new Map<PaymentChannel, { totalCop: number; paymentCount: number }>(
      PAYMENT_CHANNELS.map((ch) => [ch, { totalCop: 0, paymentCount: 0 }]),
    );
    for (const r of scopeReceipts) {
      const b = map.get(r.channel);
      if (b) {
        b.totalCop += r.amountCop;
        b.paymentCount += 1;
      }
    }
    return PAYMENT_CHANNELS.map((ch) => ({
      channel: ch,
      ...(map.get(ch) ?? { totalCop: 0, paymentCount: 0 }),
    })).sort((a, b) => b.totalCop - a.totalCop);
  }, [scopeReceipts]);

  // Totales del pie de tabla (<tfoot>) para las filas actualmente filtradas
  const matrixFooter = useMemo(() => {
    const perMonth = new Map<number, { paid: number; total: number; pendingCop: number }>();
    for (const m of BILLING_MONTH_COLUMNS) perMonth.set(m.month, { paid: 0, total: 0, pendingCop: 0 });
    let pendingSum = 0;
    for (const acc of filteredAccounts) {
      pendingSum += acc.totalPendingCop;
      for (const ch of acc.charges) {
        const b = perMonth.get(ch.billingMonth);
        if (!b) continue;
        b.total += 1;
        if (ch.status === "PAID" || ch.status === "WAIVED") b.paid += 1;
        b.pendingCop += ch.pendingCop;
      }
    }
    return { perMonth, pendingSum };
  }, [filteredAccounts]);

  // Conteo de estudiantes por nivel educativo
  const levelCounts = useMemo(() => {
    const map: Record<LevelCode, number> = { PREESCOLAR: 0, PRIMARIA: 0, BACHILLERATO: 0 };
    for (const a of accounts) map[a.levelCode] += 1;
    return map;
  }, [accounts]);

  const activeGroupMeta =
    groupFilter !== "ALL" ? courseGroups.find((g) => g.groupName === groupFilter) ?? null : null;

  const scopeLabel = activeGroupMeta
    ? `Curso ${activeGroupMeta.groupName} · ${activeGroupMeta.gradeName}`
    : levelFilter !== "ALL"
      ? `Nivel ${LEVEL_LABELS[levelFilter]}`
      : "Todo el colegio";

  const hasAnyFilter =
    levelFilter !== "ALL" ||
    groupFilter !== "ALL" ||
    monthFilter !== "ALL" ||
    statusFilter !== "all" ||
    query.trim().length > 0 ||
    sortOrder !== "course";

  const clearAllFilters = () => {
    setLevelFilter("ALL");
    setGroupFilter("ALL");
    setMonthFilter("ALL");
    setStatusFilter("all");
    setSortOrder("course");
    setQuery("");
  };

  // URL de exportación Excel sincronizada con el curso o nivel filtrado
  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (levelFilter !== "ALL") params.set("level", levelFilter);
    if (groupFilter !== "ALL") params.set("group", groupFilter);
    const qs = params.toString();
    return qs ? `/api/siga/cartera/exportar?${qs}` : "/api/siga/cartera/exportar";
  }, [levelFilter, groupFilter]);

  const activeModalAccount = selectedCell
    ? accounts.find((a) => a.enrollmentId === selectedCell.enrollmentId) ?? null
    : null;
  const activeModalCharge =
    activeModalAccount && selectedCell
      ? activeModalAccount.charges.find((c) => c.id === selectedCell.chargeId) ?? null
      : null;

  const activeMonthMeta =
    monthFilter === "ALL"
      ? null
      : BILLING_MONTH_COLUMNS.find((m) => m.month === monthFilter) ?? null;

  const radius = 34;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - scopeTotals.collectionPercent / 100);
  const maxMonthBilled = Math.max(...scopeMonthlySummary.map((m) => m.billedCop), 1);
  const maxChannelTotal = Math.max(...scopeChannelSummary.map((c) => c.totalCop), 1);

  return (
    <div className="grid gap-5">
      {/* Banner de seguridad y acciones rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-cobalt/20 bg-cloud/75 px-4 py-3">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cobalt text-yellow">
            <Lock className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-extrabold text-navy">
              Entorno financiero protegido · Acceso exclusivo Tesorería y Rectoría
            </p>
            <p className="text-muted">
              Toda consulta, pago, descuento y exportación Excel queda trazada en auditoría inmutable con IP y usuario.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a href={exportUrl} className={pillButtonClass({ variant: "navy", size: "sm" })}>
            <Download aria-hidden />
            {groupFilter !== "ALL"
              ? `Exportar Excel (${groupFilter})`
              : levelFilter !== "ALL"
                ? `Exportar Excel (${LEVEL_LABELS[levelFilter]})`
                : `Exportar Excel ${yearNumber} (.xlsx)`}
          </a>
          <form action={genAction}>
            <input type="hidden" name="academicYearId" value={academicYearId} />
            <button type="submit" disabled={generating} className={pillButtonClass({ variant: "outline", size: "sm" })}>
              <Wallet aria-hidden />
              {generating ? "Sincronizando…" : "Sincronizar cartera"}
            </button>
          </form>
        </div>
      </div>

      {/* =================================================================
          PANEL DE FILTROS INTELIGENTES POR NIVEL, CURSO, MES Y ESTADO
         ================================================================= */}
      <section
        aria-label="Filtros de cartera por nivel, curso y mes"
        className="card grid gap-4 bg-white p-4 sm:p-5"
      >
        {/* Fila 1: Nivel educativo + Buscador + Orden + Limpiar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1.5 text-[0.72rem] font-extrabold tracking-wider text-muted uppercase">
              <Filter className="size-3.5 text-cobalt" aria-hidden /> Nivel
            </span>
            <div className="inline-flex flex-wrap rounded-control border border-line bg-bg-2 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleSelectLevel("ALL")}
                className={`rounded-md px-3 py-1.5 font-bold transition-colors ${
                  levelFilter === "ALL" ? "bg-white text-cobalt shadow-2xs" : "text-muted hover:text-navy"
                }`}
              >
                Todo el colegio ({accounts.length})
              </button>
              {LEVEL_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleSelectLevel(code)}
                  className={`rounded-md px-3 py-1.5 font-bold transition-colors ${
                    levelFilter === code ? "bg-white text-cobalt shadow-2xs" : "text-muted hover:text-navy"
                  }`}
                >
                  {LEVEL_LABELS[code]} ({levelCounts[code]})
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar estudiante, documento o curso…"
                className="input min-h-9 w-64 pl-8 text-xs font-medium"
              />
            </div>

            {viewMode === "matrix" && (
              <label className="inline-flex items-center gap-1.5 rounded-control border border-line-2 bg-white px-2.5 py-1.5 text-xs font-bold text-navy">
                <ArrowUpDown className="size-3.5 text-muted" aria-hidden />
                <span className="sr-only">Ordenar matriz</span>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  className="bg-transparent text-xs font-bold text-navy outline-none"
                >
                  <option value="course">Orden: Curso / Grado</option>
                  <option value="name">Orden: Alfabético (A–Z)</option>
                  <option value="debt_desc">Orden: Mayor saldo</option>
                  <option value="overdue_desc">Orden: Más mora</option>
                </select>
              </label>
            )}

            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 rounded-control border border-line-2 bg-cloud/60 px-2.5 py-1.5 text-xs font-bold text-cobalt transition-colors hover:bg-cloud"
              >
                <RotateCcw className="size-3.5" aria-hidden /> Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Fila 2: Selector visual de Cursos (1 clic con contador y alerta de mora) */}
        <div className="grid gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.7rem] font-extrabold tracking-wider text-muted uppercase">
              Filtrar por curso ({visibleCourseGroups.length}{" "}
              {visibleCourseGroups.length === 1 ? "curso" : "cursos"})
            </p>
            {activeGroupMeta && (
              <p className="text-xs font-bold text-cobalt tabular">
                {activeGroupMeta.groupName} ({activeGroupMeta.gradeName}): {activeGroupMeta.collectionPercent}% recaudado ·{" "}
                Saldo {formatCop(activeGroupMeta.pendingCop)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Selector rápido de cursos">
            <button
              type="button"
              onClick={() => setGroupFilter("ALL")}
              aria-pressed={groupFilter === "ALL"}
              className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-extrabold transition-colors ${
                groupFilter === "ALL"
                  ? "border-cobalt bg-cobalt text-white shadow-2xs"
                  : "border-line-2 bg-white text-navy hover:border-cobalt/40 hover:bg-cloud/60"
              }`}
            >
              Todos los cursos
              <span
                className={`rounded-pill px-1.5 py-0.5 text-[0.65rem] tabular ${
                  groupFilter === "ALL" ? "bg-white/20 text-white" : "bg-bg-2 text-muted"
                }`}
              >
                {visibleCourseGroups.reduce((s, g) => s + g.studentCount, 0)}
              </span>
            </button>

            {visibleCourseGroups.map((g) => {
              const selected = groupFilter === g.groupName;
              const isAllClear = g.pendingCop === 0;
              return (
                <button
                  key={g.groupName}
                  type="button"
                  onClick={() => setGroupFilter(selected ? "ALL" : g.groupName)}
                  aria-pressed={selected}
                  title={`${g.gradeName} (${g.groupName}) · ${g.studentCount} estudiantes · ${g.collectionPercent}% recaudado · Saldo ${formatCop(g.pendingCop)}`}
                  className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-bold transition-colors ${
                    selected
                      ? "border-cobalt bg-cobalt text-white shadow-2xs"
                      : "border-line-2 bg-white text-navy hover:border-cobalt/45 hover:bg-cloud/60"
                  }`}
                >
                  <span className="font-extrabold">{g.groupName}</span>
                  <span className={`hidden text-[0.7rem] sm:inline ${selected ? "text-white/80" : "text-muted"}`}>
                    {g.gradeName}
                  </span>
                  <span
                    className={`rounded-pill px-1.5 py-0.5 text-[0.65rem] font-extrabold tabular ${
                      selected ? "bg-white/20 text-white" : "bg-bg-2 text-ink-2"
                    }`}
                  >
                    {g.studentCount}
                  </span>
                  {g.overdueCount > 0 ? (
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-[0.65rem] font-extrabold tabular ${
                        selected ? "bg-red-solid text-white" : "bg-red-l text-red-solid"
                      }`}
                      title={`${g.overdueCount} en mora`}
                    >
                      !{g.overdueCount}
                    </span>
                  ) : isAllClear ? (
                    <span
                      className={`grid size-4 place-items-center rounded-full ${
                        selected ? "bg-white/20 text-white" : "bg-green-l text-green-solid"
                      }`}
                      title="Curso 100% al día"
                    >
                      <Check className="size-2.5" aria-hidden />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Fila 3 (solo en Matriz): Mes enfocado + Estado de cartera con contadores reactivos */}
        {viewMode === "matrix" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-navy">
                <span className="text-[0.7rem] font-extrabold tracking-wider text-muted uppercase">Mes:</span>
                <select
                  aria-label="Filtrar por mes de pensión"
                  value={monthFilter === "ALL" ? "ALL" : String(monthFilter)}
                  onChange={(e) =>
                    setMonthFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
                  }
                  className="input min-h-8 w-auto py-1 text-xs font-bold"
                >
                  <option value="ALL">Todo el año (Mat. + Feb–Nov)</option>
                  {BILLING_MONTH_COLUMNS.map((m) => (
                    <option key={m.month} value={m.month}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="inline-flex flex-wrap rounded-control border border-line bg-bg-2 p-0.5 text-xs">
                {(
                  [
                    { key: "all", label: `Todos (${statusCounts.all})` },
                    { key: "clear", label: `Al día (${statusCounts.clear})` },
                    { key: "pending", label: `Pendientes (${statusCounts.pending})` },
                    { key: "overdue", label: `En mora (${statusCounts.overdue})` },
                    { key: "discounted", label: `Con beca (${statusCounts.discounted})` },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setStatusFilter(opt.key)}
                    className={`rounded-md px-2.5 py-1 font-bold transition-colors ${
                      statusFilter === opt.key ? "bg-white text-navy shadow-2xs" : "text-muted hover:text-navy"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {activeMonthMeta && (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-cobalt/10 px-3 py-1 text-xs font-extrabold text-cobalt">
                Enfocando: {activeMonthMeta.label}
                <button
                  type="button"
                  onClick={() => setMonthFilter("ALL")}
                  aria-label="Quitar filtro de mes"
                  className="rounded-full p-0.5 hover:bg-cobalt/15"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            )}
          </div>
        )}
      </section>

      {/* KPIs ejecutivos (reactivos al Nivel y Curso seleccionado) */}
      <section className="card grid divide-y divide-line bg-white p-0 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="relative grid size-20 shrink-0 place-items-center">
            <svg viewBox="0 0 84 84" className="size-20 -rotate-90" aria-hidden="true">
              <circle cx="42" cy="42" r={radius} fill="none" stroke="#EEF1F8" strokeWidth="7.5" />
              <circle
                cx="42"
                cy="42"
                r={radius}
                fill="none"
                stroke="#2F7D00"
                strokeWidth="7.5"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
              />
            </svg>
            <span className="absolute text-base font-black text-navy tabular">{scopeTotals.collectionPercent}%</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-xs font-extrabold tracking-wider text-muted uppercase">Recaudo</p>
              <span className="rounded-pill bg-cloud px-2 py-0.5 text-[0.65rem] font-extrabold text-cobalt">
                {scopeLabel}
              </span>
            </div>
            <p className="mt-1 text-lg font-black text-green-solid tabular">{formatCop(scopeTotals.totalCollectedCop)}</p>
            <p className="text-xs text-muted tabular">de {formatCop(scopeTotals.totalBilledCop)}</p>
          </div>
        </div>

        <div className="flex flex-col justify-center px-5 py-4">
          <p className="text-xs font-extrabold tracking-wider text-muted uppercase">Saldo por recaudar</p>
          <p className="mt-1 text-2xl font-black text-cobalt tabular">{formatCop(scopeTotals.totalPendingCop)}</p>
          <p className="mt-1 text-xs text-muted tabular">
            <strong className="text-green-solid">{scopeTotals.clearCount}</strong> al día ·{" "}
            <strong className="text-orange-solid">{scopeTotals.pendingCount}</strong> con saldo ·{" "}
            <strong className="text-red-solid">{scopeTotals.overdueCount}</strong> en mora
          </p>
        </div>

        <div className="flex flex-col justify-center gap-2 px-5 py-4">
          <p className="text-xs font-extrabold tracking-wider text-muted uppercase">Modo de trabajo</p>
          <div className="inline-flex w-fit rounded-control border border-line bg-bg-2 p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("matrix")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-bold transition-colors ${
                viewMode === "matrix" ? "bg-white text-cobalt shadow-2xs" : "text-muted hover:text-navy"
              }`}
            >
              <Table2 className="size-3.5" aria-hidden /> Matriz Mensual (Feb–Nov)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("analytics")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-bold transition-colors ${
                viewMode === "analytics" ? "bg-white text-cobalt shadow-2xs" : "text-muted hover:text-navy"
              }`}
            >
              <BarChart3 className="size-3.5" aria-hidden /> Gráficas y Recibos
            </button>
          </div>
        </div>
      </section>

      {/* =================================================================
          MODO 1: MATRIZ MENSUAL INTERACTIVA (REEMPLAZA EL MEGA-EXCEL)
         ================================================================= */}
      {viewMode === "matrix" && (
        <section aria-label="Matriz mensual de cartera febrero a noviembre" className="grid gap-3">
          {/* Leyenda rápida */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted">
            <div className="flex flex-wrap items-center gap-3 font-semibold">
              <span className="inline-flex items-center gap-1 text-green-solid">
                <span className="grid size-4 place-items-center rounded bg-green-l"><Check className="size-3" /></span> Pagado
              </span>
              <span className="inline-flex items-center gap-1 text-sky-solid">
                <span className="grid size-4 place-items-center rounded bg-sky-l font-black">½</span> Abono
              </span>
              <span className="inline-flex items-center gap-1 text-orange-solid">
                <span className="grid size-4 place-items-center rounded bg-orange-l"><Clock className="size-3" /></span> Pendiente
              </span>
              <span className="inline-flex items-center gap-1 text-red-solid">
                <span className="grid size-4 place-items-center rounded bg-red-l"><AlertCircle className="size-3" /></span> En mora
              </span>
              <span className="inline-flex items-center gap-1 text-purple-solid">
                <span className="grid size-4 place-items-center rounded bg-purple-l text-[0.6rem] font-black">EX</span> Exonerado
              </span>
            </div>
            <span>Haz clic en un mes del encabezado para enfocarlo o en una celda para registrar pago/beca.</span>
          </div>

          {/* Matriz con columnas fijas */}
          <div className="card overflow-x-auto bg-white p-0">
            <table className="w-max min-w-full border-collapse text-xs">
              <caption className="sr-only">Matriz mensual de cartera escolar de Matrícula y Febrero a Noviembre</caption>
              <thead>
                <tr className="border-b border-line bg-[#F6F8FC] text-[0.7rem] font-extrabold tracking-wider text-navy uppercase">
                  <th scope="col" className="sticky left-0 z-20 min-w-56 border-r border-line bg-[#F6F8FC] px-4 py-3 text-left">
                    Estudiante ({filteredAccounts.length} de {scopeAccounts.length})
                  </th>
                  {BILLING_MONTH_COLUMNS.map((m) => {
                    const isFocused = monthFilter === m.month;
                    return (
                      <th
                        key={m.month}
                        scope="col"
                        className={`min-w-14 px-1 py-2 text-center ${isFocused ? "bg-cobalt/12 text-cobalt" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => setMonthFilter(isFocused ? "ALL" : m.month)}
                          title={isFocused ? `Quitar enfoque de ${m.label}` : `Enfocar y filtrar por ${m.label}`}
                          className={`rounded-md px-2 py-1 font-extrabold uppercase transition-colors ${
                            isFocused
                              ? "bg-cobalt text-white"
                              : "text-navy hover:bg-cobalt/10 hover:text-cobalt"
                          }`}
                        >
                          {m.shortLabel}
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="min-w-28 border-l border-line px-3 py-3 text-right">
                    Saldo
                  </th>
                  <th scope="col" className="min-w-28 px-3 py-3 text-right">
                    Paz y Salvo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={BILLING_MONTH_COLUMNS.length + 3} className="px-6 py-10 text-center text-sm text-muted">
                      No encontramos estudiantes con estos filtros.{" "}
                      {hasAnyFilter && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="ml-1 font-bold text-cobalt underline"
                        >
                          Restablecer filtros
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc) => {
                    const byMonth = new Map(acc.charges.map((c) => [c.billingMonth, c]));
                    return (
                      <tr key={acc.enrollmentId} className="hover:bg-cloud/45">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 border-r border-line bg-white px-4 py-2.5 text-left font-normal"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-bold text-navy">{acc.studentName}</span>
                            <button
                              type="button"
                              onClick={() => setGroupFilter(groupFilter === acc.groupName ? "ALL" : acc.groupName)}
                              title={`Filtrar solo curso ${acc.groupName}`}
                              className="shrink-0 rounded-pill bg-cloud px-2 py-0.5 text-[0.65rem] font-extrabold text-cobalt hover:bg-cobalt hover:text-white"
                            >
                              {acc.groupName}
                            </button>
                          </div>
                          <span className="block text-[0.68rem] text-muted tabular">
                            {acc.gradeName} · Doc. {acc.documentNumber}
                          </span>
                        </th>

                        {BILLING_MONTH_COLUMNS.map((m) => {
                          const ch = byMonth.get(m.month);
                          const isFocusedCol = monthFilter === m.month;
                          if (!ch) {
                            return (
                              <td
                                key={m.month}
                                className={`px-1.5 py-2 text-center text-muted/50 ${isFocusedCol ? "bg-cobalt/6" : ""}`}
                              >
                                —
                              </td>
                            );
                          }

                          const cellStyle =
                            ch.status === "PAID"
                              ? "bg-green-l/75 text-green-solid hover:bg-green-l"
                              : ch.status === "WAIVED"
                                ? "bg-purple-l/70 text-purple-solid hover:bg-purple-l"
                                : ch.status === "OVERDUE"
                                  ? "bg-red-l/80 text-red-solid hover:bg-red-l"
                                  : ch.status === "PARTIAL"
                                    ? "bg-sky-l/80 text-sky-solid hover:bg-sky-l"
                                    : "bg-orange-l/75 text-orange-solid hover:bg-orange-l";

                          return (
                            <td
                              key={m.month}
                              className={`px-1 py-1.5 text-center ${isFocusedCol ? "bg-cobalt/6" : ""}`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedCell({ enrollmentId: acc.enrollmentId, chargeId: ch.id })
                                }
                                title={`${acc.studentName} · ${ch.concept} · ${BILLING_STATUS_META[ch.status].label} (${
                                  ch.pendingCop > 0 ? `Saldo ${formatCop(ch.pendingCop)}` : `Pagado ${formatCop(ch.paidCop)}`
                                })`}
                                aria-label={`${acc.studentName}, ${ch.concept}: ${BILLING_STATUS_META[ch.status].label}`}
                                className={`mx-auto grid size-8 place-items-center rounded-lg font-extrabold transition-transform hover:scale-105 ${cellStyle} ${
                                  isFocusedCol ? "ring-2 ring-cobalt/40" : ""
                                }`}
                              >
                                {ch.status === "PAID" ? (
                                  <Check className="size-4" aria-hidden />
                                ) : ch.status === "WAIVED" ? (
                                  <span className="text-[0.68rem]">EX</span>
                                ) : ch.status === "OVERDUE" ? (
                                  <AlertCircle className="size-3.5" aria-hidden />
                                ) : ch.status === "PARTIAL" ? (
                                  <span className="text-[0.72rem]">½</span>
                                ) : (
                                  <Clock className="size-3.5" aria-hidden />
                                )}
                              </button>
                            </td>
                          );
                        })}

                        <td className="border-l border-line px-3 py-2.5 text-right font-black tabular">
                          <span
                            className={
                              acc.totalPendingCop === 0
                                ? "text-green-solid"
                                : acc.overdueCount > 0
                                  ? "text-red-solid"
                                  : "text-navy"
                            }
                          >
                            {acc.totalPendingCop === 0 ? "$0" : formatCop(acc.totalPendingCop)}
                          </span>
                        </td>

                        <td className="px-3 py-2.5 text-right">
                          {acc.isClear ? (
                            <div className="inline-flex justify-end">
                              <PazYSalvoButton
                                enrollmentId={acc.enrollmentId}
                                existingCode={acc.pazYSalvoCode}
                                compact
                              />
                            </div>
                          ) : (
                            <span className="text-[0.68rem] font-semibold text-muted">Con saldo</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredAccounts.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-line bg-[#F6F8FC] text-[0.7rem] font-extrabold text-navy">
                    <td className="sticky left-0 z-10 border-r border-line bg-[#F6F8FC] px-4 py-3">
                      Totales vista ({filteredAccounts.length}{" "}
                      {filteredAccounts.length === 1 ? "estudiante" : "estudiantes"})
                    </td>
                    {BILLING_MONTH_COLUMNS.map((m) => {
                      const st = matrixFooter.perMonth.get(m.month);
                      const pct = st && st.total > 0 ? Math.round((st.paid / st.total) * 100) : 0;
                      const isFocusedCol = monthFilter === m.month;
                      return (
                        <td
                          key={m.month}
                          title={
                            st
                              ? `${m.label}: ${st.paid}/${st.total} al día · Saldo pendiente ${formatCop(st.pendingCop)}`
                              : m.label
                          }
                          className={`px-1 py-2.5 text-center tabular ${isFocusedCol ? "bg-cobalt/10 text-cobalt" : ""}`}
                        >
                          <span
                            className={
                              pct >= 90 ? "text-green-solid" : pct >= 50 ? "text-cobalt" : "text-orange-solid"
                            }
                          >
                            {pct}%
                          </span>
                          <span className="block text-[0.62rem] font-semibold text-muted">
                            {st?.paid ?? 0}/{st?.total ?? 0}
                          </span>
                        </td>
                      );
                    })}
                    <td className="border-l border-line px-3 py-3 text-right font-black text-cobalt tabular">
                      {formatCop(matrixFooter.pendingSum)}
                    </td>
                    <td className="px-3 py-3 text-right text-[0.66rem] text-muted">Saldo vista</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      {/* =================================================================
          MODO 2: GRÁFICAS DE RECAUDO MENSUAL (FEB–NOV) Y LIBRO DE RECIBOS
         ================================================================= */}
      {viewMode === "analytics" && (
        <div className="grid gap-6">
          <div className="grid gap-5 lg:grid-cols-12">
            {/* Gráfico SVG: Facturado vs Recaudado por mes */}
            <section className="card grid gap-4 bg-white lg:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-navy">
                    Recaudo mensual · {scopeLabel}
                  </h2>
                  <p className="text-xs text-muted">Comparativo entre facturación neta y recaudo real por cada mes.</p>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <span className="size-2.5 rounded-xs bg-line-2" aria-hidden /> Facturado
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-green-solid">
                    <span className="size-2.5 rounded-xs bg-green-solid" aria-hidden /> Recaudado
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <svg
                  viewBox="0 0 680 210"
                  className="h-52 w-full min-w-[540px]"
                  role="img"
                  aria-label="Diagrama de recaudo mensual de matrícula y pensiones febrero a noviembre"
                >
                  {scopeMonthlySummary.map((m, idx) => {
                    const slotW = 640 / scopeMonthlySummary.length;
                    const cx = 24 + idx * slotW + slotW / 2;
                    const maxH = 140;
                    const billedH = Math.max(4, (m.billedCop / maxMonthBilled) * maxH);
                    const collH = Math.max(2, (m.collectedCop / maxMonthBilled) * maxH);
                    const baseY = 172;

                    return (
                      <g key={m.month}>
                        <rect
                          x={cx - 14}
                          y={baseY - billedH}
                          width="28"
                          height={billedH}
                          rx="6"
                          fill="#E2E8F0"
                        >
                          <title>{`${m.label}: Facturado ${formatCop(m.billedCop)}`}</title>
                        </rect>
                        <rect
                          x={cx - 14}
                          y={baseY - collH}
                          width="28"
                          height={collH}
                          rx="6"
                          fill={m.collectionPercent >= 85 ? "#2F7D00" : m.collectionPercent >= 50 ? "#303296" : "#B45309"}
                        >
                          <title>{`${m.label}: Recaudado ${formatCop(m.collectedCop)} (${m.collectionPercent}%)`}</title>
                        </rect>
                        <text x={cx} y={baseY - billedH - 6} textAnchor="middle" fill="#525C70" fontSize="9.5" fontWeight="700">
                          {m.collectionPercent}%
                        </text>
                        <text x={cx} y={baseY + 18} textAnchor="middle" fill="#0F1747" fontSize="11" fontWeight="800">
                          {m.shortLabel}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </section>

            {/* Recaudo por canal de pago */}
            <section className="card grid content-start gap-4 bg-white lg:col-span-4">
              <div>
                <h2 className="text-base font-bold text-navy">Ingresos por medio de pago</h2>
                <p className="text-xs text-muted">Conciliación acumulada · {scopeLabel}.</p>
              </div>
              <ul className="grid gap-3">
                {scopeChannelSummary.map((ch) => {
                  const pct = Math.round((ch.totalCop / maxChannelTotal) * 100);
                  return (
                    <li key={ch.channel} className="grid gap-1 text-xs">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-bold text-navy">{PAYMENT_CHANNEL_LABELS[ch.channel]}</span>
                        <span className="font-black text-cobalt tabular">{formatCop(ch.totalCop)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-cobalt" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[0.68rem] text-muted tabular">
                        {ch.paymentCount} {ch.paymentCount === 1 ? "recibo" : "recibos"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          {/* Libro reciente de recibos */}
          <section className="card overflow-hidden bg-white p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-extrabold text-navy">
                Últimos recibos emitidos · {scopeLabel} ({Math.min(20, scopeReceipts.length)} de {scopeReceipts.length})
              </h2>
              <a
                href={exportUrl}
                className="inline-flex items-center gap-1 text-xs font-bold text-cobalt no-underline hover:underline"
              >
                Descargar libro en Excel (.xlsx) <Download className="size-3.5" aria-hidden />
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="tactile-table text-xs">
                <thead>
                  <tr>
                    <th scope="col">Recibo</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Estudiante</th>
                    <th scope="col">Concepto</th>
                    <th scope="col">Canal / Ref.</th>
                    <th scope="col" className="text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {scopeReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-muted">
                        Aún no hay recibos registrados para {scopeLabel}.
                      </td>
                    </tr>
                  ) : (
                    scopeReceipts.slice(0, 20).map((r) => (
                      <tr key={r.paymentId}>
                        <td className="font-mono font-bold text-cobalt">{r.receiptNumber}</td>
                        <td className="whitespace-nowrap text-muted tabular">{dateFormat.format(r.paidAt)}</td>
                        <td>
                          <span className="font-bold text-navy">{r.studentName}</span>
                          <span className="ml-1.5 text-muted">({r.groupName})</span>
                        </td>
                        <td>{r.concept}</td>
                        <td>
                          <span className="font-semibold text-navy">{PAYMENT_CHANNEL_LABELS[r.channel]}</span>
                          <span className="ml-1 text-muted">· {r.referenceCode}</span>
                        </td>
                        <td className="text-right font-black text-green-solid tabular">{formatCop(r.amountCop)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Modal al hacer clic en una celda de mes */}
      {activeModalAccount && activeModalCharge && (
        <ChargeDetailModal
          key={activeModalCharge.id}
          studentName={activeModalAccount.studentName}
          groupName={activeModalAccount.groupName}
          charge={activeModalCharge}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  );
}
