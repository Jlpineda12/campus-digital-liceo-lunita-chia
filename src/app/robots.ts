import type { MetadataRoute } from "next";

/** El Campus es privado: ningún buscador debe indexarlo (REGLAS.md §3.1). */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
