import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

export type PillVariant =
  | "yellow"
  | "blue"
  | "sky"
  | "green"
  | "purple"
  | "orange"
  | "red"
  | "navy"
  | "outline";

interface PillCommonProps {
  variant?: PillVariant;
  size?: "md" | "sm";
  block?: boolean;
  className?: string;
  children: ReactNode;
}

type PillAsButtonProps = PillCommonProps &
  Omit<ComponentProps<"button">, keyof PillCommonProps> & { href?: undefined };

type PillAsLinkProps = PillCommonProps &
  Omit<ComponentProps<typeof Link>, keyof PillCommonProps>;

export type PillButtonProps = PillAsButtonProps | PillAsLinkProps;

export function pillButtonClass({
  variant = "yellow",
  size = "md",
  block = false,
  className,
}: Pick<PillCommonProps, "variant" | "size" | "block" | "className">): string {
  return cx(
    "btn",
    variant !== "yellow" && `btn-${variant}`,
    size === "sm" && "btn-sm",
    block && "btn-block",
    className,
  );
}

function isLinkProps(props: PillButtonProps): props is PillAsLinkProps {
  return props.href !== undefined;
}

/**
 * Botón píldora 3D (SISTEMA_DISENO.md §4.A): labio inferior de 4px que se
 * hunde al presionar. Con `href` se renderiza como enlace de Next.
 */
export function PillButton(props: PillButtonProps) {
  if (isLinkProps(props)) {
    const { variant, size, block, className, children, ...linkProps } = props;
    return (
      <Link {...linkProps} className={pillButtonClass({ variant, size, block, className })}>
        {children}
      </Link>
    );
  }

  const { variant, size, block, className, children, type = "button", ...buttonProps } = props;
  return (
    <button
      {...buttonProps}
      type={type}
      className={pillButtonClass({ variant, size, block, className })}
    >
      {children}
    </button>
  );
}
