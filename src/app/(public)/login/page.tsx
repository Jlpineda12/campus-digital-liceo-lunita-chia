import { ArrowRight, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { DemoAccess } from "@/components/auth/DemoAccess";
import { LoginForm } from "@/components/auth/LoginForm";
import { LunitaCharacter } from "@/components/brand/LunitaCharacter";
import { NightSkyBackdrop } from "@/components/brand/NightSkyBackdrop";
import { Chip } from "@/components/ui/Chip";
import { LunitaEmblem } from "@/components/ui/LunitaEmblem";
import { DEMO_ACCOUNTS, isDemoLoginEnabled } from "@/modules/core/auth/demo";
import { isLoginModule, resolvePostLoginPath, safeRedirectPath } from "@/modules/core/auth/redirects";
import { isLoginRoleParam, ROLES } from "@/modules/core/auth/roles";
import { getRequestMeta, getSession } from "@/modules/core/auth/session";
import { PLATFORM_SPACES } from "@/modules/core/brand/config";
import "./login.css";

export const metadata: Metadata = { title: "Ingresar" };

const MODULE_LABELS = { siga: PLATFORM_SPACES.siga.name, aula: PLATFORM_SPACES.aula.name } as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const delay = (d: number) => ({ "--d": d }) as CSSProperties;

/**
 * Ingreso unificado. Escena propia del Campus, "Noche en Chía": cielo con aurora
 * y estrellas, cerros en silueta y Lunita elevándose como la luna.
 * Contrato con Astro: `?rol=`, `?modulo=` y `?next=` (REGLAS.md §1.3).
 */
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
    <div className="login-scene">
      <NightSkyBackdrop />

      <div className="login-layout">
        <header className="login-topbar login-fade">
          <Link href="/login" className="login-brand">
            <LunitaEmblem size={34} />
            <span>
              <small>Campus Digital</small>
              <strong>Liceo Lunita de Chía</strong>
            </span>
          </Link>
          <Link href="/matriculas" className="login-enroll">
            Matrícula 2027 <ArrowRight aria-hidden />
          </Link>
        </header>

        <main className="login-main">
          <section className="login-hero" aria-labelledby="brand-title">
            <div className="login-lunita">
              <LunitaCharacter size="clamp(150px, 24vw, 300px)" listen />
            </div>
            <h1 id="brand-title" className="login-title login-rise" style={delay(0)}>
              Tu colegio, en <span className="login-pill">un solo lugar</span>
            </h1>
            <p className="login-lead login-rise" style={delay(1)}>
              Notas, tareas y comunicación con el colegio, con un único acceso.
            </p>
          </section>

          <section className="login-card" aria-labelledby="login-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="login-title">Ingresa al Campus</h2>
              {validModule && <Chip tone="blue">{MODULE_LABELS[validModule]}</Chip>}
            </div>
            <p className="mt-1 mb-5 text-muted">Estudiantes, familias y docentes.</p>

            {single(params.clave) === "actualizada" && (
              <p role="status" className="mb-4 rounded-control border border-green bg-green-l px-4 py-3 text-sm font-bold text-navy">
                Tu contraseña se actualizó y cerramos tus sesiones anteriores. Ingresa con la nueva.
              </p>
            )}
            {single(params.error) === "demo" && (
              <p role="alert" className="mb-4 rounded-control border border-orange bg-orange-l px-4 py-3 text-sm font-bold text-navy">
                La cuenta de demostración no está disponible.
              </p>
            )}

            <LoginForm initialAudience={isLoginRoleParam(rol) ? rol : undefined} next={next} modulo={validModule} />

            <p className="mt-5 text-sm text-muted">¿Primer ingreso? Secretaría te entrega tu acceso.</p>

            {demoEnabled && <DemoAccess hints={demoHints} next={next} modulo={validModule} />}
          </section>
        </main>

        <footer className="login-footer login-fade" style={{ "--d": "1.1s" } as CSSProperties}>
          <ShieldCheck aria-hidden />
          Tus datos y los de tus hijos están protegidos (Ley 1581 de 2012).
        </footer>
      </div>
    </div>
  );
}
