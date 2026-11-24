import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminUsersHeaderActions } from "@/components/admin/users/AdminUsersHeaderActions";
import { UserManagePanel } from "@/components/admin/users/UserManagePanel";
import { Chip } from "@/components/ui/Chip";
import { cx } from "@/components/ui/cx";
import { pillButtonClass } from "@/components/ui/PillButton";
import { getCurrentAcademicContext } from "@/modules/core/academic-structure/queries";
import { requirePermission } from "@/modules/core/auth/guards";
import { can } from "@/modules/core/auth/permissions";
import { isRole, ROLE_META, ROLES, type Role } from "@/modules/core/auth/roles";
import { getManagedUserDetail, listUsersDirectory } from "@/modules/core/users/queries";

export const metadata: Metadata = { title: "Usuarios y roles" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildUsersHref(params: {
  q?: string;
  rol?: string;
  estado?: string;
  pagina?: number;
  porPagina?: number;
  usuario?: string;
}): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.rol) qs.set("rol", params.rol);
  if (params.estado && params.estado !== "all") qs.set("estado", params.estado);
  if (params.pagina && params.pagina > 1) qs.set("pagina", String(params.pagina));
  if (params.porPagina && params.porPagina !== 25) qs.set("porPagina", String(params.porPagina));
  if (params.usuario) qs.set("usuario", params.usuario);
  const str = qs.toString();
  return str ? `/admin/usuarios?${str}` : "/admin/usuarios";
}

