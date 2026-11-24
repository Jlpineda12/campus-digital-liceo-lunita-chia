import Link from "next/link";
import type { Role } from "@/modules/core/auth/roles";

/**
 * Tarjeta blanca ilustrada al pie del menú lateral (fusión Liceo Lunita × VENTES):
 * impulsa la siguiente acción principal del usuario sin recargar la navegación.
 */
export function SidebarHighlightCard({
  role,
  pendingCount,
}: {
  role: Role;
  pendingCount: number;
}) {
  const config = (() => {
    switch (role) {
      case "STUDENT":
        return {
          title: pendingCount > 0 ? `${pendingCount} reto${pendingCount === 1 ? "" : "s"} por completar` : "¡Vas al día en Órbita!",
          subtitle: "Revisa tus guías PDF y cuestionarios interactivos.",
          cta: "Ver mis tareas",
          href: "/aula/tareas",
        };
      case "GUARDIAN":
        return {
          title: "Seguimiento familiar",
          subtitle: "Consulta notas, boletines y circulares en un clic.",
          cta: "Ver boletines",
          href: "/siga/boletines",
        };
      case "TEACHER":
        return {
          title: pendingCount > 0 ? `${pendingCount} entrega${pendingCount === 1 ? "" : "s"} por revisar` : "Órbita Virtual activa",
          subtitle: "Personaliza cursos, sube guías PDF y crea quizzes.",
          cta: "Ir a mis cursos",
          href: "/aula",
        };
      case "COORDINATOR":
      case "ADMIN":
        return {
          title: "Pulso académico",
          subtitle: "Monitorea cumplimiento docente de notas y logros.",
          cta: "Ver seguimiento",
          href: "/siga/calificaciones",
        };
    }
  })();

  return (
    <div className="rounded-2xl bg-white p-4 text-center text-navy shadow-[0_12px_28px_-12px_rgba(7,12,46,0.45)]">
      {/* Ilustración SVG cohete Lunita (azul cobalto + amarillo institucional) */}
      <div className="mx-auto mb-2.5 grid size-12 place-items-center rounded-2xl bg-cloud">
        <svg viewBox="0 0 48 48" className="size-9" aria-hidden="true">
          <circle cx="24" cy="24" r="18" fill="#E7E8FB" />
          <path
            d="M24 9c5.2 3.2 8 9.2 8 15.5 0 2.6-.6 4.8-1.5 6.5h-13c-.9-1.7-1.5-3.9-1.5-6.5C16 18.2 18.8 12.2 24 9Z"
            fill="#303296"
          />
          <circle cx="24" cy="21" r="3.4" fill="#FFC800" />
          <path d="M16 25.5 11.5 30l5 .8M32 25.5 36.5 30l-5 .8" stroke="#0369A1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M21 32.5c0 2.8 1.4 5 3 6.5 1.6-1.5 3-3.7 3-6.5h-6Z" fill="#FF9600" />
          <circle cx="11" cy="14" r="1.6" fill="#FFC800" />
          <circle cx="37" cy="16" r="1.3" fill="#1CB0F6" />
        </svg>
      </div>

      <p className="text-xs font-extrabold text-navy">{config.title}</p>
      <p className="mt-1 text-[0.7rem] leading-snug text-muted">{config.subtitle}</p>
      <Link
        href={config.href}
        className="mt-3 inline-flex w-full items-center justify-center rounded-pill bg-yellow px-3 py-2 text-xs font-extrabold text-navy no-underline shadow-[0_3px_0_var(--yellow-d)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        {config.cta}
      </Link>
    </div>
  );
}
