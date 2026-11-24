import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/modules/core/auth/session";
import { isValidAvatarKey, readPrivateAvatarFile } from "@/modules/core/profile/storage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sirve fotos de perfil privadas únicamente a usuarios autenticados del Campus
 * (Ley 1581: las imágenes de estudiantes y docentes nunca quedan expuestas en `public/`).
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const actor = await getSession();
  if (!actor) {
    return new NextResponse("No autenticado.", { status: 401 });
  }

  const { userId } = await context.params;
  if (!UUID_RE.test(userId)) {
    return new NextResponse("Identificador inválido.", { status: 400 });
  }

  const [row] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!isValidAvatarKey(row?.avatarUrl)) {
    return new NextResponse("Sin foto de perfil.", { status: 404 });
  }

  const file = await readPrivateAvatarFile(row.avatarUrl);
  if (!file) {
    return new NextResponse("Imagen no encontrada.", { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.buffer.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=300",
    },
  });
}