export default async function UsuariosAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("users.read");
  const params = await searchParams;
  const context = await getCurrentAcademicContext();

  const canManage = can(actor.role, "users.manage");
  const canRevokeSessions = can(actor.role, "sessions.revoke");

  const query = single(params.q)?.trim() || undefined;
  const rawRole = single(params.rol);
  const role: Role | undefined = isRole(rawRole) ? rawRole : undefined;
  const rawStatus = single(params.estado);
  const status = rawStatus === "active" || rawStatus === "inactive" ? rawStatus : "all";
  const rawPage = Number(single(params.pagina));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const rawSize = Number(single(params.porPagina));
  const pageSize = rawSize === 50 || rawSize === 100 ? rawSize : 25;
  const rawSelected = single(params.usuario);
  const selectedUserId = rawSelected && UUID_RE.test(rawSelected) ? rawSelected : undefined;

  const [directory, selectedUser] = await Promise.all([
    listUsersDirectory({
      academicYearId: context?.year.id ?? null,
      query,
      role,
      status,
      page,
      pageSize,
    }),
    selectedUserId ? getManagedUserDetail(selectedUserId) : Promise.resolve(null),
  ]);

  const startIndex = directory.total === 0 ? 0 : (directory.page - 1) * directory.pageSize + 1;
  const endIndex = Math.min(directory.page * directory.pageSize, directory.total);

  return (
    <div className="grid gap-6">
      <header className="grid gap-4">
        <div>
          <p className="kicker">Gestión institucional · RBAC</p>
          <h1 className="mt-1 text-step-3">Usuarios y roles</h1>
          <p className="mt-1 text-sm text-muted">
            Directorio para 1.000+ cuentas, carga masiva por Excel con credenciales personalizadas y control de sesiones.
          </p>
        </div>
        {canManage && <AdminUsersHeaderActions />}
      </header>

      {/* Franja única de distribución por rol */}
      <section
        aria-label="Distribución de cuentas"
        className="card grid grid-cols-2 divide-y divide-line p-0 sm:grid-cols-5 sm:divide-x sm:divide-y-0"
      >
        <div className="px-4 py-3.5">
          <p className="text-[0.7rem] font-bold tracking-wide text-muted uppercase">Total cuentas</p>
          <p className="mt-1 text-step-2 leading-none font-black text-navy tabular-nums">
            {directory.counts.total}
          </p>
          <p className="mt-1 text-[0.7rem] font-semibold text-green-solid tabular">
            {directory.counts.active} activas
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[0.7rem] font-bold tracking-wide text-muted uppercase">Estudiantes</p>
          <p className="mt-1 text-step-2 leading-none font-black text-navy tabular-nums">
            {directory.counts.byRole.STUDENT}
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[0.7rem] font-bold tracking-wide text-muted uppercase">Acudientes</p>
          <p className="mt-1 text-step-2 leading-none font-black text-navy tabular-nums">
            {directory.counts.byRole.GUARDIAN}
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[0.7rem] font-bold tracking-wide text-muted uppercase">Docentes</p>
          <p className="mt-1 text-step-2 leading-none font-black text-navy tabular-nums">
            {directory.counts.byRole.TEACHER}
          </p>
        </div>
        <div className="col-span-2 px-4 py-3.5 sm:col-span-1">
          <p className="text-[0.7rem] font-bold tracking-wide text-muted uppercase">Directivos</p>
          <p className="mt-1 text-step-2 leading-none font-black text-navy tabular-nums">
            {directory.counts.byRole.COORDINATOR + directory.counts.byRole.ADMIN}
          </p>
        </div>
      </section>

      {/* Panel de gestión del usuario seleccionado */}
      {selectedUser && (
        <UserManagePanel
          key={selectedUser.id}
          user={selectedUser}
          canManage={canManage}
          canRevokeSessions={canRevokeSessions}
          closeHref={buildUsersHref({
            q: query,
            rol: role,
            estado: status,
            pagina: directory.page,
            porPagina: pageSize,
          })}
        />
      )}

      {/* Buscador y filtros */}
      <section aria-label="Buscar y filtrar usuarios" className="grid gap-3">
        <form method="get" className="flex flex-wrap items-center gap-2.5">
          {role && <input type="hidden" name="rol" value={role} />}
          {status !== "all" && <input type="hidden" name="estado" value={status} />}
          {pageSize !== 25 && <input type="hidden" name="porPagina" value={String(pageSize)} />}
          <div className="relative min-w-60 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={query ?? ""}
              placeholder="Buscar por nombre (con o sin tildes), documento, correo o grupo (ej. 7A)…"
              aria-label="Buscar usuarios"
              className="input min-h-10 pl-10 text-sm font-medium"
            />
          </div>
          <button type="submit" className={pillButtonClass({ variant: "navy", size: "sm" })}>
            Buscar
          </button>
          {(query || role || status !== "all") && (
            <Link
              href={buildUsersHref({ porPagina: pageSize })}
              className={pillButtonClass({ variant: "outline", size: "sm" })}
            >
              <X className="size-3.5" aria-hidden /> Ver los {directory.counts.total}
            </Link>
          )}
        </form>

        {query && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-sky/40 bg-sky-l/45 px-3.5 py-2 text-xs font-semibold text-navy">
            <span>
              Filtro activo por texto: <strong>«{query}»</strong> ({directory.total} resultado
              {directory.total === 1 ? "" : "s"}).
            </span>
            <Link
              href={buildUsersHref({ rol: role, estado: status, porPagina: pageSize })}
              className="font-bold text-sky-solid"
            >
              Quitar búsqueda
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav aria-label="Filtrar por rol" className="flex flex-wrap gap-1.5">
            <Link
              href={buildUsersHref({ estado: status, porPagina: pageSize })}
              aria-current={!role && !query ? "page" : undefined}
              className={cx(
                "rounded-control border px-2.5 py-1 text-xs font-semibold no-underline transition-colors",
                !role
                  ? "border-navy bg-navy text-white"
                  : "border-line-2 bg-white text-navy hover:bg-cloud",
              )}
            >
              Todos los roles ({directory.counts.total})
            </Link>
            {ROLES.map((r) => {
              const active = role === r;
              return (
                <Link
                  key={r}
                  href={buildUsersHref({ rol: r, estado: status, porPagina: pageSize })}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "rounded-control border px-2.5 py-1 text-xs font-semibold no-underline transition-colors",
                    active
                      ? "border-navy bg-navy text-white"
                      : "border-line-2 bg-white text-navy hover:bg-cloud",
                  )}
                >
                  {ROLE_META[r].label} ({directory.counts.byRole[r]})
                </Link>
              );
            })}
          </nav>

          <nav aria-label="Filtrar por estado" className="inline-flex rounded-control border border-line bg-bg-2 p-0.5 text-xs">
            {(
              [
                { key: "all", label: "Todos" },
                { key: "active", label: "Activos" },
                { key: "inactive", label: "Inactivos" },
              ] as const
            ).map((opt) => (
              <Link
                key={opt.key}
                href={buildUsersHref({ q: query, rol: role, estado: opt.key, porPagina: pageSize })}
                className={cx(
                  "rounded-md px-2.5 py-1 font-semibold no-underline transition-colors",
                  status === opt.key ? "bg-white text-navy shadow-2xs" : "text-muted hover:text-navy",
                )}
              >
                {opt.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {/* Tabla paginada del directorio */}
      <section aria-label="Listado de usuarios" className="card overflow-hidden p-0">
        {directory.items.length === 0 ? (
          <div className="grid gap-2 px-6 py-10 text-center">
            <p className="text-sm font-bold text-navy">No encontramos cuentas con estos filtros.</p>
            <p className="text-xs text-muted">
              Prueba limpiando la búsqueda o cambiando el rol / estado seleccionado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tactile-table">
              <caption className="sr-only">Directorio institucional de usuarios y roles</caption>
              <thead>
                <tr>
                  <th scope="col">Usuario</th>
                  <th scope="col">Documento</th>
                  <th scope="col">Rol y ubicación</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="text-right">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {directory.items.map((u) => {
                  const isSelected = u.id === selectedUserId;
                  return (
                    <tr key={u.id} className={isSelected ? "bg-cloud/75" : undefined}>
                      <td className="max-w-56">
                        <p className="truncate font-bold text-navy">{u.fullName}</p>
                        <p className="truncate text-xs text-muted">{u.email ?? "Sin correo registrado"}</p>
                      </td>
                      <td className="text-sm font-semibold whitespace-nowrap text-ink-2 tabular">
                        {u.documentType} {u.documentNumber}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Chip tone={ROLE_META[u.role].tone}>{ROLE_META[u.role].label}</Chip>
                          {u.groupLabel && (
                            <span className="text-xs font-semibold text-muted">{u.groupLabel}</span>
                          )}
                          {u.role === "GUARDIAN" && u.linkedCount > 0 && (
                            <span className="text-xs text-muted">
                              · {u.linkedCount} {u.linkedCount === 1 ? "hijo" : "hijos"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`inline-flex items-center gap-1 font-bold whitespace-nowrap ${
                              u.isActive ? "text-green-solid" : "text-red-solid"
                            }`}
                          >
                            <span
                              className={`size-2 rounded-full ${u.isActive ? "bg-green-solid" : "bg-red-solid"}`}
                              aria-hidden
                            />
                            {u.isActive ? "Activa" : "Inactiva"}
                          </span>
                          {u.activeSessions > 0 && (
                            <span className="rounded-chip bg-sky-l px-1.5 py-0.5 font-semibold whitespace-nowrap text-sky-solid tabular">
                              {u.activeSessions} {u.activeSessions === 1 ? "sesión" : "sesiones"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <Link
                          href={buildUsersHref({
                            q: query,
                            rol: role,
                            estado: status,
                            pagina: directory.page,
                            porPagina: pageSize,
                            usuario: u.id,
                          })}
                          className={pillButtonClass({
                            variant: isSelected ? "navy" : "outline",
                            size: "sm",
                          })}
                        >
                          <SlidersHorizontal aria-hidden />
                          {canManage ? "Gestionar" : "Ver detalle"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación + selector de filas por página */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg-2/60 px-5 py-3 text-xs text-muted">
          <div className="flex flex-wrap items-center gap-3">
            <p className="tabular">
              Mostrando <strong className="text-navy">{startIndex}–{endIndex}</strong> de{" "}
              <strong className="text-navy">{directory.total}</strong> cuentas
            </p>
            <div className="flex items-center gap-1">
              <span>Ver:</span>
              {([25, 50, 100] as const).map((size) => (
                <Link
                  key={size}
                  href={buildUsersHref({ q: query, rol: role, estado: status, porPagina: size })}
                  className={cx(
                    "rounded-md px-2 py-0.5 font-bold no-underline tabular",
                    pageSize === size ? "bg-navy text-white" : "bg-white text-navy ring-1 ring-line hover:bg-cloud",
                  )}
                >
                  {size}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {directory.page > 1 ? (
              <Link
                href={buildUsersHref({
                  q: query,
                  rol: role,
                  estado: status,
                  pagina: directory.page - 1,
                  porPagina: pageSize,
                })}
                className={pillButtonClass({ variant: "outline", size: "sm" })}
              >
                <ChevronLeft aria-hidden /> Anterior
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-control border border-line px-3 py-1.5 font-semibold text-muted/60">
                <ChevronLeft className="size-4" aria-hidden /> Anterior
              </span>
            )}

            <span className="px-2 font-bold text-navy tabular">
              Página {directory.page} de {directory.totalPages}
            </span>

            {directory.page < directory.totalPages ? (
              <Link
                href={buildUsersHref({
                  q: query,
                  rol: role,
                  estado: status,
                  pagina: directory.page + 1,
                  porPagina: pageSize,
                })}
                className={pillButtonClass({ variant: "outline", size: "sm" })}
              >
                Siguiente <ChevronRight aria-hidden />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-control border border-line px-3 py-1.5 font-semibold text-muted/60">
                Siguiente <ChevronRight className="size-4" aria-hidden />
              </span>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
