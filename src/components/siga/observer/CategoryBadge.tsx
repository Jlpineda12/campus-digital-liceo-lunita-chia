import { AlertTriangle, Award, BookOpenCheck, ShieldAlert, Sparkles } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { OBSERVER_CATEGORY_META, type ObserverCategory } from "@/modules/siga/observer/meta";

const ICONS: Record<ObserverCategory, typeof Award> = {
  PRAISE: Award,
  ACADEMIC: BookOpenCheck,
  TYPE_I: AlertTriangle,
  TYPE_II: ShieldAlert,
  TYPE_III: ShieldAlert,
};

/** Etiqueta accesible de categoría del Observador (icono + texto + color, nunca solo color). */
export function CategoryBadge({
  category,
  compact = false,
  className,
}: {
  category: ObserverCategory;
  compact?: boolean;
  className?: string;
}) {
  const meta = OBSERVER_CATEGORY_META[category];
  const Icon = ICONS[category];
  return (
    <Chip tone={meta.tone} className={className} title={meta.description}>
      <Icon aria-hidden />
      <span>{compact ? meta.shortLabel : meta.label}</span>
    </Chip>
  );
}

/** Indicador de reconocimiento para uso decorativo en estados vacíos o felicitaciones. */
export { Sparkles };
