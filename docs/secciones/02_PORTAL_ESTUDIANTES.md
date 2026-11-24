# Sección 02 — Portal del Estudiante (Tema Dual: Primaria vs. Bachillerato)

**Rol autorizado:** `STUDENT` (y vista espejo en modo lectura cuando un `GUARDIAN` consulta a su hijo).  
**Aislamiento RBAC:** Todo dato se filtra estrictamente por `enrollment.studentId === actor.id` (o hijo autorizado vía `canAccessStudent`).

---

## 1. Diferenciación Visual y de Experiencia por Etapa Escolar

Esta sección es el corazón del **Sistema Visual Dual** definido en [`SISTEMA_DISENO.md`](../../SISTEMA_DISENO.md):

| Aspecto | Preescolar y Primaria (`data-stage="primaria"`, Prejardín–5°) | Bachillerato (`data-stage="bachillerato"`, 6°–11°) |
| :--- | :--- | :--- |
| **Fuente y geometría** | `Nunito Variable`, tarjetas grandes (`24px–32px`), labio 3D `5px`, botones píldora 3D. | `Inter Variable`, canvas `#f8fafc`, tarjetas sobrias (`12px`), borde `1px`, botones planos `10px`. |
| **Encabezado (Hero)** | Bloque `--navy` con estrellas, mascota **Lunita**, saludo cercano (*"¡Hola, Tomás! ¿Qué aprenderemos hoy?"*) y barra de avance visual. | Barra superior compacta sin mascota ni estrellas; saludo sobrio (*"Sofía Ramírez · 7A"*) + **4 KPIs** inmediatos (*Promedio SIEE*, *Pendientes*, *Asistencia %*, *Periodo*). |
| **Lenguaje / Microcopy** | *"Mis misiones"*, *"Mis materias"*, *"¡Excelente trabajo!"*, valoraciones descriptivas en Preescolar. | *"Próximas entregas"*, *"Asignaturas y promedios"*, *"Rendimiento SIEE"*, fechas y horas exactas. |
| **Tarjetas de materias** | Grilla amplia (2 columnas), insignia planetaria STHEAMI grande (`36px–44px`), icono ilustrado y progreso visual. | Lista o grilla compacta (3 columnas) con barra lateral de `3px` del pilar STHEAMI, docente, nota parcial (`tabular-nums`) y conteo de tareas abiertas. |
| **Movimiento** | Microinteracciones táctiles suaves (respetando `prefers-reduced-motion`). | Transiciones secas de `150ms`, cero rebotes ni animaciones infantiles. |

---

## 2. Secciones y Pantallas del Estudiante

### A. `/dashboard` — Inicio del Estudiante
1. **Bloque de Prioridad #1 — "¿Qué tareas tengo hoy?"**
   - Lista de las próximas 4 entregas del Aula Virtual ordenadas por urgencia (`Hoy`, `Mañana`, `Esta semana`), con materia, pilar STHEAMI y botón directo `"Entregar"` / `"Abrir"`.
   - Estado vacío amigable: *"¡Estás al día! No tienes entregas pendientes esta semana."*
2. **Bloque #2 — Mis Asignaturas (`CourseGrid` adaptado a la etapa)**
   - Cada tarjeta enlaza directamente a `/aula/[cursoId]` (en Fase 3) y muestra: nombre de la materia, docente, pilar STHEAMI, nota parcial del periodo (si es `NUMERIC`) o nivel de avance (si es `QUALITATIVE` en Preescolar).
3. **Columna lateral (en escritorio) / Resúmenes:**
   - Ficha de **Mi Grupo** (grado, grupo, director(a) de grupo, modalidad de valoración).
   - **Resumen STHEAMI** (en Primaria: estrellas/progreso por pilar; en Bachillerato: promedio por pilar STHEAMI).
   - Último aviso institucional o anotación del Observador (con alerta si tiene un descargo pendiente).

### B. `/aula` y `/aula/[cursoId]` — Mis Cursos (Aula Virtual)
- **Listado `/aula`:** filtros por pilar STHEAMI y búsqueda rápida.
- **Interior del curso `/aula/[cursoId]`:**
  - Cabecera del curso con docente, horario semanal, progreso y pestañas:
    1. **Unidades y Guías:** acordeones por periodo/tema con visor de PDF, enlaces a videos y botón de marcar recurso como visto.
    2. **Tareas:** lista con estado (`Por entregar`, `Entregada`, `Calificada`, `Vencida`), rúbrica visible, caja de texto y subida de archivo (PDF/imagen/DOCX validado).
    3. **Cuestionarios:** vista previa de reglas (tiempo límite, intentos permitidos), ejecución limpia sin distracciones y retroalimentación inmediata si el docente la habilita.
    4. **Anuncios y Foro:** avisos del docente y preguntas de la clase moderadas.

### C. `/aula/tareas` — Centro Unificado "¿Qué tareas tengo?"
- Pestañas: `Pendientes`, `Entregadas`, `Calificadas`, `Vencidas`.
- Filtro por asignatura y vista calendario semanal (especialmente útil en Bachillerato para planificar parciales y entregas).

### D. `/siga/calificaciones` — Mis Notas SIEE
- Selector de periodo (`Periodo 1` a `Periodo 4` + `Definitiva anual`).
- En **Preescolar (`QUALITATIVE`):** tarjetas por dimensión del desarrollo con logros alcanzados y comentarios pedagógicos del docente (sin nota numérica fría).
- En **Primaria y Bachillerato (`NUMERIC`):**
  - Tabla/tarjetas por materia mostrando desglose por dimensión (*Saber*, *Hacer*, *Ser*), cada actividad evaluada (indicando con icono si proviene del Aula Virtual), promedio parcial y `PerformanceBadge` accesible (`Superior`, `Alto`, `Básico`, `Bajo`).
  - En **Bachillerato:** además muestra promedio ponderado del periodo, gráfico de tendencia por periodo y calculadora visual de meta (*"Qué necesitas para aprobar o subir a Alto/Superior"*).

### E. `/siga/boletines` — Mis Boletines
- Lista de periodos cerrados con botón de vista previa y descarga de **Boletín PDF Oficial con QR** (si Secretaría no tiene restricción de cartera activa).

### F. `/siga/observador` — Mi Observador
- Línea de tiempo cronológica diferenciando claramente **Felicitaciones / Reconocimientos** (verde) de **Seguimientos Académicos** (azul) y **Situaciones de Convivencia Tipo I/II/III** (naranja/rojo).
- **Derecho a descargos:** cuando existe una anotación disciplinaria o de seguimiento abierta, el estudiante dispone de un formulario para escribir su **versión / descargos y compromiso**, quedando registrado con fecha y hora inmutables.

### G. `/siga/asistencia` y `/siga/agenda`
- **Asistencia:** calendario mensual con iconos + letras (`P` Presente, `F` Falla, `R` Retardo, `E` Excusa aprobada) — nunca solo color.
- **Agenda:** circulares del colegio, fechas de evaluaciones/salidas pedagógicas y botón de exportar a calendario (`.ics`).
