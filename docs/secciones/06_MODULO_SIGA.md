# Sección 06 — Especificación Técnica del Módulo SIGA (`/siga/*`)

**Carpeta de dominio:** `src/modules/siga/`  
**Rutas de interfaz:** `/siga/calificaciones`, `/siga/boletines`, `/siga/observador`, `/siga/asistencia`, `/siga/agenda`, `/siga/cartera`  
**Esquema de base de datos:** `src/db/schema/siga.ts` (extensión sobre `enrollments` de Fase 1)

---

## 1. Submódulos y Fronteras (`src/modules/siga/`)

```text
src/modules/siga/
├── siee-grades/
│   ├── scale.ts             # (Ya implementado) Escala Decreto 1290 y redondeo
│   ├── calculator.ts        # Ponderación por dimensión (Saber/Hacer/Ser) y definitiva de periodo/año
│   ├── queries.ts           # Lectura de planilla por curso/periodo y resumen por estudiante
│   └── actions.ts           # Server Actions: crear columna, guardar lote de notas (con auditoría y check de candado)
├── report-cards/
│   ├── generator.ts         # Generador PDF liviano (@react-pdf/renderer o Typst) con cenefa Muisca y QR
│   ├── storage.ts           # Caché de PDFs en Object Storage + invalidación al editar nota
│   └── queries.ts           # Emisión, consulta por periodo y verificación pública por QR
├── observer/
│   ├── schemas.ts           # Validación Zod de anotaciones, descargos y firmas
│   ├── queries.ts           # Línea de tiempo filtrada por RBAC
│   └── actions.ts           # Crear anotación, registrar descargos estudiante, firmar "Enterado" acudiente
├── attendance/
│   ├── queries.ts           # Lista del día/curso, estadísticas de ausentismo y excusas pendientes
│   └── actions.ts           # Guardado masivo de lista + radicación y aprobación de excusas
├── agenda/
│   ├── queries.ts           # Circulares, eventos del cronograma y conteo de lecturas
│   └── actions.ts           # Publicar circular, confirmar lectura, exportar .ics
└── billing/
    ├── queries.ts           # Estado de cuenta familiar, recibos y verificación de mora
    └── actions.ts           # Registrar pago, aprobar comprobante, emitir Paz y Salvo PDF+QR
```

---

## 2. Tablas Drizzle Adicionales (`src/db/schema/siga.ts`)

| Tabla | Columnas clave | Índices obligatorios (600 personas) |
| :--- | :--- | :--- |
| `siee_competencies` | `id`, `course_assignment_id`, `period_id`, `dimension` (`SABER`, `HACER`, `SER`, `QUALITATIVE`), `description`, `weight_percent`, `display_order` | `(course_assignment_id, period_id)` |
| `siee_grade_columns` | `id`, `course_assignment_id`, `period_id`, `competency_id`, `title`, `weight_percent`, `linked_activity_id` (nullable, único), `is_published`, `created_at` | `(course_assignment_id, period_id)` |
| `student_grades` | `id`, `column_id`, `enrollment_id`, `numeric_score` (nullable), `qualitative_level` (nullable), `performance_level`, `feedback`, `updated_by`, `updated_at` | `UNIQUE(column_id, enrollment_id)`, `(enrollment_id)` |
| `observer_records` | `id`, `enrollment_id`, `period_id`, `author_id`, `category` (`PRAISE`, `ACADEMIC`, `TYPE_I`, `TYPE_II`, `TYPE_III`), `title`, `description`, `student_statement`, `student_statement_at`, `commitment`, `guardian_acknowledged_at`, `guardian_acknowledged_by`, `guardian_comment`, `created_at` | `(enrollment_id, created_at)`, `(category, created_at)` |
| `attendance_logs` | `id`, `enrollment_id`, `course_assignment_id` (nullable para jornada), `date` (ISO `YYYY-MM-DD`), `status` (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`), `notes`, `recorded_by`, `updated_at` | `UNIQUE(enrollment_id, course_assignment_id, date)`, `(date, status)` |
| `attendance_excuses` | `id`, `enrollment_id`, `guardian_id`, `from_date`, `to_date`, `reason_type`, `description`, `attachment_key` (storage privado), `status` (`PENDING`, `APPROVED`, `REJECTED`), `reviewed_by`, `reviewed_at`, `review_notes` | `(enrollment_id, status)`, `(status, from_date)` |
| `report_cards` | `id`, `enrollment_id`, `period_id`, `verification_code` (único), `average_score`, `performance_level`, `director_observations`, `storage_key` (PDF cacheado), `is_stale` (boolean), `issued_at` | `UNIQUE(enrollment_id, period_id)`, `UNIQUE(verification_code)` |
| `circulars` y `circular_reads` | `id`, `title`, `body_sanitized`, `target_scope` (`ALL`, `LEVEL`, `GRADE`, `GROUP`), `target_id`, `author_id`, `published_at`; lecturas `UNIQUE(circular_id, user_id)` | `(published_at)` |
| `financial_ledger` | `id`, `enrollment_id`, `concept`, `period_month`, `due_date`, `amount_cop`, `discount_cop`, `status` (`PENDING`, `REPORTED`, `PAID`, `OVERDUE`, `AGREEMENT`), `payment_method`, `receipt_number`, `proof_storage_key`, `paid_at` | `(enrollment_id, status)`, `(status, due_date)` |

---

## 3. Reglas Críticas del Motor SIEE y Boletines PDF

1. **Cálculo determinista en servidor:**
   - El promedio de cada dimensión (*Saber*, *Hacer*, *Ser*) se calcula ponderando sus columnas; la definitiva del periodo pondera las dimensiones y redondea con `roundScore()` (1 decimal) antes de clasificar con `getPerformanceLevel()`.
   - La definitiva anual pondera los 4 periodos según `academic_periods.weight_percent`.
2. **Invalidación automática de boletín cacheado:**
   - Si Coordinación abre una ventana temporal y se modifica una nota en un periodo que ya tenía boletín emitido, la misma transacción marca `report_cards.is_stale = true` y registra `GRADE_UPDATED` en `audit_logs` con `beforeJson` y `afterJson`.
3. **Diseño del Boletín Oficial PDF (con cenefa Muisca y QR):**
   - Encabezado institucional: Escudo Lunita + cenefa `.muisca` + datos del estudiante, grado/grupo, año, periodo y director de grupo.
   - Tabla de asignaturas agrupada o etiquetada con su pilar **STHEAMI** (`S, T, H, E, A, M, I`), intensidad horaria, fallas acumuladas, nota numérica (`tabular-nums`) y desempeño SIEE (*Superior/Alto/Básico/Bajo*) + logros del periodo (en Preescolar: reporte descriptivo por dimensiones).
   - Pie institucional: firmas digitales de Rectoría y Dirección de Grupo + **código QR** apuntando a `https://<dominio>/verificar/<verification_code>`.
4. **Rendimiento para picos de 300 descargas:**
   - Jamás usar Chromium/Puppeteer en las peticiones HTTP de descarga. Usar `@react-pdf/renderer` o Typst y servir el PDF cacheado desde Object Storage (regenerando solo si `storage_key` es nulo o `is_stale = true`).
