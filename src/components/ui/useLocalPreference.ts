"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHANGE_EVENT = "campus-lunita:preference";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // Modo privado sin almacenamiento.
  }
}

/**
 * Preferencia de interfaz guardada en ESTE navegador (vista, filtros, fijados).
 * Nunca datos personales ni académicos: solo cómo prefiere ver las cosas.
 * En el servidor y en la primera pintura devuelve `null` (sin desajuste de hidratación).
 */
export function useLocalPreference(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const setValue = useCallback(
    (next: string | null) => {
      try {
        if (next === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, next);
      } catch {
        // Cuota llena o modo privado: la preferencia simplemente no se recuerda.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );
  return [value, setValue];
}

/** Lista JSON de textos (p. ej. ids fijados o páginas recientes). */
export function parseList<T>(raw: string | null, guard: (v: unknown) => v is T): T[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}
