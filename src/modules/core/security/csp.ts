/**
 * Content-Security-Policy estricta con nonce por petición (REGLAS.md §3.3).
 * Archivo puro: lo usa `src/proxy.ts` y las pruebas.
 *
 * - Scripts: solo los que lleven el nonce (Next.js lo aplica a los suyos) y los
 *   que estos carguen (`strict-dynamic`). Sin `unsafe-inline`.
 * - Estilos: se permite `unsafe-inline` porque React serializa atributos `style`
 *   y Next inyecta estilos en desarrollo; el riesgo crítico (scripts) queda cerrado.
 */
export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
