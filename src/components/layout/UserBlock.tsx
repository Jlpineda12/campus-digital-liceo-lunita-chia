import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { logoutAction } from "@/modules/core/auth/actions";
import { ROLE_META } from "@/modules/core/auth/roles";
import type { CampusShellData } from "@/modules/core/dashboard/shell";

/** Tarjeta del usuario en sesión con botón de cierre de sesión (sobre fondo navy). */
export function UserBlock({ user }: { user: CampusShellData["user"] }) {
  return (
    <div className="flex items-center gap-3 rounded-card bg-white/10 p-3">
      <Avatar initials={user.initials} src={user.avatarUrl} alt={user.fullName} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate font-extrabold text-white">{user.fullName}</p>
        <p className="truncate text-xs font-bold text-white/70">{ROLE_META[user.role].label}</p>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="grid size-10 place-items-center rounded-control text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut className="size-5" aria-hidden />
        </button>
      </form>
    </div>
  );
}
