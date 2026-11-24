/**
 * Reglas de redirección post-login (contrato `/login?modulo=…` — REGLAS.md §1.3).
 * Archivo puro: sin acceso a base de datos.
 */
export const LOGIN_MODULES = ["siga", "aula"] as const;
export type LoginModule = (typeof LOGIN_MODULES)[number];

export function isLoginModule(value: unknown): value is LoginModule {
  return typeof value === "string" && (LOGIN_MODULES as readonly string[]).includes(value);
}

/**
 * Destino de cada módulo tras iniciar sesión (docs/secciones/01 §1.3).
 * `/aula` llega con la Fase 3; mientras tanto lleva al panel principal.
 */
export const MODULE_HOME: Record<LoginModule, string> = {
  siga: "/siga/calificaciones",
  aula: "/dashboard",
};

const INTERNAL_ORIGIN = "http://campus.internal";

/**
 * Devuelve una ruta interna segura o `null`. Evita redirecciones abiertas
 * (`//evil.com`, `https://…`, `/\evil.com`) y bucles hacia `/login`.
 */
export function safeRedirectPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(next, INTERNAL_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== INTERNAL_ORIGIN) return null;
  if (url.pathname === "/login" || url.pathname.startsWith("/api/")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function resolvePostLoginPath(options: {
  next?: string | null;
  modulo?: LoginModule | null;
}): string {
  return (
    safeRedirectPath(options.next) ?? (options.modulo ? MODULE_HOME[options.modulo] : "/dashboard")
  );
}
