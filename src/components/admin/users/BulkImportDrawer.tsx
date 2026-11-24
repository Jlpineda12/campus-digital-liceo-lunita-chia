"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  KeyRound,
  Upload,
  X,
} from "lucide-react";
import { useActionState, useId, useState } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import {
  bulkImportUsersAction,
  type BulkImportState,
  type GeneratedCredential,
} from "@/modules/core/users/actions";

const INITIAL: BulkImportState = {
  status: "idle",
  created: [],
  skipped: [],
  errors: [],
};

function escapeCsvCell(value: string): string {
  const safe = value.replaceAll('"', '""');
  return /[;"\n\r]/.test(safe) ? `"${safe}"` : safe;
}

/** Genera y descarga el archivo CSV con BOM UTF-8 (abre tildes directo en Excel). */
function downloadCredentialsCsv(rows: GeneratedCredential[]) {
  const header = [
    "Nombre completo",
    "Rol",
    "Tipo doc.",
    "Documento (usuario)",
    "Correo institucional",
    "Contraseña inicial",
    "Grupo",
    "Acudiente vinculado",
  ];
  const lines = [
    header.join(";"),
    ...rows.map((r) =>
      [
        r.fullName,
        r.roleLabel,
        r.documentType,
        r.documentNumber,
        r.email,
        r.initialPassword,
        r.groupName ?? "",
        r.guardianLinked ? "Sí" : "No",
      ]
        .map(escapeCsvCell)
        .join(";"),
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `credenciales-campus-lunita-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Panel plegable para carga masiva de usuarios por Excel/CSV y entrega de credenciales. */
export function BulkImportDrawer({
  defaultOpen = false,
  onClose,
}: {
  defaultOpen?: boolean;
  onClose?: () => void;
} = {}) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, action, pending] = useActionState(bulkImportUsersAction, INITIAL);
  const id = useId();

  function closePanel() {
    setOpen(false);
    onClose?.();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={pillButtonClass({ variant: "outline", size: "sm" })}
      >
        <FileSpreadsheet aria-hidden /> Carga masiva (Excel)
      </button>
    );
  }

  return (
    <section
      aria-label="Carga masiva de usuarios desde Excel o CSV"
      className="card grid gap-5 border-cobalt/25 bg-white"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-cobalt" aria-hidden />
            <h2 className="text-base font-bold text-navy">Carga masiva por Excel / CSV + Credenciales</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Importa hasta 1.500 cuentas en un solo paso. La plataforma genera correo institucional y contraseña
            personalizada (<code className="font-mono font-bold text-navy">LLC-Iniciales+Doc-XX</code>).
          </p>
        </div>
        <button
          type="button"
          onClick={closePanel}
          className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-semibold text-muted hover:bg-cloud hover:text-navy"
        >
          <X className="size-4" aria-hidden /> Cerrar
        </button>
      </div>

      {/* Paso 1: Descargar plantilla */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-cloud/65 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-navy">1. Descarga la plantilla institucional</p>
          <p className="text-xs text-muted">
            Incluye ejemplos de Acudiente, Estudiante (con matrícula automática a grupo y vínculo familiar) y Docente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/admin/usuarios/plantilla?formato=xlsx"
            className={pillButtonClass({ variant: "navy", size: "sm" })}
          >
            <Download aria-hidden /> Plantilla Excel (.xlsx)
          </a>
          <a
            href="/api/admin/usuarios/plantilla?formato=csv"
            className={pillButtonClass({ variant: "outline", size: "sm" })}
          >
            <Download aria-hidden /> CSV (.csv)
          </a>
        </div>
      </div>

      {/* Paso 2: Subir archivo */}
      <form action={action} className="grid gap-3.5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label htmlFor={`${id}-file`} className="field-label">
              2. Sube el archivo diligenciado (.xlsx o .csv, máx. 5 MB)
            </label>
            <input
              id={`${id}-file`}
              name="file"
              type="file"
              required
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="input min-h-11 py-2 text-sm font-medium file:mr-3 file:rounded-md file:border-0 file:bg-cloud file:px-3 file:py-1 file:text-xs file:font-bold file:text-navy"
            />
          </div>
          <button type="submit" disabled={pending} className={pillButtonClass({ variant: "navy" })}>
            <Upload aria-hidden />
            {pending ? "Procesando archivo…" : "Importar y generar credenciales"}
          </button>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink-2">
          <input type="checkbox" name="skipExisting" defaultChecked className="size-4 accent-navy" />
          Omitir documentos que ya existan en la plataforma (recomendado para re-subir listados actualizados)
        </label>
      </form>

      {/* Paso 3: Resultados y credenciales generadas (visibles una sola vez) */}
      {state.message && (
        <div
          role={state.status === "error" ? "alert" : "status"}
          className={`flex items-start gap-2.5 rounded-control border px-4 py-3 text-sm font-semibold ${
            state.status === "error"
              ? "border-red/40 bg-red-l/60 text-red-solid"
              : "border-green/40 bg-green-l/65 text-green-solid"
          }`}
        >
          {state.status === "error" ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <span>{state.message}</span>
        </div>
      )}

      {state.created.length > 0 && (
        <div className="grid gap-3 rounded-control border border-cobalt/20 bg-cloud/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-extrabold text-navy">
                <KeyRound className="size-4 text-cobalt" aria-hidden />
                Credenciales generadas ({state.created.length}) — descarga única
              </p>
              <p className="text-xs text-muted">
                Por seguridad las contraseñas iniciales no se guardan en texto plano. Descárgalas ahora para entregarlas
                a las familias y docentes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadCredentialsCsv(state.created)}
              className={pillButtonClass({ variant: "navy", size: "sm" })}
            >
              <Download aria-hidden /> Descargar credenciales (Excel CSV)
            </button>
          </div>

          <div className="max-h-72 overflow-auto rounded-control border border-line bg-white">
            <table className="tactile-table text-xs">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Documento</th>
                  <th scope="col">Correo generado</th>
                  <th scope="col">Contraseña inicial</th>
                </tr>
              </thead>
              <tbody>
                {state.created.map((c) => (
                  <tr key={c.documentNumber}>
                    <td className="font-bold text-navy">
                      {c.fullName}
                      {c.groupName && <span className="ml-1.5 text-muted">({c.groupName})</span>}
                    </td>
                    <td>{c.roleLabel}</td>
                    <td className="whitespace-nowrap tabular">
                      {c.documentType} {c.documentNumber}
                    </td>
                    <td className="font-mono text-[0.72rem] text-ink-2">{c.email}</td>
                    <td className="font-mono font-extrabold whitespace-nowrap text-cobalt">
                      {c.initialPassword}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {state.skipped.length > 0 && (
        <details className="rounded-control border border-line bg-bg-2/60 px-3.5 py-2.5 text-xs">
          <summary className="cursor-pointer font-bold text-navy">
            {state.skipped.length} fila(s) omitida(s) porque el documento ya existía
          </summary>
          <ul className="mt-2 grid gap-1 text-muted">
            {state.skipped.slice(0, 30).map((s) => (
              <li key={`${s.rowNumber}-${s.documentNumber}`}>
                Fila {s.rowNumber}: Doc. {s.documentNumber} — {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {state.errors.length > 0 && (
        <details open className="rounded-control border border-red/30 bg-red-l/40 px-3.5 py-2.5 text-xs">
          <summary className="cursor-pointer font-bold text-red-solid">
            {state.errors.length} fila(s) con error de formato
          </summary>
          <ul className="mt-2 grid gap-1 text-ink-2">
            {state.errors.slice(0, 30).map((e, i) => (
              <li key={i}>
                <strong>Fila {e.rowNumber}:</strong> {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
