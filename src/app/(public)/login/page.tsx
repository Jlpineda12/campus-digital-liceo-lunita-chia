import { ArrowRight, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoAccess } from "@/components/auth/DemoAccess";
import { LoginForm } from "@/components/auth/LoginForm";
import { Chip } from "@/components/ui/Chip";
import { LunitaEmblem } from "@/components/ui/LunitaEmblem";
import { PlatformLogo } from "@/components/ui/PlatformLogo";
import { StheamiBadge } from "@/components/ui/StheamiBadge";
import { STHEAMI_PILLARS } from "@/modules/core/academic-structure/stheami";
import { DEMO_ACCOUNTS, isDemoLoginEnabled } from "@/modules/core/auth/demo";
import { isLoginModule, resolvePostLoginPath, safeRedirectPath } from "@/modules/core/auth/redirects";
import { isLoginRoleParam, ROLES } from "@/modules/core/auth/roles";
import { getRequestMeta, getSession } from "@/modules/core/auth/session";
import { CAMPUS_BRAND, PLATFORM_SPACES } from "@/modules/core/brand/config";

export const metadata: Metadata = { title: "Ingresar" };

const MODULE_LABELS = { siga: PLATFORM_SPACES.siga.name, aula: PLATFORM_SPACES.aula.name } as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rol = single(params.rol);
  const modulo = single(params.modulo);
  const next = safeRedirectPath(single(params.next)) ?? undefined;
  const validModule = isLoginModule(modulo) ? modulo : undefined;

  const session = await getSession();
  if (session) redirect(resolvePostLoginPath({ next, modulo: validModule }));

  const { host } = await getRequestMeta();
  const demoEnabled = isDemoLoginEnabled(host);
  const demoHints = Object.fromEntries(ROLES.map((r) => [r, DEMO_ACCOUNTS[r].hint])) as Record<
    (typeof ROLES)[number],
    string
  >;

  return (
    <div className="block-navy min-h-dvh">
      <div className="muisca muisca-thin" aria-hidden />
      <main className="mx-auto grid min-h-[calc(100dvh-14px)] w-full max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-10">
        <section aria-labelledby="brand-title" className="max-w-xl">
          <div className="flex items-center gap-4">
            <LunitaEmblem size={64} className="animate-bob shrink-0" />
            <div>
              <p className="kicker">
                <span className="moon" aria-hidden /> Campus Digital
              </p>
              <p className="text-lg font-extrabold text-white">Liceo Lunita de Chía</p>
            </div>
          </div>

          <h1 id="brand-title" className="mt-8 text-step-4">
            Tu colegio, en <span className="hl">un solo lugar</span>.
          </h1>
          <p className="mt-4 max-w-lg text-step-1 leading-normal text-white/80">
            Notas, tareas, asistencia y matrículas con un único acceso para estudiantes, familias y
            docentes.
          </p>

          <div className="mt-7 hidden gap-3 sm:grid sm:grid-cols-2" aria-label="Ecosistemas del Campus">
            {(["siga", "aula"] as const).map((key) => {
              const space = PLATFORM_SPACES[key];
              return (
                <div
                  key={key}
                  className="flex items-start gap-3 rounded-card border border-white/15 bg-white/8 p-3.5"
                >
                  <PlatformLogo space={key} size={40} className="shrink-0" />
                  <div className="min-w-0">
                    <p className="font-extrabold text-white">{space.name}</p>
                    <p className="mt-0.5 text-xs leading-snug text-white/75">{space.tagline}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 hidden text-xs font-bold tracking-wide text-white/60 uppercase lg:block">
            {CAMPUS_BRAND.institution} · Modelo STHEAMI
          </p>
          <div className="mt-2 hidden items-center gap-3 lg:flex" aria-label="Modelo pedagógico STHEAMI">
            {STHEAMI_PILLARS.map((p) => (
              <StheamiBadge key={p} pillar={p} size="lg" />
            ))}
          </div>
        </section>

        <section aria-labelledby="login-title" className="w-full max-w-md justify-self-center lg:justify-self-end">
          <div className="card card-lg animate-pop-in">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="login-title" className="text-step-2">
                Ingresa al Campus
              </h2>
              {validModule && <Chip tone="blue">Vas a {MODULE_LABELS[validModule]}</Chip>}
            </div>
            <p className="mt-1 mb-5 text-muted">Un solo acceso para el SIGA y el Aula Virtual.</p>

            {single(params.clave) === "actualizada" && (
              <p role="status" className="mb-4 rounded-control border-2 border-green bg-green-l px-4 py-3 text-sm font-bold text-navy">
                Tu contraseña se actualizó y cerramos tus sesiones anteriores. Ingresa con la nueva.
              </p>
            )}
            {single(params.error) === "demo" && (
              <p role="alert" className="mb-4 rounded-control border-2 border-orange bg-orange-l px-4 py-3 text-sm font-bold text-navy">
                La cuenta de demostración no está disponible.
              </p>
            )}

            <LoginForm
              initialAudience={isLoginRoleParam(rol) ? rol : "estudiantes"}
              next={next}
              modulo={validModule}
            />

            <p className="mt-5 text-sm text-muted">
              ¿Es tu primer ingreso y no tienes contraseña? Comunícate con Secretaría.
            </p>

            {demoEnabled && <DemoAccess hints={demoHints} next={next} modulo={validModule} />}
          </div>

          <div className="mt-5 grid gap-3 px-2 text-sm text-white/80">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-yellow" aria-hidden />
              Tus datos y los de tus hijos están protegidos conforme a la Ley 1581 de 2012 (Habeas Data).
            </p>
            <Link href="/matriculas" className="inline-flex items-center gap-1.5 font-extrabold text-yellow no-underline hover:underline">
              Matrícula en línea 2027 <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
