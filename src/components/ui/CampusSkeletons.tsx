/**
 * Estados de carga tipo «shimmer skeleton» personalizados del Liceo Lunita de Chía.
 * Se muestran automáticamente mediante Next.js Streaming (`loading.tsx`) al cambiar de sección.
 */

function LunitaLoadingBadge({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-pill border border-cobalt/15 bg-white px-3 py-1.5 text-xs font-bold text-cobalt shadow-2xs"
    >
      <span className="relative grid size-4 place-items-center" aria-hidden="true">
        <span
          className="absolute inset-0 rounded-full border-2 border-cobalt/20 border-t-cobalt"
          style={{ animation: "lunita-orbit 0.85s linear infinite" }}
        />
        <span className="size-1.5 rounded-full bg-yellow" />
      </span>
      <span>{label}</span>
    </div>
  );
}

/** Skeleton general del Campus (encabezado + KPIs + tarjetas de contenido). */
export function CampusPageSkeleton({ label = "Cargando espacio…" }: { label?: string }) {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-2">
          <div className="skeleton h-3 w-36 rounded-pill" />
          <div className="skeleton h-8 w-64 rounded-xl" />
          <div className="skeleton h-4 w-80 max-w-full rounded-lg" />
        </div>
        <LunitaLoadingBadge label={label} />
      </div>

      {/* Franja tipo Portal Dual o KPIs */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card grid gap-4 bg-white">
          <div className="flex items-center gap-3.5">
            <div className="skeleton size-14 shrink-0 rounded-2xl" />
            <div className="grid flex-1 gap-2">
              <div className="skeleton h-3 w-28 rounded-pill" />
              <div className="skeleton h-5 w-44 rounded-lg" />
            </div>
          </div>
          <div className="skeleton h-4 w-full rounded-lg" />
          <div className="flex gap-2">
            <div className="skeleton h-7 w-24 rounded-pill" />
            <div className="skeleton h-7 w-28 rounded-pill" />
            <div className="skeleton h-7 w-24 rounded-pill" />
          </div>
        </div>
        <div className="card grid gap-4 bg-white">
          <div className="flex items-center gap-3.5">
            <div className="skeleton size-14 shrink-0 rounded-2xl" />
            <div className="grid flex-1 gap-2">
              <div className="skeleton h-3 w-28 rounded-pill" />
              <div className="skeleton h-5 w-44 rounded-lg" />
            </div>
          </div>
          <div className="skeleton h-4 w-full rounded-lg" />
          <div className="flex gap-2">
            <div className="skeleton h-7 w-24 rounded-pill" />
            <div className="skeleton h-7 w-28 rounded-pill" />
            <div className="skeleton h-7 w-24 rounded-pill" />
          </div>
        </div>
      </div>

      {/* Lista de tarjetas o filas */}
      <div className="card grid gap-3.5 bg-white">
        <div className="skeleton h-5 w-48 rounded-lg" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4 border-t border-line/60 pt-3.5">
            <div className="flex flex-1 items-center gap-3">
              <div className="skeleton size-10 shrink-0 rounded-xl" />
              <div className="grid flex-1 gap-1.5">
                <div className="skeleton h-4 w-48 max-w-[70%] rounded" />
                <div className="skeleton h-3 w-72 max-w-[90%] rounded" />
              </div>
            </div>
            <div className="skeleton h-7 w-20 shrink-0 rounded-pill" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton específico para Órbita Virtual (tarjetas de cursos con banner superior). */
export function AulaCoursesSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Cargando Órbita Virtual">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="skeleton size-12 rounded-2xl" />
          <div className="grid gap-2">
            <div className="skeleton h-3 w-32 rounded-pill" />
            <div className="skeleton h-7 w-56 rounded-xl" />
          </div>
        </div>
        <LunitaLoadingBadge label="Abriendo Órbita Virtual…" />
      </div>

      <div className="card grid divide-y divide-line bg-white p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-2 px-5 py-4">
            <div className="skeleton h-3 w-24 rounded-pill" />
            <div className="skeleton h-7 w-20 rounded-lg" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card overflow-hidden bg-white p-0">
            <div className="skeleton h-12 w-full rounded-none" />
            <div className="grid gap-3 p-5">
              <div className="skeleton h-5 w-40 rounded-lg" />
              <div className="skeleton h-3.5 w-32 rounded" />
              <div className="skeleton mt-1 h-2 w-full rounded-full" />
              <div className="mt-2 flex items-center justify-between border-t border-line/60 pt-3">
                <div className="skeleton h-6 w-20 rounded-pill" />
                <div className="skeleton h-4 w-14 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton específico para vistas tabulares/analíticas de SIGA y Administración. */
export function SigaWorkspaceSkeleton({ label = "Cargando SIGA Lunita…" }: { label?: string }) {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-2">
          <div className="skeleton h-3 w-40 rounded-pill" />
          <div className="skeleton h-8 w-72 rounded-xl" />
        </div>
        <LunitaLoadingBadge label={label} />
      </div>

      {/* Barra de filtros shimmer */}
      <div className="card grid gap-3 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <div className="skeleton h-8 w-28 rounded-lg" />
            <div className="skeleton h-8 w-24 rounded-lg" />
            <div className="skeleton h-8 w-24 rounded-lg" />
          </div>
          <div className="skeleton h-9 w-56 rounded-lg" />
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-line/60 pt-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-7 w-20 rounded-pill" />
          ))}
        </div>
      </div>

      {/* Tabla shimmer */}
      <div className="card overflow-hidden bg-white p-0">
        <div className="border-b border-line bg-[#F6F8FC] px-5 py-3.5">
          <div className="skeleton h-4 w-48 rounded" />
        </div>
        <div className="divide-y divide-line">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="grid w-48 gap-1.5">
                <div className="skeleton h-4 w-40 rounded" />
                <div className="skeleton h-3 w-24 rounded" />
              </div>
              <div className="hidden flex-1 justify-center gap-2 sm:flex">
                {[0, 1, 2, 3, 4, 5].map((c) => (
                  <div key={c} className="skeleton size-7 rounded-lg" />
                ))}
              </div>
              <div className="skeleton h-5 w-24 rounded-pill" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
