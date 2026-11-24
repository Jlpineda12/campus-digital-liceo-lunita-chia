import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { admissionApplications, enrollmentDocuments } from "@/db/schema";
import { can } from "@/modules/core/auth/permissions";
import { getSession } from "@/modules/core/auth/session";
import { normalizeDocumentNumber } from "@/modules/core/users/schemas";
import { readPrivateAdmissionFile } from "@/modules/matriculas/storage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Descarga segura de documentos de matrícula y comprobantes de pago (Ley 1581).
 * Autoriza exclusivamente a Coordinación/Secretaría (`enrollment.review`) o al
 * acudiente que aporta `radicado` + `documento` coincidentes.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tipo = sp.get("tipo"); // "doc" | "pago"
  const id = sp.get("id") ?? "";
  const radicado = (sp.get("radicado") ?? "").trim().toUpperCase();
  const docAcudiente = normalizeDocumentNumber(sp.get("doc") ?? "");
  const forceDownload = sp.get("descargar") === "1";

  if ((tipo !== "doc" && tipo !== "pago") || !UUID_RE.test(id)) {
    return new NextResponse("Parámetros inválidos.", { status: 400 });
  }

  const session = await getSession();
  const isStaff = Boolean(session && can(session.user.role, "enrollment.review"));

  let storageKey: string | null = null;
  let fileName = "documento-matricula";

  if (tipo === "doc") {
    const [row] = await db
      .select({
        storageKey: enrollmentDocuments.storageKey,
        originalFileName: enrollmentDocuments.originalFileName,
        trackingCode: admissionApplications.trackingCode,
        guardianDocNumber: admissionApplications.guardianDocNumber,
      })
      .from(enrollmentDocuments)
      .innerJoin(admissionApplications, eq(admissionApplications.id, enrollmentDocuments.applicationId))
      .where(eq(enrollmentDocuments.id, id))
      .limit(1);

    if (!row?.storageKey) return new NextResponse("Documento no encontrado.", { status: 404 });

    const matchesPublic =
      radicado.length > 0 &&
      docAcudiente.length >= 5 &&
      row.trackingCode === radicado &&
      row.guardianDocNumber === docAcudiente;

    if (!isStaff && !matchesPublic) {
      return new NextResponse("No autorizado.", { status: 403 });
    }
    storageKey = row.storageKey;
    fileName = row.originalFileName ?? "documento-admision";
  } else {
    const [row] = await db
      .select({
        paymentReceiptKey: admissionApplications.paymentReceiptKey,
        trackingCode: admissionApplications.trackingCode,
        guardianDocNumber: admissionApplications.guardianDocNumber,
      })
      .from(admissionApplications)
      .where(eq(admissionApplications.id, id))
      .limit(1);

    if (!row?.paymentReceiptKey) return new NextResponse("Comprobante no encontrado.", { status: 404 });

    const matchesPublic =
      radicado.length > 0 &&
      docAcudiente.length >= 5 &&
      row.trackingCode === radicado &&
      row.guardianDocNumber === docAcudiente;

    if (!isStaff && !matchesPublic) {
      return new NextResponse("No autorizado.", { status: 403 });
    }
    storageKey = row.paymentReceiptKey;
    fileName = `comprobante-${row.trackingCode}`;
  }

  const file = await readPrivateAdmissionFile(storageKey);
  if (!file) return new NextResponse("Archivo no disponible.", { status: 404 });

  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
  const finalName = safeName.endsWith(`.${file.ext}`) ? safeName : `${safeName}.${file.ext}`;
  const disposition = forceDownload ? "attachment" : "inline";

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.buffer.length),
      "Content-Disposition": `${disposition}; filename="${finalName}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
