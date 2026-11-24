import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/** Busca la cuenta por correo (si contiene "@") o por número de documento. */
export async function findUserForLogin(normalizedIdentifier: string) {
  const column = normalizedIdentifier.includes("@") ? users.email : users.documentNumber;
  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
      role: users.role,
    })
    .from(users)
    .where(eq(column, normalizedIdentifier))
    .limit(1);
  return user ?? null;
}

export async function findUserIdByDocument(documentNumber: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.documentNumber, documentNumber))
    .limit(1);
  return user?.isActive ? user.id : null;
}
