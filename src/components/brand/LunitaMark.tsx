import { LunitaCharacter } from "./LunitaCharacter";

/**
 * Logo del Campus: Lunita, el personaje del colegio, en versión compacta y
 * sin animación de entrada. Saluda al pasar el puntero. Se usa en todas las
 * zonas (Órbita, SIGA, Todo), en la barra lateral plegada y en móvil.
 * El escudo institucional (`LunitaEmblem`) queda para documentos oficiales.
 */
export function LunitaMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <LunitaCharacter
      compact
      size={size}
      intro={false}
      track={false}
      decorative
      className={["shrink-0", className].filter(Boolean).join(" ")}
    />
  );
}
