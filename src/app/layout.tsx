import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Campus Digital · Liceo Lunita de Chía",
    template: "%s · Campus Lunita",
  },
  description: "SIGA, Aula Virtual y Matrículas del Liceo Lunita de Chía en un solo lugar.",
  applicationName: "Campus Lunita",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0f1747",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Renderizado dinámico en todas las rutas: la CSP usa un nonce nuevo por
  // petición (src/proxy.ts) y Next solo puede aplicarlo a páginas dinámicas.
  await connection();

  return (
    <html lang="es-CO">
      <head>
        <link
          rel="preload"
          href="/fonts/nunito-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/inter-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
