# Auditoría de los Planos por Sección (`docs/secciones/01` a `07`)

**Fecha:** 2026-11-23 · **Estado del código:** Paso 0 completado (ver §1).
Este documento cruza los 7 planos con el código actual y con `REGLAS.md` / `SISTEMA_DISENO.md`, y lista
las inconsistencias que conviene resolver **antes** de crear las tablas de la Fase 2.

---

## 1. Estado del Paso 0 (`AUDITORIA_FASE1_Y_PLAN.md` §4)

| Ítem | Estado | Dónde |
| :--- | :--- | :--- |
| CSP estricta con nonce por petición + HSTS en producción | Hecho | `src/proxy.ts`, `src/modules/core/security/csp.ts`, `next.config.ts` |
| Límite dual de intentos (IP · cuenta+IP · cuenta) | Hecho | `src/modules/core/security/throttle.ts`, `audit/service.ts` (`checkThrottle`) |
| `revokeAllUserSessions`, purga de sesiones vencidas, máx. 10 sesiones por usuario | Hecho | `src/modules/core/auth/session.ts` |
| `/recuperar-clave` (token 32 B, SHA-256, 15 min, un solo uso, revoca sesiones) | Hecho | `auth/password-reset.ts`, `app/(public)/recuperar-clave/*` |
| Bloqueo del login demo fuera de `localhost` + arranque bloqueado en producción | Hecho | `auth/demo.ts`, `src/instrumentation.ts` |
| `cache()` + `Promise.all` en layout/dashboard; sin consulta duplicada de vínculos | Hecho | `academic-structure/queries.ts`, `dashboard/service.ts` |
| Índices `audit_logs(action, entity_type, entity_id, created_at)` y `(action, ip_address, created_at)` | Hecho | migración `drizzle/0001_*.sql` |
| Contraste AA (`-solid`, `--muted`, `--placeholder`), foco visible, login sin `radiogroup` engañoso | Hecho | `globals.css`, `LoginForm`, `ChildSwitcher`, `CommandPalette` |
| Sin "Pronto"/"Fase N" en la interfaz | Hecho | `dashboard/shell.ts` envía solo módulos habilitados |
| Sistema visual dual `data-stage` (primaria / bachillerato / institucional) | Hecho | `dashboard/stage.ts`, `globals.css`, `CampusShell`, `StudentPanel` |
| **Migración a PostgreSQL** | Hecho (2026-11-23): PostgreSQL 18 en desarrollo y producción, esquema único `pg-core` | `src/db/schema/*`, `src/db/client.ts`, `drizzle/0000_*.sql` |

---

## 2. Hallazgos en los planos

| # | Sección | Hallazgo | Propuesta |
| :--- | :--- | :--- | :--- |
| 1 | 01 §2 | Pide contraseña de **mínimo 8** caracteres; la política implementada exige **10** con letras y números. | Mantener 10 (más seguro para cuentas con datos de menores) o bajar a 8. **Decisión del colegio.** |
| 2 | 01 §2 | La tabla `password_reset_tokens` lista `token_hash` y `requested_ip`; el código usa `id` (= SHA-256) e `ip_address`. La acción de auditoría se llama `PASSWORD_RESET_COMPLETED` (el plano dice `PASSWORD_RESET`). | Funcionalmente equivalente. Se deja así; el plano puede actualizarse. |
| 3 | 01 §2 | Estudiantes de Primaria sin correo: enviar el enlace al correo del acudiente. | **Implementado** (acudiente responsable financiero con correo; si no, otro acudiente vinculado). |
| 4 | 01 §4 / 06 | `/verificar/[codigo]` consulta `report_cards` **y `certificates`**, pero `certificates` (constancias, paz y salvos) no está definida en ninguna tabla. | Agregar `certificates` (`id`, `type`, `enrollment_id`, `verification_code` único, `storage_key`, `issued_at`, `revoked_at`) en `siga.ts`. |
| 5 | 05 §1, §3 | "Reapertura temporal" de periodos con motivo y **fecha de expiración**, pero no existe tabla para la ventana. `grades_locked` es un booleano global. | Agregar `period_unlock_windows` (`period_id`, `course_assignment_id` nullable, `reason`, `opened_by`, `expires_at`) y que el candado se evalúe como `grades_locked AND NOT ventana_vigente`. |
| 6 | 06 §2 | `attendance_logs` con `UNIQUE(enrollment_id, course_assignment_id, date)` y `course_assignment_id` **nullable** (asistencia por jornada): en SQL los `NULL` no colisionan, así que se podrían duplicar registros de jornada. | Índice único parcial para jornada (`WHERE course_assignment_id IS NULL`) o columna `scope` (`DAY`/`CLASS`) no nula. |
| 7 | 03 §1, 02 §2 | "Centro de Notificaciones" y alertas ("1 anotación por firmar", "2 tareas para mañana") sin tabla definida. | Agregar `notifications` (`user_id`, `type`, `entity_type`, `entity_id`, `read_at`, `created_at`, índice `(user_id, read_at)`) o calcularlas en vivo con consultas indexadas. |
| 8 | 05 §1 | La matriz de permisos COORDINATOR vs ADMIN es más fina que los roles. | **Implementada** como mapa de permisos puro (`auth/permissions.ts`) con pruebas; las pantallas de Fase 2 deben usar `can()` / `requirePermission()`. |
| 9 | 06, 07 | Archivos privados en "Object Storage" sin proveedor elegido. | Interfaz `Storage` con adaptador local privado (fuera de `public/`) para desarrollo y R2/S3 en producción. **Decisión del proveedor pendiente.** |
| 10 | 06 §3.3 / 07 | PDF con `@react-pdf/renderer` o Typst. | Recomendado `@react-pdf/renderer` (JS puro, sin binarios), cacheado en el storage. |
| 11 | 04 §2 | Planilla con TanStack Table y autoguardado con debounce. | Guardado por lotes vía Server Action con `expectedUpdatedAt` por celda para detectar ediciones concurrentes. |
| 12 | 02 §1 | Primaria: grilla de 2 columnas; el código usa 2 y 3 en pantallas ≥ 1280 px. | Ajuste menor al construir la vista final. |

---

## 3. Decisiones que bloquean la Fase 2

### 3.1 Base de datos de la Fase 2 — **Resuelto**
Se adoptó PostgreSQL 18 en todos los entornos: enums nativos (`user_role`, `level_code`…), `uuid`, `timestamptz`,
`date`, notas con `numeric` exacto y auditoría en `jsonb`. Las tablas de las Fases 2–3 se escriben directamente en `pg-core`.

### 3.2 Proveedor de almacenamiento privado
Cloudflare R2, AWS S3 o disco privado del servidor (VPS). Afecta matrículas, excusas, entregas y boletines.

---

## 4. Orden propuesto de construcción (Fase 2)

1. Permisos (`can`/`requirePermission`) — **hecho**.
2. Esquema SIGA + tablas faltantes (§2: `certificates`, `period_unlock_windows`, índice parcial de asistencia).
3. `/admin/estructura` (periodos, cierre/reapertura auditada) — prerequisito de la planilla.
4. `/siga/calificaciones` (planilla docente + vista estudiante/acudiente) con motor `calculator.ts`.
5. `/siga/asistencia` (llamado a lista móvil + excusas).
6. `/siga/observador` (debido proceso + Enterado).
7. `/siga/boletines` + `/verificar/[codigo]` con PDF cacheado y QR.
8. `/admin/usuarios` (paginado, vínculos, revocar sesiones).
