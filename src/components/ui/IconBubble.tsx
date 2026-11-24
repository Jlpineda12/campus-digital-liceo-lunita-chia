import type { ReactNode } from "react";
import type { Tone } from "@/modules/core/auth/roles";
import { cx, toneClass } from "./cx";

interface IconBubbleProps {
  tone?: Tone;
  size?: "md" | "sm";
  /** Si el icono transmite información, descríbela; si es decorativo, omítelo. */
  label?: string;
  className?: string;
  children: ReactNode;
}

/** Burbuja de icono (SISTEMA_DISENO.md §4.C): 52px (o 40px en `sm`) en el tono claro. */
export function IconBubble({ tone = "sky", size = "md", label, className, children }: IconBubbleProps) {
  return (
    <span
      className={cx("icon-bubble", size === "sm" && "icon-bubble-sm", toneClass(tone), className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </span>
  );
}
