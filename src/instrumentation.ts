/**
 * Verificaciones de arranque del servidor. Un error aquí impide iniciar la app.
 */
export function register(): void {
  if (process.env.NODE_ENV === "production" && process.env.DEMO_LOGIN_ENABLED === "true") {
    throw new Error(
      "DEMO_LOGIN_ENABLED=true no está permitido en producción: daría acceso sin contraseña a cuentas semilla.",
    );
  }
}
