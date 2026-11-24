import type { Tone } from "@/modules/core/auth/roles";
import { cx, toneClass } from "./cx";

/**
 * Avatar circular del Campus: muestra foto real privada cuando existe y,
 * si no, cae limpiamente a iniciales con contraste AA sobre el tono del rol.
 */
export function Avatar({
  initials,
  src,
  alt = "",
  tone,
  size = "md",
  className,
}: {
  initials: string;
  src?: string | null;
  alt?: string;
  tone?: Tone;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClass =
    size === "sm"
      ? "size-8 text-xs"
      : size === "lg"
        ? "avatar-lg"
        : size === "xl"
          ? "size-20 text-2xl"
          : undefined;

  if (src) {
    return (
      <span
        className={cx(
          "avatar overflow-hidden bg-cloud p-0 shadow-none outline-1 -outline-offset-1 outline-black/10",
          sizeClass,
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cx("avatar", sizeClass, tone && toneClass(tone), className)}
    >
      {initials}
    </span>
  );
}
