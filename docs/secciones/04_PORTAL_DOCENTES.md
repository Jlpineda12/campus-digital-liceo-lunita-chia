# Sección 04 — Portal de Docentes y Directores de Grupo

**Rol autorizado:** `TEACHER`  
**Etapa visual (`data-stage`):** Siempre **`institucional`** (`Inter Variable`, bordes `1px`, botones compactos, alta densidad de datos, navegación por teclado).  
**Aislamiento RBAC:**
- Como **Docente de Asignatura:** solo puede gestionar cursos, planillas SIEE, asistencia y entregas de los `course_assignments` donde `teacher_id === actor.id`.
- Como **Director(a) de Grupo (`groups.director_teacher_id === actor.id`):** además puede ver el consolidado integral de todas las materias de su grupo, registrar observaciones generales de boletín, gestionar el Observador del grupo y consultar contactos de acudientes de sus estudiantes.

---

## 1. `/dashboard` — Tablero Operativo del Docente

Diseñado para ahorrar tiempo en el salón y al cierre de periodo (sin tarjetas decorativas que ocupen media pantalla):

1. **Barra de KPIs compactos:**
   - `Cargas académicas`, `Grupos`, `Estudiantes`, `Entregas por calificar` (badge accionable que lleva directo a la bandeja de calificación) y `Estado del periodo` (`Abierto · faltan X días` o `Cerrado`).
2. **Acciones rápidas de jornada ("Hoy en clase"):**
   - Lista de grupos/materias del docente con 3 botones directos en cada fila:
     - `Tomar asistencia` → `/siga/asistencia?curso=[id]`
     - `Planilla SIEE` → `/siga/calificaciones?curso=[id]`
     - `Aula Virtual` → `/aula/[cursoId]`
3. **Bloque de Dirección de Grupo** (si aplica):
   - Resumen del grupo dirigido: ocupación (`studentCount/capacity`), alertas de estudiantes en desempeño `BAJO` (en ≥ 2 materias), alertas de ausentismo y acceso directo a **"Observaciones de boletín"** y **"Observador del grupo"**.
4. **Mi Carga Académica (con filtros rápidos):**
   - Filtro por nivel (*Preescolar*, *Primaria*, *Bachillerato*) y buscador por grupo o asignatura.

---

## 2. `/siga/calificaciones` — Planilla SIEE (Tipo Hoja de Cálculo)

Es la herramienta de mayor frecuencia de uso del docente y debe sentirse tan ágil como Excel/Google Sheets:

### A. Modo Numérico (Primaria y Bachillerato — `NUMERIC`)
- **Selectores fijos en cabecera:** `Curso (Grupo · Materia)` + `Periodo (1–4)` + estado del candado (`Abierto` / `Cerrado`).
- **Configuración de columnas SIEE por periodo:**
  - Agrupadas visualmente bajo las 3 dimensiones institucionales: **Saber (Cognitivo)**, **Hacer (Procedimental)** y **Ser (Actitudinal)** con validación de que los pesos sumen `100 %`.
  - Botón `+ Nueva columna manual` (para exposiciones, cuadernos, laboratorios en aula).
  - Indicador visual claro (`🔗 Aula Virtual`) en las columnas vinculadas automáticamente a una tarea o cuestionario del Aula Virtual.
- **Grilla interactiva (`TanStack Table`):**
  - Columna congelada a la izquierda con foto/iniciales y nombre completo del estudiante.
  - Celdas numéricas `1.0 – 5.0` con validación en tiempo real, navegación por teclado (`Enter` baja de fila, `Tab` avanza de columna, flechas navegan la grilla) y `tabular-nums`.
  - **Autoguardado inteligente** con debounce + indicador de estado (`Guardando…`, `Guardado a las 14:22`, `Error: reintentar`) y botón manual `Guardar todo`.
  - Cálculo en vivo de: `Promedio Saber`, `Promedio Hacer`, `Promedio Ser`, `Definitiva del Periodo` y `PerformanceBadge` (`S`, `A`, `Bs`, `Bj`).
  - **Bloqueo por periodo cerrado:** si `academic_periods.grades_locked = true`, la planilla pasa a **solo lectura** con aviso claro (*"Periodo cerrado. Solicita ventana temporal a Coordinación si requieres corrección"*).
