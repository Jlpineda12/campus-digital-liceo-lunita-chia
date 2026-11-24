import { NextRequest, NextResponse } from "next/server";
import { can } from "@/modules/core/auth/permissions";
import { getSession } from "@/modules/core/auth/session";
import { buildUsersTemplateCsv, buildUsersTemplateXlsx } from "@/modules/core/users/excel";

/**
 * Descarga de plantilla oficial Excel (.xlsx) o CSV para carga masiva de usuarios.
 * Protegido por sesión y permiso `users.manage` (exclusivo Secretaría / Rectoría).
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Autenticación requerida." }, { status: 401 });
  }
  if (!can(session.user.role, "users.manage")) {
    return NextResponse.json({ error: "No tienes permiso para descargar esta plantilla." }, { status: 403 });
  }

  const format = request.nextUrl.searchParams.get("formato");
  if (format === "csv") {
    const csv = buildUsersTemplateCsv();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="plantilla-usuarios-lunita.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  const xlsx = await buildUsersTemplateXlsx();
  return new NextResponse(new Uint8Array(xlsx), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-usuarios-lunita.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
