import Link from "next/link";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import type { Tone } from "@/modules/core/auth/roles";
import { cx, toneClass } from "./cx";

interface TactileCardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article" | "li" | "aside";
  tone?: Tone;
  /** Tarjeta destacada: radio de 32px. */
  featured?: boolean;
  children: ReactNode;
}

/**
 * Tarjeta táctil (SISTEMA_DISENO.md §4.B): borde de 2px con labio inferior de 5px.
 */
export function TactileCard({
  as: Tag = "div",
  tone,
  featured = false,
  className,
  children,
  ...rest
}: TactileCardProps) {
  return (
    <Tag {...rest} className={cx("card", featured && "card-lg", tone && toneClass(tone), className)}>
      {children}
    </Tag>
  );
}

type TactileCardLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  tone?: Tone;
  featured?: boolean;
  className?: string;
  children: ReactNode;
};

/** Tarjeta interactiva: se eleva al pasar el cursor y se hunde al presionar. */
export function TactileCardLink({
  tone,
  featured = false,
  className,
  children,
  ...linkProps
}: TactileCardLinkProps) {
  return (
    <Link
      {...linkProps}
      className={cx(
        "card card-interactive",
        featured && "card-lg",
        tone && toneClass(tone),
        className,
      )}
    >
      {children}
    </Link>
  );
}
