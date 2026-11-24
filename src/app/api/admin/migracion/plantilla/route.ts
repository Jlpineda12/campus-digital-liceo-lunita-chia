import { NextRequest, NextResponse } from "next/server";
import { MIGRATION_SOURCE_KINDS, type MigrationSourceKind } from "@/db/schema/migration";
import { can } from "@/modules/core/auth/permissions";
import { getSession } from "@/modules/core/auth/session";
import { buildMigrationTemplateBuffer } from "@/modules/migration/templates";

/**
 * Descarga oficial de plantillas de migración (.xlsx / Moodle .xml).
 * Exclusivo rol `ADMIN` (`migration.run`).
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("No autenticado.", { status: 401 });
  if (!can(session.user.role, "migration.run")) {
    return new NextResponse("Acceso restringido a Administración.", { status: 403 });
  }

  const rawKind = request.nextUrl.searchParams.get("tipo")?.toUpperCase() ?? "";
  if (!(MIGRATION_SOURCE_KINDS as readonly string[]).includes(rawKind)) {
    return new NextResponse("Tipo de plantilla inválido.", { status: 400 });
  }

  const file = await buildMigrationTemplateBuffer(rawKind as MigrationSourceKind);
  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
