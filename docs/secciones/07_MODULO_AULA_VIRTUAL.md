# Sección 07 — Especificación Técnica del Módulo Aula Virtual (`/aula/*`)

**Carpeta de dominio:** `src/modules/aula/`  
**Rutas de interfaz:** `/aula`, `/aula/[cursoId]`, `/aula/[cursoId]/tareas/[actividadId]`, `/aula/[cursoId]/quiz/[actividadId]`, `/aula/tareas`  
**Esquema de base de datos:** `src/db/schema/aula.ts`  
**Adaptación visual:** Respeta automáticamente `data-stage="primaria"` (lúdico/ilustrado), `data-stage="bachillerato"` (serio/académico) y `data-stage="institucional"` (edición docente).

---

## 1. Submódulos y Fronteras (`src/modules/aula/`)

```text
src/modules/aula/
├── courses/
│   ├── queries.ts           # Mis cursos, detalle del curso por unidades, progreso del estudiante
│   └── actions.ts           # Crear/reordenar/publicar unidades, clonar curso entre grupos o años
├── resources/
│   ├── sanitize.ts          # Sanitización estricta de contenido enriquecido (prevención XSS)
│   └── actions.ts           # Subir guía PDF (storage privado + magic bytes), agregar video/enlace/lectura
├── assignments/
│   ├── queries.ts           # Bandeja "¿Qué tareas tengo?" y bandeja docente de entregas por calificar
│   └── actions.ts           # Crear tarea, enviar entrega (estudiante), calificar entrega con rúbrica (docente)
├── quizzes/
│   ├── evaluator.ts         # Motor puro de autocalificación (opción múltiple, V/F, emparejamiento)
│   ├── queries.ts           # Preguntas sin respuestas correctas para el estudiante; resultados para el docente
│   └── actions.ts           # Iniciar intento con reloj en servidor, enviar respuestas y calificar
├── forums/
│   └── actions.ts           # Anuncios del curso y preguntas/respuestas moderadas por el docente
└── grade-sync/
    └── sync.ts              # Puente transaccional: nota de Tarea/Quiz -> columna en siee_grade_columns / student_grades
```

---

## 2. Tablas Drizzle (`src/db/schema/aula.ts`)

| Tabla | Columnas clave | Índices obligatorios (600 personas) |
| :--- | :--- | :--- |
| `course_units` | `id`, `course_assignment_id`, `period_id`, `title`, `description`, `display_order`, `is_published`, `created_at` | `(course_assignment_id, period_id, display_order)` |
| `learning_resources` | `id`, `unit_id`, `type` (`PDF`, `VIDEO`, `LINK`, `RICH_TEXT`), `title`, `content_json_or_url`, `storage_key` (nullable), `file_size_bytes`, `display_order`, `is_published` | `(unit_id, display_order)` |
| `resource_views` | `id`, `resource_id`, `enrollment_id`, `viewed_at` | `UNIQUE(resource_id, enrollment_id)` |
| `activities` | `id`, `unit_id`, `type` (`ASSIGNMENT`, `QUIZ`, `FORUM`), `title`, `instructions_sanitized`, `due_date`, `max_score` (default `5.0`), `allow_late`, `time_limit_minutes` (quizzes), `max_attempts`, `sync_to_siga` (boolean), `is_published`, `created_at` | `(unit_id, due_date)`, `(is_published, due_date)` |
| `submissions` | `id`, `activity_id`, `enrollment_id`, `text_response`, `attachment_key` (storage privado), `submitted_at`, `is_late`, `score` (nullable), `rubric_json`, `teacher_feedback`, `graded_by`, `graded_at` | `UNIQUE(activity_id, enrollment_id)`, `(enrollment_id, submitted_at)` |
| `quiz_questions` | `id`, `activity_id`, `question_type` (`SINGLE_CHOICE`, `MULTI_CHOICE`, `TRUE_FALSE`, `SHORT_TEXT`), `prompt_sanitized`, `options_json`, `correct_answer_json`, `points`, `display_order` | `(activity_id, display_order)` |
| `quiz_attempts` | `id`, `activity_id`, `enrollment_id`, `attempt_number`, `started_at`, `submitted_at`, `answers_json`, `auto_score`, `manual_score`, `final_score` | `UNIQUE(activity_id, enrollment_id, attempt_number)` |
| `forum_posts` | `id`, `course_assignment_id`, `activity_id` (nullable), `author_id`, `parent_id` (nullable), `body_sanitized`, `is_pinned`, `created_at` | `(course_assignment_id, created_at)` |

---

## 3. Reglas Clave de Seguridad, Concurrencia y Sincronización con SIGA

1. **Integridad en Exámenes Simultáneos (30+ estudiantes en sala de sistemas):**
   - El temporizador del quiz se valida **siempre en servidor** comparando `submitted_at - started_at <= time_limit_minutes + 30s de gracia` (nunca confiar solo en el reloj del navegador).
   - Las respuestas correctas (`correct_answer_json`) **jamás se serializan** al cliente mientras el intento está activo.
   - Al usar PostgreSQL en producción, las entregas simultáneas se confirman sin bloqueos `SQLITE_BUSY`.
2. **Seguridad de Contenido y Archivos:**
   - Todo texto enriquecido del docente o foro pasa por esquema estricto de sanitización antes de persistirse y renderizarse (cero `<script>`, `onerror`, `javascript:` URLs).
   - Las guías PDF y entregas de tareas se validan por **magic bytes**, límite de tamaño (ej. 10 MB para guías docentes, 5 MB para entregas de estudiantes) y se entregan mediante endpoint autenticado que verifique que el usuario pertenece al `course_assignment_id` (o es acudiente/staff autorizado).
3. **Puente Transaccional Aula Virtual → SIGA (`src/modules/aula/grade-sync/sync.ts`):**
   - Cuando el docente activa `sync_to_siga = true` en una actividad, selecciona la dimensión SIEE (`SABER`, `HACER`, `SER`) y el porcentaje: el servicio crea la fila vinculada en `siee_grade_columns (linked_activity_id = activity.id)`.
   - Al calificar una entrega o finalizar un quiz autocalificable, dentro de **una única transacción SQL**:
     1. Se verifica que `academic_periods.grades_locked === false` (si el periodo ya cerró, guarda la nota del Aula pero avisa que la planilla SIGA está bloqueada).
     2. Se guarda la calificación en `submissions` / `quiz_attempts`.
     3. Se normaliza a la escala `1.0 – 5.0` y se actualiza/inserta `student_grades` con `performance_level`.
     4. Se marca `report_cards.is_stale = true` si existía borrador y se registra el evento en `audit_logs`.
4. **Privacidad frente al Moodle antiguo:**
   - Ningún curso, categoría ni nombre de docente es accesible sin sesión; cada estudiante ve únicamente las materias de su `group_id` activo.
