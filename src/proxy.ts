import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/modules/core/auth/cookies";
import { buildContentSecurityPolicy, createNonce } from "@/modules/core/security/csp";

/**
 * 1. Content-Security-Policy con nonce nuevo en cada petición.
 * 2. Chequeo optimista: sin cookie de sesión, las rutas del Campus redirigen a
 *    `/login?next=…`. La verificación real (sesión vigente, rol y vínculo con el
 *    estudiante) ocurre en el servidor junto a los datos.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/aula", "/siga", "/admin"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !request.cookies.has(SESSION_COOKIE)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const nonce = createNonce();
  const csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Todo excepto recursos estáticos que no necesitan CSP.
      source: "/((?!_next/static|_next/image|fonts/|brand/|icon.svg|robots.txt|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
