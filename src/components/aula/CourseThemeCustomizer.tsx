"use client";

import { Check, CheckCircle2, ImagePlus, Palette, Save, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import { emitToast } from "@/components/ui/ToastViewport";
import { saveCourseThemeAction, type AulaActionState } from "@/modules/aula/actions";
import {
  ACCENT_TONE_META,
  ACCENT_TONES,
  BANNER_PRESET_LABELS,
  BANNER_PRESETS,
  COURSE_ICON_LABELS,
  COURSE_ICONS,
  type AccentTone,
  type BannerPreset,
  type CourseIconKey,
  type CourseLayoutStyle,
  type CourseThemeConfig,
} from "@/modules/aula/themes";
import type { StheamiPillar } from "@/modules/core/academic-structure/stheami";
import { CourseBanner, CourseEmblemIcon } from "./CourseBanner";

const INITIAL: AulaActionState = { status: "idle" };

/**
 * Estudio visual de personalización del curso para docentes:
 * 14 colores + color personalizado (#RRGGBB accesible), 12 artes SVG de portada,
 * subida privada de imagen propia para el banner, 20 emblemas SVG duotono y mensaje de bienvenida.
 */
export function CourseThemeCustomizer({
  courseAssignmentId,
  subjectName,
  groupName,
  gradeName,
  teacherName,
  periodName,
  pillar,
  initialTheme,
}: {
  courseAssignmentId: string;
  subjectName: string;
  groupName: string;
  gradeName: string;
  teacherName: string | null;
  periodName: string;
  pillar: StheamiPillar;
  initialTheme: CourseThemeConfig;
}) {
  const [open, setOpen] = useState(false);
  const [bannerPreset, setBannerPreset] = useState<BannerPreset>(initialTheme.bannerPreset);
  const [accentTone, setAccentTone] = useState<AccentTone>(initialTheme.accentTone);
  const [customColorHex, setCustomColorHex] = useState<string>(initialTheme.customColorHex ?? "");
  const [iconKey, setIconKey] = useState<CourseIconKey>(initialTheme.iconKey);
  const [layoutStyle, setLayoutStyle] = useState<CourseLayoutStyle>(initialTheme.layoutStyle);
  const [welcomeMessage, setWelcomeMessage] = useState(initialTheme.welcomeMessage);

  // Gestión de imagen propia del banner
  const [removeBannerImage, setRemoveBannerImage] = useState(false);
  const [localBannerPreview, setLocalBannerPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [state, action, pending] = useActionState(saveCourseThemeAction, INITIAL);
  const id = useId();

  useEffect(() => {
    return () => {
      if (localBannerPreview) URL.revokeObjectURL(localBannerPreview);
    };
  }, [localBannerPreview]);

  useEffect(() => {
    if (state.status === "success") {
      emitToast({
        title: "Diseño del curso guardado",
        description: `Se actualizó la portada de ${subjectName}.`,
        tone: "success",
      });
    } else if (state.status === "error" && state.message) {
      emitToast({ title: "No pudimos guardar el diseño", description: state.message, tone: "error" });
    }
  }, [state, subjectName]);

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (localBannerPreview) URL.revokeObjectURL(localBannerPreview);
    if (!file) {
      setLocalBannerPreview(null);
      return;
    }
    setRemoveBannerImage(false);
    setLocalBannerPreview(URL.createObjectURL(file));
  };

  const handleClearBannerImage = () => {
    if (localBannerPreview) URL.revokeObjectURL(localBannerPreview);
    setLocalBannerPreview(null);
    setRemoveBannerImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resolvedPreviewBannerUrl = localBannerPreview
    ? localBannerPreview
    : removeBannerImage
      ? null
      : initialTheme.hasBannerImage
        ? `/api/aula/archivos?tipo=banner&id=${courseAssignmentId}`
        : null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-control border border-white/30 bg-white/15 px-3 py-2 text-xs font-bold text-white backdrop-blur-xs transition-colors hover:bg-white/25"
      >
        <Palette className="size-3.5" aria-hidden />
        Personalizar curso
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/55 p-4 backdrop-blur-xs">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Personalizar apariencia del curso"
        className="card max-h-[92dvh] w-full max-w-3xl overflow-y-auto bg-white p-6 text-ink shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-cobalt" aria-hidden />
            <h2 className="text-base font-bold text-navy">Estudio de portada · {subjectName}</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-semibold text-muted hover:bg-cloud hover:text-navy"
          >
            <X className="size-4" aria-hidden /> Cerrar
          </button>
        </div>

        {/* Vista previa en vivo */}
        <div className="mt-4">
          <p className="mb-2 text-[0.7rem] font-extrabold tracking-wider text-muted uppercase">
            Vista previa en vivo
          </p>
          <CourseBanner
            courseAssignmentId={courseAssignmentId}
            subjectName={subjectName}
            groupName={groupName}
            gradeName={gradeName}
            teacherName={teacherName}
            periodName={periodName}
            pillar={pillar}
            previewBannerUrl={resolvedPreviewBannerUrl}
            theme={{
              bannerPreset,
              accentTone,
              customColorHex: customColorHex || null,
              hasBannerImage: Boolean(resolvedPreviewBannerUrl),
              iconKey,
              layoutStyle,
              welcomeMessage,
            }}
          />
        </div>

        <form action={action} className="mt-5 grid gap-5">
          <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
          <input type="hidden" name="bannerPreset" value={bannerPreset} />
          <input type="hidden" name="accentTone" value={accentTone} />
          <input type="hidden" name="customColorHex" value={customColorHex} />
          <input type="hidden" name="iconKey" value={iconKey} />
          <input type="hidden" name="layoutStyle" value={layoutStyle} />
          <input type="hidden" name="removeBannerImage" value={removeBannerImage ? "1" : "0"} />

          {/* 1. Imagen personalizada para el banner (privada) */}
          <div className="rounded-control border border-dashed border-cobalt/35 bg-cloud/45 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold text-navy">
                  Imagen propia de portada (opcional · PNG, JPG o WebP, máx. 4 MB)
                </p>
                <p className="mt-0.5 text-[0.72rem] text-muted">
                  Sube una foto o ilustración de tu asignatura. Aplicamos un velo automático para mantener lectura clara.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-cobalt/35 bg-white px-3 py-1.5 text-xs font-bold text-cobalt transition-colors hover:bg-cobalt hover:text-white">
                  <ImagePlus className="size-3.5" aria-hidden />
                  {resolvedPreviewBannerUrl ? "Cambiar imagen" : "Subir imagen"}
                  <input
                    ref={fileInputRef}
                    type="file"
                    name="bannerImage"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleBannerFileChange}
                    className="sr-only"
                  />
                </label>
                {resolvedPreviewBannerUrl && (
                  <button
                    type="button"
                    onClick={handleClearBannerImage}
                    className="inline-flex items-center gap-1 rounded-control border border-red-solid/30 bg-white px-2.5 py-1.5 text-xs font-bold text-red-solid hover:bg-red-l/50"
                  >
                    <Trash2 className="size-3.5" aria-hidden /> Quitar foto
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Paleta amplia (14 colores + selector personalizado #RRGGBB) */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="field-label mb-0">Paleta de color (14 tonos + color personalizado)</p>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-pill border border-line-2 bg-white px-2.5 py-1 text-xs font-bold text-navy hover:bg-cloud">
                  <input
                    type="color"
                    value={customColorHex || ACCENT_TONE_META[accentTone].swatch}
                    onChange={(e) => setCustomColorHex(e.target.value.toUpperCase())}
                    aria-label="Elegir color personalizado"
                    className="size-4 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span>{customColorHex ? `Personalizado ${customColorHex}` : "Elegir color libre"}</span>
                </label>
                {customColorHex && (
                  <button
                    type="button"
                    onClick={() => setCustomColorHex("")}
                    className="text-xs font-bold text-cobalt hover:underline"
                  >
                    Usar paleta
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ACCENT_TONES.map((toneKey) => {
                const meta = ACCENT_TONE_META[toneKey];
                const selected = !customColorHex && accentTone === toneKey;
                return (
                  <button
                    key={toneKey}
                    type="button"
                    onClick={() => {
                      setCustomColorHex("");
                      setAccentTone(toneKey);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-bold transition-all ${
                      selected
                        ? "border-navy bg-navy text-white"
                        : "border-line-2 bg-white text-navy hover:bg-cloud"
                    }`}
                  >
                    <span
                      className="grid size-3.5 place-items-center rounded-full ring-1 ring-black/15"
                      style={{ backgroundColor: meta.swatch }}
                    >
                      {selected && <Check className="size-2.5 text-white" aria-hidden />}
                    </span>
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Estilo SVG de fondo (12 artes exclusivos) */}
          <div>
            <p className="field-label">
              Arte SVG de fondo (12 estilos)
              {resolvedPreviewBannerUrl && (
                <span className="ml-1.5 font-normal text-muted">
                  — quita la imagen propia si deseas mostrar el arte SVG
                </span>
              )}
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {BANNER_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBannerPreset(preset)}
                  className={`rounded-control border px-2.5 py-2 text-left text-xs font-bold transition-colors ${
                    bannerPreset === preset
                      ? "border-navy bg-navy text-white"
                      : "border-line-2 bg-white text-navy hover:bg-cloud"
                  }`}
                >
                  {BANNER_PRESET_LABELS[preset]}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Emblema SVG personalizado del curso (20 SVGs duotono) */}
          <div>
            <p className="field-label">Emblema SVG del curso (20 diseños personalizados)</p>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {COURSE_ICONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIconKey(key)}
                  className={`inline-flex items-center gap-2 rounded-control border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    iconKey === key
                      ? "border-navy bg-navy text-white"
                      : "border-line-2 bg-white text-navy hover:bg-cloud"
                  }`}
                >
                  <CourseEmblemIcon
                    iconKey={key}
                    className={`size-4 shrink-0 ${iconKey === key ? "text-yellow" : "text-cobalt"}`}
                  />
                  <span className="truncate">{COURSE_ICON_LABELS[key]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 5. Estilo de vista de unidades */}
          <div>
            <p className="field-label">Cómo se muestran las unidades</p>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setLayoutStyle("cards")}
                className={`rounded-control border px-3.5 py-2.5 text-left text-xs transition-colors ${
                  layoutStyle === "cards"
                    ? "border-navy bg-cloud ring-1 ring-navy"
                    : "border-line-2 bg-white hover:bg-cloud/60"
                }`}
              >
                <span className="block font-bold text-navy">Tarjetas visuales (recomendado)</span>
                <span className="text-muted">Módulos amplios y claros, ideales para guías y tareas.</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutStyle("compact")}
                className={`rounded-control border px-3.5 py-2.5 text-left text-xs transition-colors ${
                  layoutStyle === "compact"
                    ? "border-navy bg-cloud ring-1 ring-navy"
                    : "border-line-2 bg-white hover:bg-cloud/60"
                }`}
              >
                <span className="block font-bold text-navy">Académico compacto</span>
                <span className="text-muted">Lista continua desplegable para cursos con muchos módulos.</span>
              </button>
            </div>
          </div>

          {/* 6. Mensaje de bienvenida */}
          <div>
            <label htmlFor={`${id}-welcome`} className="field-label">
              Mensaje de bienvenida en portada (opcional)
            </label>
            <textarea
              id={`${id}-welcome`}
              name="welcomeMessage"
              rows={2}
              maxLength={240}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Ej. ¡Bienvenidos! Cada semana publicaremos la guía PDF y el reto práctico del periodo."
              className="input min-h-16 resize-y py-2 text-sm font-normal"
            />
          </div>

          {state.message && (
            <p
              role={state.status === "error" ? "alert" : "status"}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                state.status === "error" ? "text-red-solid" : "text-green-solid"
              }`}
            >
              {state.status === "success" && <CheckCircle2 className="size-4" aria-hidden />}
              {state.message}
            </p>
          )}

          <div className="sticky bottom-0 -mx-6 -mb-6 mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-white/95 px-6 py-3.5 backdrop-blur-xs">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={pillButtonClass({ variant: "outline", size: "sm" })}
            >
              Cerrar
            </button>
            <button type="submit" disabled={pending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
              <Save aria-hidden /> {pending ? "Guardando…" : "Guardar diseño"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
