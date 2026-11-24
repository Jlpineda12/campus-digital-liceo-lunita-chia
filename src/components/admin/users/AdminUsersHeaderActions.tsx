"use client";

import { FileSpreadsheet, UserPlus } from "lucide-react";
import { useState } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import { BulkImportDrawer } from "./BulkImportDrawer";
import { CreateUserDrawer } from "./CreateUserDrawer";

/**
 * Controla los paneles plegables de `Carga masiva (Excel)` y `Nuevo usuario`
 * para que los botones queden alineados en cabecera y el panel activo se despliegue
 * a ancho completo debajo sin deformar la barra superior.
 */
export function AdminUsersHeaderActions() {
  const [mode, setMode] = useState<"none" | "bulk" | "single">("none");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode((m) => (m === "bulk" ? "none" : "bulk"))}
          className={pillButtonClass({ variant: mode === "bulk" ? "navy" : "outline", size: "sm" })}
        >
          <FileSpreadsheet aria-hidden /> Carga masiva (Excel)
        </button>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "single" ? "none" : "single"))}
          className={pillButtonClass({ variant: mode === "single" ? "outline" : "navy", size: "sm" })}
        >
          <UserPlus aria-hidden /> Nuevo usuario
        </button>
      </div>

      {mode === "bulk" && <BulkImportDrawer defaultOpen onClose={() => setMode("none")} />}
      {mode === "single" && <CreateUserDrawer defaultOpen onClose={() => setMode("none")} />}
    </div>
  );
}
