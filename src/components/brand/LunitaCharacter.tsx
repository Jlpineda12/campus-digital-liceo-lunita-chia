"use client";

import { useEffect, useId, useImperativeHandle, useMemo, useRef, type CSSProperties, type Ref } from "react";
import { cx } from "@/components/ui/cx";
import { LUNITA_SVG_INNER, LUNITA_VIEWBOX, LUNITA_VIEWBOX_COMPACT } from "./lunita-svg";
import "./lunita.css";

/** Animaciones disponibles (mismas del sitio web) y su duración antes de volver al reposo. */
export type LunitaAnim = "idle" | "intro" | "hello" | "hop" | "party";
const DURATIONS: Partial<Record<LunitaAnim, number>> = { intro: 1950, hello: 1250, hop: 1000 };

/** Evento global para animar a Lunita desde otros componentes (p. ej. el login). */
export const LUNITA_EVENT = "lunita:play";
export function playLunita(anim: LunitaAnim | "tap") {
  window.dispatchEvent(new CustomEvent(LUNITA_EVENT, { detail: anim }));
}

export interface LunitaController {
  play: (anim: LunitaAnim) => void;
  /** Salto corto, como cuando se toca el personaje. */
  tap: () => void;
  /** Celebración continua (true) o volver al reposo (false). */
  celebrate: (on: boolean) => void;
}

interface LunitaCharacterProps {
  /** Tamaño en px o cualquier longitud CSS. */
  size?: number | string;
  /** Entra dibujándose al montarse. */
  intro?: boolean;
  /** Inclina la cabeza siguiendo el cursor (solo con mouse). */
  track?: boolean;
  /** Decorativo: se oculta a lectores de pantalla. */
  decorative?: boolean;
  /** Encuadre ajustado y sin destellos: para usarla como logo. */
  compact?: boolean;
  /** Responde a `playLunita()` (solo una instancia por pantalla debería escuchar). */
  listen?: boolean;
  label?: string;
  className?: string;
  controllerRef?: Ref<LunitaController>;
}

/**
 * Lunita, la mascota del Liceo (portada del sitio web en Astro): luna dentro del
 * óvalo institucional con destellos. Se dibuja al entrar, saluda al pasar el
 * cursor, salta al tocarla y sigue el cursor. Respeta `prefers-reduced-motion`.
 */
export function LunitaCharacter({
  size = 220,
  intro = true,
  track = true,
  decorative = false,
  compact = false,
  listen = false,
  label = "Lunita, la mascota del Liceo Lunita de Chía",
  className,
  controllerRef,
}: LunitaCharacterProps) {
  const rawId = useId();
  const uid = `lun${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const html = useMemo(() => LUNITA_SVG_INNER.replaceAll("__LID__", uid), [uid]);

  const controller = useMemo<LunitaController>(() => {
    const reduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const play = (anim: LunitaAnim, back: LunitaAnim = "idle") => {
      const svg = svgRef.current;
      if (!svg) return;
      clearTimeout(timer.current);
      svg.dataset.anim = "none";
      svg.getBoundingClientRect(); // reinicia la animación CSS
      svg.dataset.anim = anim;
      const duration = DURATIONS[anim];
      if (duration) timer.current = setTimeout(() => (svg.dataset.anim = back), duration);
    };
    const busy = () => ["intro", "none"].includes(svgRef.current?.dataset.anim ?? "");
    return {
      play: (anim) => {
        if (!reduced()) play(anim);
      },
      tap: () => {
        if (!reduced() && !busy()) play("hop");
      },
      celebrate: (on) => {
        if (!reduced()) play(on ? "party" : "idle");
      },
    };
  }, []);

  useImperativeHandle(controllerRef, () => controller, [controller]);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onEnter = () => {
      if (svg.dataset.anim === "idle") controller.play("hello");
    };
    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("click", controller.tap);

    // Pausa las animaciones cuando el personaje no está en pantalla.
    const visibility = new IntersectionObserver(
      ([entry]) => root.toggleAttribute("data-off", !entry?.isIntersecting),
      { rootMargin: "120px" },
    );
    visibility.observe(root);

    let frame = 0;
    if (intro) {
      if (reduced) root.setAttribute("data-played", "");
      else {
        svg.dataset.anim = "none";
        frame = requestAnimationFrame(() => {
          root.setAttribute("data-played", "");
          controller.play("intro");
        });
      }
    }

    // Seguimiento del cursor: inclina la cabeza hacia el puntero (solo mouse).
    let pointerX = 0;
    let raf = 0;
    const tilt = () => {
      raf = 0;
      const rect = root.getBoundingClientRect();
      if (rect.width === 0 || rect.bottom < 0 || rect.top > innerHeight) return;
      const n = Math.max(-1, Math.min(1, (pointerX - (rect.left + rect.width / 2)) / Math.max(320, innerWidth * 0.4)));
      root.style.setProperty("--tilt", `${(n * 5).toFixed(2)}deg`);
    };
    const onMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      raf ||= requestAnimationFrame(tilt);
    };
    const tracking = track && !reduced && matchMedia("(pointer: fine)").matches;
    if (tracking) addEventListener("pointermove", onMove, { passive: true });

    const onPlay = (event: Event) => {
      const anim = (event as CustomEvent<LunitaAnim | "tap">).detail;
      if (anim === "tap") controller.tap();
      else controller.play(anim);
    };
    if (listen) addEventListener(LUNITA_EVENT, onPlay);

    return () => {
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("click", controller.tap);
      visibility.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(raf);
      clearTimeout(timer.current);
      if (tracking) removeEventListener("pointermove", onMove);
      if (listen) removeEventListener(LUNITA_EVENT, onPlay);
    };
  }, [controller, intro, track, listen]);

  return (
    <div
      ref={rootRef}
      className={cx("lunita lunita--hola", compact && "lunita--compact", className)}
      style={{ "--s": typeof size === "number" ? `${size}px` : size } as CSSProperties}
      data-lunita=""
      data-base="idle"
      data-intro={intro ? "" : undefined}
      data-track={track ? "" : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      <svg
        ref={svgRef}
        className="lun-svg"
        viewBox={compact ? LUNITA_VIEWBOX_COMPACT : LUNITA_VIEWBOX}
        data-anim="idle"
        style={{ "--clip": `url(#${uid}-win)` } as CSSProperties}
        aria-hidden="true"
        // SVG estático del colegio (lunita-svg.ts); no contiene datos de usuarios.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
