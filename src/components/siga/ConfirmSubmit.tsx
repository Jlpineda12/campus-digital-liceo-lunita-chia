"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cx } from "@/components/ui/cx";
import { pillButtonClass, type PillVariant } from "@/components/ui/PillButton";

/**
 * Botón de envío en dos pasos para acciones con impacto (cerrar un periodo):
 * el primer clic pide confirmación; el segundo envía. Se rearma a los 5 s.
 */
export function ConfirmSubmit({
  children,
  confirmLabel,
  variant = "outline",
  className,
}: {
  children: ReactNode;
  confirmLabel: string;
  variant?: PillVariant;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type={armed ? "submit" : "button"}
      onClick={() => {
        if (!armed) setArmed(true);
      }}
      disabled={pending}
      aria-live="polite"
      className={cx(pillButtonClass({ variant: armed ? "red" : variant, size: "sm" }), className)}
    >
      {pending ? "Guardando…" : armed ? confirmLabel : children}
    </button>
  );
}
