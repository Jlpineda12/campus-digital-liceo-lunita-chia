import type { Metadata } from "next";
import { ResetRequestForm } from "@/components/auth/ResetRequestForm";
import { PublicFrame } from "@/components/layout/PublicFrame";

export const metadata: Metadata = { title: "Recuperar contraseña" };

/** Ruta pública estable (REGLAS.md §1.3): recuperación autónoma de contraseña. */
export default function RecuperarClavePage() {
  return (
    <PublicFrame narrow>
      <div className="card card-lg animate-pop-in">
        <h1 className="text-step-3">Recupera tu acceso</h1>
        <p className="mt-2 mb-6 text-muted">
          Escribe tu número de documento o el correo registrado en el colegio.
        </p>
        <ResetRequestForm />
      </div>
    </PublicFrame>
  );
}
