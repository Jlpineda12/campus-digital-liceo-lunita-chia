#!/usr/bin/env node
/**
 * Elimina los archivos AppleDouble (`._*`) que macOS crea junto a cada archivo
 * cuando el proyecto vive en un disco exFAT/FAT. Algunas herramientas (p. ej.
 * drizzle-kit) los leen como si fueran JSON o SQL y fallan.
 *
 * Uso: node scripts/clean-appledouble.mjs [carpeta ...]   (por defecto: drizzle src public)
 */
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP = new Set(["node_modules", ".next", ".git"]);
const roots = process.argv.slice(2);
let removed = 0;

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.name.startsWith("._")) {
      // Solo archivos AppleDouble reales (cabecera binaria de 4 KB aprox.)
      if (statSync(path).isFile()) {
        rmSync(path, { force: true });
        removed += 1;
      }
      continue;
    }
    if (entry.isDirectory() && !SKIP.has(entry.name)) walk(path);
  }
}

for (const root of roots.length > 0 ? roots : ["drizzle", "src", "public"]) walk(root);
if (removed > 0) console.log(`🧹 ${removed} archivos AppleDouble (._*) eliminados`);
