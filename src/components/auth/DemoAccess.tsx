import { FlaskConical } from "lucide-react";
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

/** Accesos rápidos por rol con cuentas semilla. Solo se renderiza fuera de producción. */
export function DemoAccess({ hints, next, modulo }: DemoAccessProps) {
  return (
    <section aria-labelledby="demo-title" className="mt-6 border-t-2 border-dashed border-line pt-5">
      <h2 id="demo-title" className="flex items-center gap-2 text-sm font-extrabold tracking-wide text-navy uppercase">
        <FlaskConical className="size-4 text-purple-d" aria-hidden />
        Acceso de demostración
      </h2>
      <p className="mt-1 text-sm text-muted">Entra con una cuenta semilla para probar cada rol.</p>
      <div className="mt-3 grid gap-2.5">
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
    </section>
  );
}
