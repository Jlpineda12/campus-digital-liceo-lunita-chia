import { LunitaEmblem } from "@/components/ui/LunitaEmblem";
import { PillButton } from "@/components/ui/PillButton";

export default function NotFound() {
  return (
    <main className="block-navy grid min-h-dvh place-items-center px-5 py-16">
      <div className="card card-lg w-full max-w-md text-center">
        <LunitaEmblem size={64} className="mx-auto mb-4" />
        <p className="kicker justify-center">
          <span className="moon" aria-hidden /> Error 404
        </p>
        <h1 className="mt-2 text-step-3">Esta página no está en nuestra órbita</h1>
        <p className="mt-3 text-muted">
          Puede que el enlace haya cambiado o que no tengas permiso para ver este contenido.
        </p>
        <PillButton href="/dashboard" className="mt-6">
          Volver al Campus
        </PillButton>
      </div>
    </main>
  );
}
