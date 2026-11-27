"use client";

import type { CSSProperties } from "react";
import { StheamiIcon } from "@/components/brand/StheamiIcon";
import { PILLAR_META, STHEAMI_PILLARS, type StheamiPillar } from "@/modules/core/academic-structure/stheami";

/**
 * Los 7 bloques STHEAMI del sitio web (letra en baldosa 3D + símbolo SVG +
 * borde del color del pilar), animados al entrar. Cada bloque es un filtro:
 * al tocarlo se ven solo las materias de ese pilar.
 */
export function StheamiBlocks({
  counts,
  selected,
  onSelect,
}: {
  counts: Partial<Record<StheamiPillar, number>>;
  selected: StheamiPillar | null;
  onSelect: (pillar: StheamiPillar | null) => void;
}) {
  const meta = selected ? PILLAR_META[selected] : null;

  return (
    <section className="stheami-blocks" aria-labelledby="stheami-title" data-has-selection={selected ? "" : undefined}>
      <div className="stheami-blocks__head">
        <div>
          <p className="kicker">Así aprendemos</p>
          <h2 id="stheami-title" className="stheami-blocks__title">
            STHEAMI
          </h2>
        </div>
        {selected ? (
          <button type="button" className="stheami-blocks__all" onClick={() => onSelect(null)}>
            Ver todas las materias
          </button>
        ) : (
          <p className="stheami-blocks__hint">Toca un bloque para ver solo esas materias.</p>
        )}
      </div>

      <ul className="stheami-blocks__grid">
        {STHEAMI_PILLARS.map((p, i) => {
          const m = PILLAR_META[p];
          const count = counts[p] ?? 0;
          const isOn = selected === p;
          return (
            <li key={p} style={{ "--i": i } as CSSProperties}>
              <button
                type="button"
                className={`stheami-block t-${m.tone}`}
                aria-pressed={isOn}
                disabled={count === 0}
                onClick={() => onSelect(isOn ? null : p)}
              >
                <span className="stheami-block__letter" aria-hidden>
                  {m.letter}
                </span>
                <StheamiIcon pillar={p} size={40} className="stheami-block__icon" />
                <span className="stheami-block__name">{m.name}</span>
                <span className="stheami-block__count">
                  {count === 0 ? "Sin materias" : `${count} ${count === 1 ? "materia" : "materias"}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {meta && (
        <p key={meta.letter} className={`stheami-blocks__desc t-${meta.tone}`} aria-live="polite">
          <StheamiIcon pillar={meta.letter} size={22} />
          <span>
            <strong>{meta.name}.</strong> {meta.description}
          </span>
        </p>
      )}
    </section>
  );
}
