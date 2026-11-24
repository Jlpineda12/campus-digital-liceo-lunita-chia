import { AlertTriangle, QrCode, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PublicFrame } from "@/components/layout/PublicFrame";
import { Chip } from "@/components/ui/Chip";
import { IconBubble } from "@/components/ui/IconBubble";
import { getRequestMeta } from "@/modules/core/auth/session";
import { verifyPublicCode } from "@/modules/siga/report-cards/queries";

export const metadata: Metadata = { title: "Verificar documento" };

const issuedFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/**
 * Verificador público de boletines y certificados mediante QR (REGLAS.md §1.3 y §3.1).
 * Protegido con rate-limit por IP y enmascaramiento Ley 1581: nunca expone
 * nombres completos ni calificaciones de menores al público.
 */
export default async function VerificarPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const { ip } = await getRequestMeta();
  const result = await verifyPublicCode(codigo, ip);

  return (
    <PublicFrame>
      <div className="card card-lg grid gap-5">
        <div className="flex items-start gap-4">
          <IconBubble
            tone={
              result.status === "valid" && !result.revoked
                ? "green"
                : result.status === "rate_limited"
                  ? "orange"
                  : "blue"
            }
          >
            {result.status === "valid" && !result.revoked ? (
              <ShieldCheck />
            ) : result.status === "rate_limited" ? (
              <ShieldAlert />
            ) : (
              <QrCode />
            )}
          </IconBubble>
          <div className="min-w-0">
            <h1 className="text-step-2">Verificación oficial de documentos</h1>
            <p className="mt-1 break-all font-mono text-sm font-semibold text-muted">{codigo}</p>
          </div>
        </div>

        {result.status === "valid" && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {result.revoked ? (
                <Chip tone="red">
                  <AlertTriangle aria-hidden /> Documento revocado
                </Chip>
              ) : (
                <Chip tone="green">
                  <ShieldCheck aria-hidden /> Documento auténtico — Liceo Lunita de Chía
                </Chip>
              )}
              {result.isStale && (
                <Chip tone="orange">Existe una versión más reciente disponible en el Campus</Chip>
              )}
            </div>

            <dl className="grid gap-3 rounded-control border border-line bg-cloud/70 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-extrabold tracking-wider text-muted uppercase">Tipo de documento</dt>
                <dd className="font-extrabold text-navy">{result.documentLabel}</dd>
              </div>
              <div>
                <dt className="text-xs font-extrabold tracking-wider text-muted uppercase">Año y periodo</dt>
                <dd className="font-semibold text-navy">
                  {result.yearName}
                  {result.periodName ? ` · ${result.periodName}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-extrabold tracking-wider text-muted uppercase">Titular (protegido Ley 1581)</dt>
                <dd className="font-semibold text-navy">
                  {result.maskedName} · Doc. {result.maskedDocument}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-extrabold tracking-wider text-muted uppercase">Grado y grupo</dt>
                <dd className="font-semibold text-navy">
                  {result.gradeName} · {result.groupName}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-extrabold tracking-wider text-muted uppercase">Fecha de emisión</dt>
                <dd className="font-semibold text-navy">{issuedFormat.format(result.issuedAt)}</dd>
              </div>
            </dl>
          </div>
        )}

        {result.status === "invalid_format" && (
          <p role="alert" className="rounded-control border border-orange bg-orange-l px-4 py-3 text-sm font-semibold text-navy">
            El código no tiene un formato válido. Revisa el enlace del código QR impreso en el documento.
          </p>
        )}

        {result.status === "rate_limited" && (
          <p role="alert" className="rounded-control border border-red-solid/40 bg-red-l px-4 py-3 text-sm font-semibold text-navy">
            Se superó el límite temporal de verificaciones desde esta dirección. Intenta nuevamente en unos minutos.
          </p>
        )}

        {result.status === "not_found" && (
          <p role="status" className="rounded-control border border-line-2 bg-cloud px-4 py-3 text-sm font-semibold text-navy">
            No encontramos un documento oficial emitido con este código. Si tienes dudas sobre su autenticidad, comunícate con Secretaría del colegio.
          </p>
        )}
      </div>
    </PublicFrame>
  );
}
