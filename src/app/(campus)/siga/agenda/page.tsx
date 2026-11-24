import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AgendaInbox } from "@/components/siga/agenda/AgendaInbox";
import { CircularComposer } from "@/components/siga/agenda/CircularComposer";
import { cx } from "@/components/ui/cx";
import { TactileCard } from "@/components/ui/TactileCard";
import { getCurrentAcademicContext } from "@/modules/core/academic-structure/queries";
import { requireSession } from "@/modules/core/auth/guards";
import { canPublishCircular } from "@/modules/siga/agenda/meta";
import {
  listAudienceOptionsForActor,
  listVisibleCircularsForActor,
} from "@/modules/siga/agenda/queries";

export const metadata: Metadata = { title: "Agenda y circulares" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AgendaPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireSession();
  const params = await searchParams;
  const context = await getCurrentAcademicContext();

  if (!context) {
    return <TactileCard className="text-center text-muted">No hay un año lectivo vigente.</TactileCard>;
  }

  const canPublish = canPublishCircular(actor.role);
  const [items, audience] = await Promise.all([
    listVisibleCircularsForActor(actor, context.year.id),
    canPublish ? listAudienceOptionsForActor(actor, context.year.id) : Promise.resolve(null),
  ]);

  const unreadItems = items.filter((i) => !i.readAt && !i.isAuthor);
  const readItems = items.filter((i) => Boolean(i.readAt) || i.isAuthor);
  const filter = single(params.estado);
  const filtered =
    filter === "pendientes" ? unreadItems : filter === "leidas" ? readItems : items;

  const showReadStats = actor.role === "ADMIN" || actor.role === "COORDINATOR" || actor.role === "TEACHER";

  return (
    <div className="grid gap-6">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">SIGA · Comunicación oficial</p>
            <h1 className="mt-1 text-step-3">Agenda y circulares</h1>
            <p className="mt-1 text-sm text-muted">
              Selecciona una circular de la lista para leerla sin distracciones y confirmar recibido.
            </p>
          </div>
          {audience && <CircularComposer audience={audience} />}
        </div>

        <nav aria-label="Filtrar circulares" className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
          {[
            { key: "todas", label: `Todas (${items.length})`, href: "/siga/agenda" },
            { key: "pendientes", label: `Sin leer (${unreadItems.length})`, href: "/siga/agenda?estado=pendientes" },
            { key: "leidas", label: `Leídas (${readItems.length})`, href: "/siga/agenda?estado=leidas" },
          ].map((tab) => {
            const active =
              (tab.key === "todas" && filter !== "pendientes" && filter !== "leidas") || filter === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "rounded-control border px-3 py-1.5 text-sm font-semibold no-underline transition-colors",
                  active
                    ? "border-navy bg-navy text-white"
                    : "border-line-2 bg-white text-navy hover:border-sky-solid hover:bg-cloud",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {filtered.length === 0 ? (
        <TactileCard className="grid gap-2 py-10 text-center">
          <Inbox className="mx-auto size-8 text-muted/60" aria-hidden />
          <p className="font-bold text-navy">
            {filter === "pendientes"
              ? "Estás al día con todas tus circulares"
              : "Aún no hay circulares publicadas en esta vista"}
          </p>
          <p className="text-sm text-muted">
            Cuando Rectoría, Coordinación o tus docentes publiquen un comunicado aparecerá aquí.
          </p>
        </TactileCard>
      ) : (
        <AgendaInbox items={filtered} showReadStats={showReadStats} />
      )}
    </div>
  );
}
