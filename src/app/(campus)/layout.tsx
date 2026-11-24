import type { ReactNode } from "react";
import { CampusShell } from "@/components/layout/CampusShell";
import { requireSession } from "@/modules/core/auth/guards";
import { getCampusShellData } from "@/modules/core/dashboard/shell";

/** Rutas protegidas del Campus: exigen sesión verificada en servidor. */
export default async function CampusLayout({ children }: { children: ReactNode }) {
  const user = await requireSession();
  const shell = await getCampusShellData(user);
  return <CampusShell shell={shell}>{children}</CampusShell>;
}
