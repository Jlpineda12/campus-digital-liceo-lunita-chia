import type { Role } from "./roles";

/**
 * Cuentas semilla para probar los 5 roles (PLAN_MIGRACION_Y_FASES.md, Fase 1).
 * Los datos son ficticios. El acceso rápido sin contraseña exige las tres
 * condiciones de `isDemoLoginEnabled`; `src/instrumentation.ts` además impide
 * arrancar en producción con la variable activada.
 */
export const DEMO_ACCOUNTS: Record<Role, { documentNumber: string; hint: string }> = {
  STUDENT: { documentNumber: "1070000001", hint: "Sofía · 7A" },
  GUARDIAN: { documentNumber: "52000001", hint: "Laura · 2 hijos" },
  TEACHER: { documentNumber: "79000001", hint: "Andrés · Matemáticas" },
  COORDINATOR: { documentNumber: "80000001", hint: "Patricia · Coordinación" },
  ADMIN: { documentNumber: "51000001", hint: "Carmen · Secretaría" },
};

/** Hosts locales: loopback y dominios `.localhost`. */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const hostname = host.startsWith("[")
    ? host.slice(1, host.indexOf("]"))
    : (host.split(":")[0] ?? "");
  const name = hostname.toLowerCase();
  return (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name === "::1" ||
    /^127(?:\.\d{1,3}){3}$/.test(name)
  );
}

/**
 * Acceso demo: fuera de producción, con DEMO_LOGIN_ENABLED=true y solo cuando la
 * petición llega a un host local (defensa adicional ante un staging público mal
 * configurado con NODE_ENV=development).
 */
export function isDemoLoginEnabled(host: string | null | undefined): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEMO_LOGIN_ENABLED === "true" &&
    isLocalHost(host)
  );
}
