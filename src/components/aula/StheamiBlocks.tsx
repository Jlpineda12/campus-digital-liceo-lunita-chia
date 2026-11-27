import Link from "next/link";
import type { CSSProperties } from "react";
import { StheamiIcon } from "@/components/brand/StheamiIcon";
import { PILLAR_META, STHEAMI_PILLARS, type StheamiPillar } from "@/modules/core/academic-structure/stheami";

/**
 * Los 7 bloques STHEAMI del sitio web (letra en baldosa 3D + símbolo SVG
 * animado + borde del color del pilar) para el Inicio de todos los roles.
 * Cada bloque abre la lista de cursos del rol filtrada por ese pilar.
 */
export function StheamiBlocks({
  counts,
  hrefBase,
  unit,
  hint,
}: {
  counts: Partial<Record<StheamiPillar, number>>;
  /** Ruta a la que se agrega `?pilar=X` (Mis cursos o Seguimiento). */
  hrefBase: string;
  unit: { one: string; many: string };
  hint: string;
}) {
  return (
    <section className="stheami-blocks" aria-labelledby="stheami-title">
      <div className="stheami-blocks__head">
        <div>
          <p className="kicker">Así aprendemos</p>
          <h2 id="stheami-title" className="stheami-blocks__title">
            STHEAMI
          </h2>
        </div>
        <p className="stheami-blocks__hint">{hint}</p>
      </div>

      <ul className="stheami-blocks__grid">
        {STHEAMI_PILLARS.map((p, i) => {
          const m = PILLAR_META[p];
          const count = counts[p] ?? 0;
          const body = (
            <>
              <span className="stheami-block__letter" aria-hidden>
                {m.letter}
              </span>
              <StheamiIcon pillar={p} size={40} className="stheami-block__icon" />
              <span className="stheami-block__name">{m.name}</span>
              <span className="stheami-block__count">
                {count === 0 ? `Sin ${unit.many}` : `${count} ${count === 1 ? unit.one : unit.many}`}
              </span>
            </>
          );
          return (
            <li key={p} style={{ "--i": i } as CSSProperties}>
              {count > 0 ? (
                <Link href={`${hrefBase}?pilar=${p}`} className={`stheami-block t-${m.tone}`} title={m.description}>
                  {body}
                </Link>
              ) : (
                <span className={`stheami-block t-${m.tone}`} aria-disabled="true">
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Cuenta cursos por pilar (para los bloques). */
export function countByPillar(items: ReadonlyArray<{ pillar: StheamiPillar }>): Partial<Record<StheamiPillar, number>> {
  const counts: Partial<Record<StheamiPillar, number>> = {};
  for (const c of items) counts[c.pillar] = (counts[c.pillar] ?? 0) + 1;
  return counts;
}
