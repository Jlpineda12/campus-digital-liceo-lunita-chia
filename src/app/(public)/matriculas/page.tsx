import type { Metadata } from "next";
import { PublicFrame } from "@/components/layout/PublicFrame";
import { PublicAdmissionsPortal } from "@/components/matriculas/PublicAdmissionsPortal";
import { getSession } from "@/modules/core/auth/session";
import {
  listGuardianRenewalCandidates,
  listPublicGradesForAdmission,
  lookupPublicApplication,
} from "@/modules/matriculas/queries";

export const metadata: Metadata = { title: "Matrícula en línea 2027 · Liceo Lunita de Chía" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Ruta pública estable del contrato con el sitio Astro (REGLAS.md §1.3).
 * Permite radicar nuevas solicitudes 2027, precargar renovaciones para familias
 * autenticadas, calcular costos y subir los 8 documentos de admisión en privado.
 */
export default async function MatriculasPage({ searchParams }: { searchParams: SearchParams }) {
  const [sp, session, grades] = await Promise.all([
    searchParams,
    getSession(),
    listPublicGradesForAdmission(),
  ]);

  const radicado = (single(sp.radicado) ?? "").trim();
  const doc = (single(sp.doc) ?? "").trim();

  const [renewalCandidates, lookedUpApp] = await Promise.all([
    session?.user.role === "GUARDIAN" ? listGuardianRenewalCandidates(session.user.id) : Promise.resolve([]),
    radicado && doc ? lookupPublicApplication(radicado, doc) : Promise.resolve(null),
  ]);

  return (
    <PublicFrame>
      <PublicAdmissionsPortal
        grades={grades}
        renewalCandidates={renewalCandidates}
        isLoggedGuardian={session?.user.role === "GUARDIAN"}
        lookedUpApp={lookedUpApp}
        lookupQuery={{ radicado, doc }}
      />
    </PublicFrame>
  );
}
