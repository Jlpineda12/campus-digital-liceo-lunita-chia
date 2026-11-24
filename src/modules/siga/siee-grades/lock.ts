/**
 * Candado de periodos (REGLAS.md §2.3, docs/secciones/05 §3). Archivo puro.
 * Un periodo cerrado solo se puede editar dentro de una ventana temporal vigente,
 * abierta por Coordinación/Rectoría para todo el periodo o para una carga.
 */
export interface UnlockWindowLike {
  id: string;
  courseAssignmentId: string | null;
  opensAt: Date;
  expiresAt: Date;
  closedAt: Date | null;
}

export type PeriodEditState =
  | { editable: true; via: "open" }
  | { editable: true; via: "window"; window: UnlockWindowLike }
  | { editable: false; via: "locked" };

export function activeUnlockWindow<W extends UnlockWindowLike>(
  windows: readonly W[],
  courseAssignmentId: string,
  now: Date = new Date(),
): W | undefined {
  return windows.find(
    (w) =>
      w.closedAt === null &&
      w.opensAt <= now &&
      now < w.expiresAt &&
      (w.courseAssignmentId === null || w.courseAssignmentId === courseAssignmentId),
  );
}

export function getPeriodEditState(
  period: { gradesLocked: boolean },
  windows: readonly UnlockWindowLike[],
  courseAssignmentId: string,
  now: Date = new Date(),
): PeriodEditState {
  if (!period.gradesLocked) return { editable: true, via: "open" };
  const window = activeUnlockWindow(windows, courseAssignmentId, now);
  return window ? { editable: true, via: "window", window } : { editable: false, via: "locked" };
}
