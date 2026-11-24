import { createHash, randomBytes } from "node:crypto";

/** Token aleatorio de 32 bytes (URL-safe). El valor en claro nunca se guarda. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash SHA-256 (hex) con el que se guarda y busca un token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Formato de un token emitido por `generateToken` (43 caracteres base64url). */
export function isWellFormedToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
