import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Cabeceras de seguridad, anti-huella tecnológica y rendimiento (REGLAS.md §3.3).
 * La CSP con nonce único por petición se genera en `src/proxy.ts`.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const immutableAssetHeaders = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];

const nextConfig: NextConfig = {
  // Oculta la cabecera `X-Powered-By` y evita exponer mapas fuente al cliente en producción.
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Drivers de servidor: se cargan desde node_modules, nunca se empaquetan al cliente.
  serverExternalPackages: ["pg", "nodemailer", "exceljs"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/fonts/:path*", headers: immutableAssetHeaders },
      { source: "/brand/:path*", headers: immutableAssetHeaders },
    ];
  },
};

export default nextConfig;
