import { Clock } from "lucide-react";
import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { PublicFrame } from "@/components/layout/PublicFrame";
import { PillButton } from "@/components/ui/PillButton";
import { getResetTokenOwner } from "@/modules/core/auth/password-reset";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  // El token viaja en la URL: no debe filtrarse por la cabecera Referer.
  referrer: "no-referrer",
};

export default async function NuevaClavePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const owner = await getResetTokenOwner(token);

  return (
    <PublicFrame narrow>
      <div className="card card-lg animate-pop-in">
        {owner ? (
          <>
            <h1 className="text-step-3">Crea tu nueva contraseña</h1>
            <p className="mt-2 mb-6 text-muted">
              Hola, {owner.firstName}. Elige una contraseña que no uses en otros sitios.
            </p>
            <NewPasswordForm token={token} />
          </>
        ) : (
          <div className="grid gap-4">
            <span className="grid size-14 place-items-center rounded-icon bg-orange-l text-orange-solid">
              <Clock className="size-7" aria-hidden />
            </span>
            <h1 className="text-step-3">Este enlace ya no es válido</h1>
            <p className="text-muted">
              Los enlaces de recuperación vencen a los 15 minutos y solo pueden usarse una vez.
              Solicita uno nuevo para continuar.
            </p>
            <PillButton href="/recuperar-clave">Solicitar un nuevo enlace</PillButton>
          </div>
        )}
      </div>
    </PublicFrame>
  );
}
