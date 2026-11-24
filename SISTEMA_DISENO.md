# Sistema de Diseño Dual — Campus Digital Liceo Lunita de Chía

Este documento define el **Sistema de Diseño Unificado con Doble Registro Visual (`data-stage`)** del **Campus Digital (SIGA + Aula Virtual + Matrículas)**.

Conserva el ADN de marca extraído del sitio web en Astro ([jlpineda12.github.io/prototipo-pagina-web-liceo-lunita-de-chia](https://jlpineda12.github.io/prototipo-pagina-web-liceo-lunita-de-chia/)) —`--navy`, `--cobalt`, `--yellow` y los 7 pilares **STHEAMI**— pero adapta la **geometría, tipografía, densidad y tono visual** según la etapa escolar del estudiante y el rol del usuario:

1. **`data-stage="primaria"` (Preescolar y Primaria — Prejardín a 5°):** Estilo **infantil, lúdico y táctil 3D**, cercano a la experiencia del sitio web Astro (tarjetas redondeadas con labio inferior, mascota Lunita, insignias planetarias grandes y lenguaje motivador).
2. **`data-stage="bachillerato"` (Bachillerato — 6° a 11°):** Estilo **serio, editorial y académico moderno**, limpio y sobrio (bordes finos, radios precisos, alta legibilidad de datos/promedios/fechas, acentos STHEAMI discretos y sin elementos infantiles).
3. **`data-stage="institucional"` (Docentes, Coordinación, Secretaría y marco general de Acudientes):** Estilo **profesional de alta productividad**, optimizado para planillas SIEE tipo hoja de cálculo, llamado a lista rápido y gestión de más de 600 personas.

---

## 1. Regla de Selección Automática de `data-stage`

El atributo `data-stage` se calcula **siempre en el servidor** (en `getCampusShellData`) y se aplica en el contenedor raíz de `CampusShell`:

| Rol en sesión | Nivel escolar asociado | `data-stage` del marco (`CampusShell`) | `data-stage` del panel del estudiante |
| :--- | :--- | :--- | :--- |
| `STUDENT` | `PREESCOLAR` o `PRIMARIA` | `primaria` | `primaria` |
| `STUDENT` | `BACHILLERATO` | `bachillerato` | `bachillerato` |
| `GUARDIAN` | Hijo seleccionado en `PREESCOLAR`/`PRIMARIA` | `institucional` | `primaria` (en el bloque académico del hijo) |
| `GUARDIAN` | Hijo seleccionado en `BACHILLERATO` | `institucional` | `bachillerato` (en el bloque académico del hijo) |
| `TEACHER`, `COORDINATOR`, `ADMIN` | Todos | `institucional` | `institucional` |

> **Regla clave:** Nunca se duplican componentes (`PrimaryCard` vs `HighSchoolCard`). Todos los componentes (`Card`, `Button`, `Badge`, `Table`, `Hero`) consumen **CSS Custom Properties** que cambian automáticamente bajo `[data-stage="primaria"]`, `[data-stage="bachillerato"]` y `[data-stage="institucional"]`.

---

## 2. Paleta de Colores Base + Tokens Accesibles WCAG 2.2 AA

> [!IMPORTANT]
> **Regla obligatoria de contraste (Auditoría Fase 1):** Ningún texto normal puede tener un contraste inferior a **4.5:1** (ni texto grande/iconos funcionales inferior a **3:1**). **Queda prohibido usar texto blanco `#ffffff` sobre los tonos brillantes puros** `--green` (`#58cc02`), `--sky` (`#1cb0f6`), `--orange` (`#ff9600`), `--purple` (`#ce82ff`) o `--red` (`#ff4b4b`). Para texto blanco sobre relleno sólido deben usarse los tokens `-solid` (oscurecidos a ≥ 4.5:1) o usar texto `--navy` (`#0f1747`) sobre el relleno brillante.

```css
:root {
  /* Marca Institucional (compartida en todas las etapas) */
  --yellow: #ffc800;
  --yellow-d: #e5a400;
  --yellow-l: #fff4c2;

  --blue: #303296;
  --blue-d: #22246f;
  --blue-l: #e7e8fb;
  --cobalt: #303296;
  --cobalt-d: #22246f;

  --navy: #0f1747;
  --navy-d: #070c2e;
  --lilac: #e7e3ff;

  /* Paleta Semántica STHEAMI (decorativa / bordes / fondos suaves) */
  --sky: #1cb0f6;
  --sky-d: #1899d6;
  --sky-l: #ddf4ff;
  --sky-solid: #0369a1;      /* Contraste >= 5.7:1 con #fff */

  --green: #58cc02;
  --green-d: #46a302;
  --green-l: #e5f8d4;
  --green-solid: #2f7d00;    /* Contraste >= 5.1:1 con #fff */

  --orange: #ff9600;
  --orange-d: #e08600;
  --orange-l: #fff0db;
  --orange-solid: #b45309;   /* Contraste >= 5.0:1 con #fff */

  --purple: #ce82ff;
  --purple-d: #a568cc;
  --purple-l: #f6e9ff;
  --purple-solid: #6d28d9;   /* Contraste >= 6.9:1 con #fff */

  --red: #ff4b4b;
  --red-d: #ea2b2b;
  --red-l: #ffe3e3;
  --red-solid: #c81e1e;      /* Contraste >= 5.6:1 con #fff */

  --pink: #ff86d0;
  --pink-l: #ffe6f5;
  --pink-solid: #be185d;     /* Contraste >= 5.8:1 con #fff */

  /* Superficies y Texto Accesibles (corregidos en Auditoría Fase 1) */
  --bg: #ffffff;
  --bg-2: #f7f8fb;
  --cloud: #f4f8ff;

  --ink: #1e2436;
  --ink-2: #364152;
  --muted: #525c70;          /* Contraste >= 6.4:1 sobre #fff y >= 5.9:1 sobre #f7f8fb */
  --placeholder: #647084;    /* Contraste >= 4.9:1 sobre #fff */

  --line: #e2e8f0;
  --line-2: #cbd5e1;

  /* Tipografías */
  --font-playful: "Nunito Variable", ui-rounded, "SF Pro Rounded", system-ui, sans-serif;
  --font-pro: "Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

---

## 3. Comparativa Exacta de Tokens: Primaria vs. Bachillerato vs. Institucional

| Dimensión | `data-stage="primaria"` (Preescolar y 1°–5°) | `data-stage="bachillerato"` (6°–11°) | `data-stage="institucional"` (Docentes, Padres marco, Admin) |
| :--- | :--- | :--- | :--- |
| **Personalidad visual** | Lúdica, cálida, táctil 3D, cercana al niño. | Seria, académica moderna, sobria y enfocada en logros/ICFES. | Profesional, precisa, alta densidad de datos. |
| **Tipografía (`--font`)** | `Nunito Variable` (redondeada, amigable). | `Inter Variable` (cuerpo y títulos limpios, `tabular-nums`). | `Inter Variable` (`tabular-nums` en planillas y reportes). |
| **Pesos de títulos** | `font-weight: 900`, `letter-spacing: -0.03em`. | `font-weight: 700`, `letter-spacing: -0.02em`. | `font-weight: 700`, `letter-spacing: -0.015em`. |
| **Fondo de página** | `#ffffff` con bloques suaves `--cloud`. | `#f8fafc` (canvas neutro serio) + tarjetas `#ffffff`. | `#f8fafc` + paneles blancos con separación limpia. |
| **Tarjetas (`.card`)** | Radio `24px–32px`, borde `2px`, **labio 3D inferior `5px`**. | Radio `12px`, borde `1px solid #e2e8f0`, **sombra plana sutil `0 1px 2px rgb(15 23 71 / 0.06)`** (sin labio 3D). | Radio `10px`, borde `1px solid #e2e8f0`, sombra mínima, padding compacto. |
| **Botones (`.btn`)** | Píldora (`999px`), mayúsculas, **labio 3D `0 4px 0` que se hunde al pulsar**. | Radio `10px`, *Sentence case* (sin mayúsculas gritonas), plano con hover nítido y foco claro (sin labio 3D). | Radio `8px`, *Sentence case*, compacto (`38px–42px`), atajos de teclado visibles. |
| **Sidebar y Hero** | `--navy` con fondo estrellado cósmico, mascota **Lunita** animada, cenefa Muisca. | `--navy` sólido limpio (sin estrellas flotantes ni animación `bob`), encabezado compacto con KPIs. | `--navy` sólido sobrio, navegación agrupada, sin bloques decorativos que roben altura. |
| **Uso de colores STHEAMI** | Insignias planetarias grandes (`32px–44px`) con relieve 3D + tarjetas tintadas por pilar. | Barra lateral fina (`3px`) o *dot*/chip discreto con el color del pilar + letra limpia sin relieve 3D. | Chip compacto con letra + nombre del pilar en tablas y filtros. |
| **Movimiento** | Rebote sutil (`--spring`), `animate-pop-in` suave (respetando `prefers-reduced-motion`). | Transiciones secas y rápidas (`150ms ease-out`), sin rebotes ni flotación. | Transiciones inmediatas (`120ms ease-out`), prioridad a respuesta instantánea. |
| **Microcopy / Tono** | Cercano y motivador (*"¡Hola, Tomás! Tus misiones de hoy"*). | Directo y maduro (*"Hola, Sofía · 7A · Resumen del periodo"*). | Operativo y preciso (*"Planilla SIEE · Periodo 4 · 28 estudiantes"*). |

### Variables CSS por Etapa (para implementar en `src/app/globals.css`)

```css
[data-stage="primaria"] {
  --font-ui: var(--font-playful);
  --surface-canvas: #ffffff;
  --r-card: 24px;
  --r-card-lg: 32px;
  --r-btn: 999px;
  --r-control: 14px;
  --card-border-w: 2px;
  --card-border-b: 5px;
  --card-shadow: none;
  --btn-shadow-y: 4px;
  --btn-transform-case: uppercase;
  --heading-weight: 900;
  --show-stars: 1;
  --show-mascot: 1;
}

[data-stage="bachillerato"],
[data-stage="institucional"] {
  --font-ui: var(--font-pro);
  --surface-canvas: #f8fafc;
  --r-card: 12px;
  --r-card-lg: 16px;
  --r-btn: 10px;
  --r-control: 8px;
  --card-border-w: 1px;
  --card-border-b: 1px;
  --card-shadow: 0 1px 2px rgb(15 23 71 / 0.06);
  --btn-shadow-y: 0px;
  --btn-transform-case: none;
  --heading-weight: 700;
  --show-stars: 0;
  --show-mascot: 0;
}

[data-stage="institucional"] {
  --r-card: 10px;
  --r-btn: 8px;
}
```

---

## 4. Asignación de Color por Rol, Pilares STHEAMI y Escala SIEE

### A. Temas por Rol de Usuario
| Rol | Color de acento | Fondo suave (`--l`) | Texto accesible sobre relleno sólido |
| :--- | :--- | :--- | :--- |
| **Estudiante** | `--sky` (`#1cb0f6`) / `--sky-solid` (`#0369a1`) | `--sky-l` (`#ddf4ff`) | `#ffffff` sobre `--sky-solid`, o `--navy` sobre `--sky-l` |
| **Padre / Acudiente** | `--green` (`#58cc02`) / `--green-solid` (`#2f7d00`) | `--green-l` (`#e5f8d4`) | `#ffffff` sobre `--green-solid`, o `--navy` sobre `--green-l` |
| **Docente** | `--purple` (`#ce82ff`) / `--purple-solid` (`#6d28d9`) | `--purple-l` (`#f6e9ff`) | `#ffffff` sobre `--purple-solid`, o `--navy` sobre `--purple-l` |
| **Coordinación / Secretaría** | `--yellow` (`#ffc800`) / `--navy` (`#0f1747`) | `--yellow-l` (`#fff4c2`) | `--navy` sobre `--yellow` (ratio 12.6:1) |

### B. Pilares STHEAMI
- **`S` Ciencia:** `--sky` (`#1cb0f6`) / `--sky-solid` (`#0369a1`)
- **`T` Tecnología:** `--purple` (`#ce82ff`) / `--purple-solid` (`#6d28d9`)
- **`H` Humanidades:** `--orange` (`#ff9600`) / `--orange-solid` (`#b45309`)
- **`E` Ingeniería:** `--green` (`#58cc02`) / `--green-solid` (`#2f7d00`)
- **`A` Artes:** `--pink` (`#ff86d0`) / `--pink-solid` (`#be185d`)
- **`M` Matemáticas:** `--yellow` (`#ffc800`) con texto `--navy`
- **`I` Inclusión:** `--red` (`#ff4b4b`) / `--red-solid` (`#c81e1e`)

### C. Escala de Valoración SIEE (con icono + etiqueta + color, nunca solo color)
- **Superior (`4.6 – 5.0`):** fondo `--green-l`, texto `--green-solid`
- **Alto (`4.0 – 4.5`):** fondo `--sky-l`, texto `--sky-solid`
- **Básico (`3.5 – 3.9`):** fondo `--orange-l`, texto `--orange-solid`
- **Bajo (`1.0 – 3.4`):** fondo `--red-l`, texto `--red-solid`

---

## 5. Reglas de Componentes y Accesibilidad Visual

1. **Prohibido `outline-none` sin indicador de foco equivalente:** Todo control (`<button>`, `<a>`, `<input>`, `<select>`, `ChildSwitcher`, `CommandPalette`) debe mostrar un anillo de foco visible de al menos `2px–3px` (`--sky` o `--blue`) al navegar por teclado.
2. **Tipografía de datos:** Todas las notas, porcentajes, horas semanales, fechas de entrega, cupos y saldos de cartera deben usar `tabular-nums` para alineación vertical perfecta.
3. **Cenefa Muisca (`.muisca`):** Se reserva para el encabezado del Login, el portal de Matrículas y los **Boletines/Certificados Oficiales en PDF** (no saturar pantallas internas de trabajo en Bachillerato/Institucional).
4. **Movimiento reducido:** Mantener siempre la regla `@media (prefers-reduced-motion: reduce)` en `globals.css` y nunca depender únicamente de una animación para comunicar un cambio de estado.
