import { ArrowLeft, CheckCircle2, Lock, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicAdmissionsPortal } from "@/components/matriculas/PublicAdmissionsPortal";
import { LunitaEmblem } from "@/components/ui/LunitaEmblem";
import { ToastViewport } from "@/components/ui/ToastViewport";
import { getSession } from "@/modules/core/auth/session";
import {
  listGuardianRenewalCandidates,
  listPublicGradesForAdmission,
  lookupPublicApplication,
} from "@/modules/matriculas/queries";

export const metadata: Metadata = { title: "Matrícula en línea 2027 · Liceo Lunita de Chía" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const STEPS = [
  { num: "1", label: "Solicitud y grado" },
  { num: "2", label: "8 Documentos" },
  { num: "3", label: "Soporte de pago" },
  { num: "4", label: "Cupo confirmado" },
];

/**
 * Ruta pública estable del contrato con el sitio Astro (REGLAS.md §1.3).
 * Diseño editorial amplio (`max-w-6xl`) con cabecera cósmica Lunita y lienzo luminoso.
 */
export default async function MatriculasPage({ searchParams }: { searchParams: SearchParams }) {
  const [sp, session, grades] = await Promise.all([
    searchParams,
    getSession(),
    listPublicGradesForAdmission(),
  ]);

  const radicado = (single(sp.radicado) ?? "").trim();
  const doc = (single(sp.doc) ?? "").trim();

  const [renewalCandidates, lookedUpApp] = await Promise.all([
    session?.user.role === "GUARDIAN" ? listGuardianRenewalCandidates(session.user.id) : Promise.resolve([]),
    radicado && doc ? lookupPublicApplication(radicado, doc) : Promise.resolve(null),
  ]);

  return (
    <div data-stage="institucional" className="min-h-dvh bg-[#F6F8FC] text-ink">
      {/* Cabecera hero institucional amplia */}
      <div className="block-navy relative overflow-hidden pb-20">
        <div className="muisca muisca-thin" aria-hidden />

        <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 pt-6 sm:px-8">
          <Link href="/login" className="flex items-center gap-3 no-underline">
            <LunitaEmblem size={42} className="shrink-0" />
            <div className="leading-tight">
              <p className="text-[0.7rem] font-extrabold tracking-widest text-yellow uppercase">
                Campus Digital
              </p>
              <p className="text-base font-black text-white">Liceo Lunita de Chía</p>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2.5">
            {session ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-pill border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold text-white no-underline backdrop-blur-xs transition-colors hover:bg-white/20"
              >
                <ArrowLeft className="size-3.5" aria-hidden /> Volver al Campus
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-pill border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold text-white no-underline backdrop-blur-xs transition-colors hover:bg-white/20"
              >
                <ArrowLeft className="size-3.5" aria-hidden /> Ingresar al Campus
              </Link>
            )}
          </div>
        </header>

        <div className="mx-auto mt-8 grid w-full max-w-6xl gap-6 px-5 sm:px-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-yellow/18 px-3 py-1 text-xs font-extrabold text-yellow ring-1 ring-yellow/35">
              <Sparkles className="size-3.5" aria-hidden /> Admisiones y Matrícula 2027
            </span>
            <h1 className="mt-3 text-step-3 font-black tracking-tight text-white">
              Matrícula en línea · Proceso 100% digital
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
              Radica tu solicitud de ingreso o renovación en minutos, calcula costos con total transparencia y carga
              los 8 documentos en almacenamiento privado protegido por la Ley 1581.
            </p>
          </div>

          {/* Ruta visual de los 4 pasos del proceso */}
          <ol
            aria-label="Pasos del proceso de matrícula"
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2"
          >
            {STEPS.map((s) => (
              <li
                key={s.num}
                className="flex items-center gap-2.5 rounded-xl border border-white/14 bg-white/8 px-3 py-2.5 backdrop-blur-xs"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-yellow text-xs font-black text-navy">
                  {s.num}
                </span>
                <span className="text-xs font-bold text-white/95">{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Contenido principal amplio flotando sobre el hero */}
      <main id="contenido" className="mx-auto -mt-12 w-full max-w-6xl px-5 pb-16 sm:px-8">
        <PublicAdmissionsPortal
          grades={grades}
          renewalCandidates={renewalCandidates}
          isLoggedGuardian={session?.user.role === "GUARDIAN"}
          lookedUpApp={lookedUpApp}
          lookupQuery={{ radicado, doc }}
        />
      </main>

      <footer className="border-t border-line bg-white py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 text-xs text-muted sm:px-8">
          <p className="inline-flex items-center gap-1.5 font-semibold text-navy">
            <Lock className="size-3.5 text-cobalt" aria-hidden />
            Liceo Lunita de Chía · Protección de datos de menores (Ley 1581 de 2012)
          </p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 font-semibold text-green-solid">
              <CheckCircle2 className="size-3.5" aria-hidden /> Documentos en almacenamiento privado
            </span>
            <Link href="/login" className="font-bold text-cobalt no-underline hover:underline">
              Acceso familias y docentes
            </Link>
          </div>
        </div>
      </footer>

      <ToastViewport />
    </div>
  );
}
