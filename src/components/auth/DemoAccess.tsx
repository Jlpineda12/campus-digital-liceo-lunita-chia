import { ChevronDown, FlaskConical } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { demoLoginAction } from "@/modules/core/auth/actions";
import { ROLE_META, ROLES } from "@/modules/core/auth/roles";

const BUTTON_VARIANT = {
  sky: "btn-sky",
  green: "btn-green",
  purple: "btn-purple",
  yellow: "",
  orange: "btn-orange",
  red: "btn-red",
  pink: "btn-red",
  blue: "btn-blue",
} as const;

interface DemoAccessProps {
  hints: Record<(typeof ROLES)[number], string>;
  next?: string;
  modulo?: string;
}

/**
 * Accesos rápidos por rol con cuentas semilla (solo desarrollo y host local).
 * Plegado por defecto para no recargar la pantalla de ingreso.
 */
export function DemoAccess({ hints, next, modulo }: DemoAccessProps) {
  return (
    <details className="group mt-5 border-t border-dashed border-line pt-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-muted hover:text-navy">
        <FlaskConical className="size-4 text-purple-solid" aria-hidden />
        Probar con una cuenta de demostración
        <ChevronDown className="ml-auto size-4 transition-transform duration-200 group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-3 grid gap-2">
        {ROLES.map((role) => (
          <form key={role} action={demoLoginAction}>
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="next" value={next ?? ""} />
            <input type="hidden" name="modulo" value={modulo ?? ""} />
            <button
              type="submit"
              className={cx("btn btn-sm btn-block justify-between", BUTTON_VARIANT[ROLE_META[role].tone])}
            >
              <span>{ROLE_META[role].label}</span>
              <span className="truncate text-xs font-bold tracking-normal normal-case opacity-90">
                {hints[role]}
              </span>
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}
