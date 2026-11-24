# Reglas del Proyecto — Campus Digital Liceo Lunita de Chía

Este documento establece las **reglas obligatorias** de negocio escolar, ciberseguridad, rendimiento para ~600 personas, arquitectura, accesibilidad y diseño dual para todo el desarrollo del **Campus Digital (SIGA + Aula Virtual + Matrículas)**.

---

## 1. Reglas de Independencia e Integración con la Web en Astro

1. **No modificar el repositorio del sitio informativo durante la construcción del Campus:**
   - El sitio público en Astro ([prototipo-pagina-web-liceo-lunita-de-chia](https://jlpineda12.github.io/prototipo-pagina-web-liceo-lunita-de-chia/)) y este Campus Digital son proyectos separados.
2. **Coherencia de marca con sistema visual dual (`SISTEMA_DISENO.md`):**
   - Mantener la identidad de marca (`--navy`, `--cobalt`, `--yellow`, **STHEAMI**) aplicando `data-stage="primaria"` (lúdico/infantil para Preescolar y Primaria), `data-stage="bachillerato"` (serio/editorial para 6° a 11°) y `data-stage="institucional"` (alta productividad para Docentes, Padres marco y Administración).
3. **Contrato de rutas públicas de entrada:**
   - Mantener siempre estables las rutas públicas que enlazará el sitio Astro al salir a producción:
     - `/login` (acceso unificado SIGA + Aula Virtual, soportando `?modulo=siga|aula` y `?rol=estudiantes|padres|docentes`).
     - `/recuperar-clave` (recuperación autónoma de contraseña con token de un solo uso).
     - `/matriculas` (portal de admisiones y matrícula en línea).
     - `/verificar/[codigo]` (verificación pública de boletines y certificados mediante QR).

---

## 2. Reglas de Negocio Escolar Colombiano (MEN / SIEE / STHEAMI)

1. **Cumplimiento del SIEE (Decreto 1290):**
   - Toda calificación numérica (`1.0` a `5.0`, con redondeo a 1 decimal) se clasifica automáticamente según la escala institucional configurada para el año lectivo:
     - **Desempeño Superior (S):** `4.6` a `5.0`
     - **Desempeño Alto (A):** `4.0` a `4.5`
     - **Desempeño Básico (Bs):** `3.5` a `3.9` *(nota mínima aprobatoria configurable por año lectivo)*
     - **Desempeño Bajo (Bj):** `1.0` a `3.4`
   - En **Preescolar** (*Prejardín*, *Jardín*, *Transición*), soportar valoración **cualitativa/descriptiva** por dimensiones del desarrollo sin forzar nota numérica.
2. **Integración del Modelo Pedagógico STHEAMI:**
   - Toda asignatura (`subjects`) se asocia a su pilar (`S`, `T`, `H`, `E`, `A`, `M`, `I`), visible en cursos, planillas y boletines.
3. **Cierre de Periodos y Auditoría Inmutable:**
   - Con `academic_periods.grades_locked = true`, ningún docente puede modificar calificaciones de ese periodo salvo reapertura autorizada por Coordinación/Rectoría.
   - Todo cambio de nota, reapertura de periodo, anotación en el observador o aprobación de matrícula debe registrarse en `audit_logs` dentro de la **misma transacción** (incluyendo `beforeJson` y `afterJson`).
4. **Observador del Estudiante con Debido Proceso:**
   - Categorías claras (*Felicitación*, *Seguimiento Académico*, *Situación Tipo I*, *Tipo II* y *Tipo III*).
   - Debe incluir descargos del estudiante, compromiso y confirmación de lectura (*Enterado*) del acudiente con sello de fecha y hora.
5. **Bloqueo respetuoso de Boletín por Cartera (Configurable):**
   - Secretaría/Rectoría puede activar restricción de descarga de boletín final ante mora sin acuerdo de pago, mostrando un mensaje respetuoso con el estado de cuenta y canales de pago.

---

## 3. Reglas de Ciberseguridad (Hardening Obligatorio para Producción)

1. **Cero exposición pública de información escolar:**
   - Ningún listado de cursos, nombres de docentes, horarios, notas ni perfiles puede ser accesible sin sesión autenticada y verificación de rol en servidor (`requireSession` / `requireRole` / `canAccessStudent`).
   - En `/verificar/[codigo]` solo se muestra el estado de validez y metadatos mínimos del certificado; nunca se exponen notas completas ni datos sensibles de menores.
2. **Autenticación y Ciclo de Vida de Sesiones:**
   - Contraseñas hasheadas con `scrypt` (`timingSafeEqual` + `getDummyHash` anti-enumeración).
   - Tokens de sesión de ≥ 32 bytes aleatorios guardados únicamente como hash `SHA-256` en BD, entregados en cookies `httpOnly`, `sameSite: "lax"` y `secure: true` en producción.
   - **Rate-limiting dual obligatorio en `/login` y `/recuperar-clave`:** limitar por **IP** (anti-*password spraying*) y por **identificador** con ventana temporal (sin bloquear permanentemente cuentas legítimas ante ataques DoS). Configurar el proxy inverso en producción para que sobrescriba `x-forwarded-for`.
   - **Revocación global de sesiones:** implementar `revokeAllUserSessions(userId)` y ejecutarla siempre que se restablezca una contraseña o se desactive un usuario (`isActive = false`).
   - **Bloqueo estricto de Demo Login:** `DEMO_LOGIN_ENABLED` jamás puede activarse en producción ni en entornos accesibles públicamente fuera de `localhost`.
3. **Cabeceras HTTP de Seguridad Obligatorias (`next.config.ts`):**
   - Mantener `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Robots-Tag: noindex, nofollow`.
   - Añadir **`Strict-Transport-Security`** (HSTS en HTTPS) y **`Content-Security-Policy` (CSP)** estricta (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`).
4. **Seguridad en Subida de Archivos y Datos de Menores (Ley 1581 de 2012):**
   - **Prohibido guardar archivos subidos por usuarios dentro de `public/`** (documentos de matrícula, excusas médicas, tareas, boletines).
   - Todo archivo privado debe almacenarse en Object Storage privado (Cloudflare R2 / S3) o directorio privado fuera de la raíz web, y entregarse únicamente mediante endpoint autenticado que valide `canAccessStudent()` / permisos del curso, o mediante URL firmada con expiración corta (≤ 5 minutos).
   - Validar cada archivo subido por **magic bytes reales** (no solo extensión o `Content-Type`), tipo permitido (`PDF`, `PNG`, `JPG`, `WEBP`, `DOCX`), límite de tamaño estricto y nombre renombrado a UUID.
   - Sanitizar estrictamente cualquier contenido enriquecido del Aula Virtual (esquema cerrado de Tiptap / sin `dangerouslySetInnerHTML` sin sanitización) para impedir XSS almacenado.
   - Registrar consentimiento explícito de **Ley 1581 (Habeas Data)** con fecha, hora y representante legal en todo formulario de matrícula.
5. **Aislamiento RBAC y Protección de Endpoints (`/api/*` y Server Actions):**
   - Cada Server Action y cada Route Handler en `src/app/api/*` debe validar: sesión activa, rol autorizado, propiedad/vínculo del recurso (`canAccessStudent` o `courseAssignments.teacherId === actor.id`) y esquema **Zod**.

---

## 4. Reglas de Escalabilidad y Rendimiento (Cupo Objetivo: 1.000+ Personas)

Diseñado para operar con fluidez para **al menos 1.000 usuarios activos** (estudiantes, acudientes, docentes y staff) soportando picos de **entrega de boletines, matrículas, llamado a lista y exámenes simultáneos**:

1. **PostgreSQL en desarrollo y producción (decisión del 2026-11-23):**
   - Un solo esquema Drizzle (`pg-core`) para ambos entornos; en desarrollo, PostgreSQL 18 local (Homebrew o Docker).
   - Antes de pasar a producción real con 600 personas, migrar el conector Drizzle a **PostgreSQL** con *connection pooling* (PgBouncer / Neon / Supabase) para soportar escrituras concurrentes sin bloqueos `SQLITE_BUSY`.
2. **Cero consultas duplicadas o en cascada por petición:**
   - Memorizar con React `cache()` las consultas compartidas entre Layout y Páginas (`getSession`, `getCurrentAcademicContext`, `getGuardianChildren`).
   - Ejecutar consultas independientes en paralelo con `Promise.all` (especialmente en paneles de Staff, Docentes y Planillas).
   - Prohibido realizar consultas dentro de bucles (`N+1`); usar `inArray` o `JOIN` con índices.
3. **Índices Obligatorios para Consultas Frecuentes:**
   - Mantener índice compuesto en `audit_logs(action, entity_type, entity_id, created_at)` para rate-limiting rápido.
   - Indexar toda llave de consulta masiva en Fases 2–4: `(course_assignment_id, period_id)`, `(enrollment_id, period_id)`, `(enrollment_id, date)` y `(activity_id, enrollment_id)`.
4. **Generación Eficiente y Caché de Boletines PDF:**
   - **Prohibido levantar navegadores Chromium/Puppeteer por cada descarga de usuario.** Usar motor liviano (`@react-pdf/renderer` o Typst) y **cachear el PDF generado en Object Storage** (regenerándolo solo cuando cambie una nota del periodo).
5. **Paginación en Servidor:**
   - Toda tabla que pueda superar 50 filas (Usuarios, Auditoría, Matrículas, Cartera, Entregas) debe usar paginación, búsqueda y filtros en servidor.

---

## 5. Reglas de Arquitectura, Código y Accesibilidad (WCAG 2.2 AA)

1. **Separación modular estricta (`src/modules/*`):**
   - Las páginas en `src/app/` validan sesión, llaman funciones de `src/modules/<modulo>/` y renderizan UI. Prohibido consultar Drizzle directamente desde componentes de cliente o mezclar lógica de negocio en componentes visuales.
2. **TypeScript estricto y Transacciones:**
   - `strict: true`, prohibido `any`. Toda sincronización Aula Virtual → SIGA (`submissions` + `student_grades` + `audit_logs`) debe ejecutarse en una **transacción atómica**.
3. **Accesibilidad WCAG 2.2 AA Obligatoria:**
   - Contraste mínimo **4.5:1** en texto normal y **3:1** en texto grande/controles (usar los tokens `-solid` o texto `--navy` definidos en [`SISTEMA_DISENO.md`](./SISTEMA_DISENO.md)).
   - Prohibido usar `outline-none` sin anillo de foco visible equivalente (`focus-visible` o `focus-within`).
   - Nunca comunicar estado solo por color: acompañar siempre con texto o icono (ej. escala SIEE, asistencia, estado de entrega).
   - Todas las vistas deben ser usables desde `320px`/`360px` de ancho sin desbordamiento horizontal y respetar `prefers-reduced-motion`.
4. **Cero jerga técnica en la interfaz de usuario:**
   - No mostrar textos internos como `"Fase 2"`, `"Fase 3"` ni `"npm run db:reset"` a usuarios finales (estudiantes, acudientes o docentes).
5. **Verificación obligatoria antes de dar por cerrada cada tarea:**
   - Ejecutar `npm run typecheck`, `npm run lint` y `npm test` (y pruebas nuevas para toda regla crítica de negocio o política RBAC).
