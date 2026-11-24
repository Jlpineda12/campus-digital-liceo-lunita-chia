import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { LunitaEmblem } from "@/components/ui/LunitaEmblem";

/** Marco de las páginas públicas del contrato con el sitio Astro. */
export function PublicFrame({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  const width = narrow ? "max-w-lg" : "max-w-3xl";
  return (
    <div className="block-navy min-h-dvh">
      <div className="muisca muisca-thin" aria-hidden />
      <header className={cx("mx-auto flex w-full items-center gap-3 px-5 pt-8", width)}>
        <LunitaEmblem size={40} />
        <div className="leading-tight">
          <p className="text-xs font-extrabold tracking-wider text-yellow uppercase">Campus Digital</p>
          <p className="font-extrabold text-white">Liceo Lunita de Chía</p>
        </div>
      </header>
      <main className={cx("mx-auto w-full px-5 py-10", width)}>{children}</main>
      <footer className={cx("mx-auto w-full px-5 pb-10 text-sm text-white/80", width)}>
        <Link href="/login" className="font-extrabold text-yellow no-underline hover:underline">
          Ingresar al Campus
        </Link>
      </footer>
    </div>
  );
}