- **Gestión de Logros / Indicadores / DBA:** pestaña o panel lateral en la misma pantalla para redactar o reutilizar los logros del periodo que aparecerán en el boletín del estudiante.

### B. Modo Cualitativo (Preescolar — `QUALITATIVE`)
- En *Prejardín*, *Jardín* y *Transición*, la planilla reemplaza las notas decimales por:
  - Selector de nivel de alcance por indicador/dimensión (*Alcanzado*, *En proceso*, *Requiere acompañamiento*) y banco de descriptores pedagógicos editables para el boletín.

---

## 3. `/siga/asistencia` — Llamado a Lista en < 30 Segundos

- Optimizada especialmente para **teléfono celular en el salón**:
  - Por defecto todos los estudiantes inician marcados como **Presente (`P`)** para que el docente solo toque los casos excepcionales (ahorra 80 % de toques).
  - Botones táctiles con icono + letra (`P` Presente, `F` Falla, `R` Retardo, `E` Excusa) y nota rápida opcional.
  - Si un estudiante ya tiene una **excusa aprobada** por Coordinación para esa fecha, aparece premarcada como `E` con candado informativo.
  - Al pulsar **`Guardar asistencia`**, los estudiantes marcados con `F` o `R` disparan notificación automática al acudiente correspondiente (configurable por el colegio).

---

## 4. `/siga/observador` — Registro con Debido Proceso

- Vista filtrada por grupo/estudiante.
- Botón **`+ Nueva anotación`**:
  - Selector de estudiante(s) (permite anotación grupal para felicitaciones, ej. participación en NASA Space Apps o Banda Marcial).
  - Categoría: `Felicitación / Reconocimiento`, `Seguimiento Académico`, `Situación Tipo I`, `Situación Tipo II` (notifica automáticamente a Coordinación), `Situación Tipo III` (alerta prioritaria a Coordinación y Rectoría).
  - Descripción objetiva de los hechos + estrategia pedagógica o compromiso sugerido.
  - Estado visible: `Pendiente descargos del estudiante` / `Pendiente Enterado del acudiente` / `Firmado`.

---

## 5. `/aula/[cursoId]` — Gestión Docente del Aula Virtual

Dentro de cada materia asignada, el docente cuenta con un conmutador `Modo Edición` / `Vista Estudiante` y 5 pestañas:
1. **Unidades y Recursos:** crear unidades por periodo, subir guías PDF (storage privado), incrustar enlaces/videos educativos y texto enriquecido sanitizado (Tiptap). Permite reordenar y publicar/ocultar unidades (`Borrador` vs `Publicado`).
2. **Tareas y Calificación Rápida:**
   - Crear tarea con instrucciones, fecha límite, puntaje máximo, rúbrica opcional y switch **`Sincronizar con Planilla SIGA`** (eligiendo la dimensión SIEE y peso).
   - **Bandeja de calificación tipo visor dividido (split-view):** a la izquierda la lista de estudiantes (`Entregó`, `Tarde`, `Sin entrega`) y la vista previa del PDF/respuesta; a la derecha la nota, rúbrica y retroalimentación. Al guardar, actualiza el Aula Virtual y el SIGA en una sola transacción.
3. **Cuestionarios / Exámenes:** creador de preguntas (opción múltiple, verdadero/falso, emparejamiento, respuesta corta/abierta), banco reutilizable, mezcla aleatoria de orden, tiempo límite y autocalificación sincronizada con el SIGA.
4. **Anuncios y Foro:** publicar comunicados del curso y responder dudas de los estudiantes.
5. **Duplicar curso entre grupos o años:** si un especialista dicta Matemáticas en `7A` y `7B` (o del año 2026 al 2027), puede clonar unidades, guías y bancos de preguntas en 1 clic sin volver a subir archivos.

---

## 6. Consolidado de Dirección de Grupo (`/siga/boletines` y `/siga/calificaciones`)

Exclusivo para el `directorTeacherId` del grupo:
- **Sábana consolidada del grupo:** filas = estudiantes del grupo, columnas = todas las asignaturas + promedio general + puesto/rendimiento + contador de áreas en desempeño Bajo.
- **Editor de observación del boletín:** campo rápido por estudiante (con frases sugeridas institucionales) para el comentario general del director de grupo antes de la emisión oficial de boletines.
