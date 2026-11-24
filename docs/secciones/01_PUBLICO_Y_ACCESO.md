# Sección 01 — Rutas Públicas, Acceso Unificado y Verificación

**Rutas cubiertas:** `/login`, `/recuperar-clave`, `/matriculas`, `/verificar/[codigo]`  
**Etapa visual (`data-stage`):** Marco institucional cósmico (`PublicFrame` / bloque `--navy` + cenefa `.muisca-thin` en portada y formularios limpios con contraste WCAG 2.2 AA).  
**Contrato con el sitio Astro:** Todas estas rutas deben mantenerse estables y sin romper sus parámetros de consulta (`?modulo=siga|aula`, `?rol=estudiantes|padres|docentes`).

---

## 1. `/login` — Acceso Unificado (SIGA + Aula Virtual)

### Objetivo UX/UI
- Un solo ingreso para los 5 roles (`STUDENT`, `GUARDIAN`, `TEACHER`, `COORDINATOR`, `ADMIN`).
- Eliminar la confusión del viejo colegio donde los usuarios no sabían si entrar a SIGA o a Moodle.
- Mantener la estética cósmica de bienvenida en escritorio (split-screen) y una carga limpia sin scroll excesivo en móvil (`360px`).

### Mejoras Obligatorias sobre la Fase 1
1. **Selector de perfil informativo (no engañoso):** Reemplazar el `radiogroup` actual por pestañas/chips de ayuda rápida (*"¿Con qué dato ingreso?"*) aclarando explícitamente que el sistema identifica el rol automáticamente al iniciar sesión.
2. **Enlace real a `/recuperar-clave`:** Sustituir el mensaje pasivo de *"Comunícate con Secretaría"* por un enlace directo `¿Olvidaste tu contraseña?` (manteniendo Secretaría solo como respaldo para quien no tenga correo registrado).
3. **Respeto a `?modulo=siga|aula`:** Al habilitar Fase 2 y Fase 3, actualizar `MODULE_HOME` en `src/modules/core/auth/redirects.ts` (`siga -> /siga/calificaciones` o `/dashboard`, `aula -> /aula`).
4. **Contraste AA en `DemoAccess`:** Usar botones con texto accesible (`--navy` sobre `--yellow` o variantes `-solid` para texto blanco) y mantener deshabilitado fuera de `localhost` / desarrollo.

### Reglas de Seguridad y Backend
- **Rate-limit dual:** bloquear por **IP** (ej. máx. 20 fallos en 15 min) y por **identificador** (backoff progresivo tras 5 fallos) usando el índice compuesto `audit_logs(action, entity_type, entity_id, created_at)`.
- **Protección anti-enumeración:** siempre ejecutar `verifyPassword` contra hash real o `getDummyHash()` y devolver un mensaje neutro único.
- **Auditoría:** registrar `USER_LOGIN` y `USER_LOGIN_FAILED` con IP confiable (cabecera sobrescrita por proxy inverso en producción).

---

## 2. `/recuperar-clave` — Recuperación Autónoma de Contraseña

### Flujo de 2 Pasos
1. **Solicitud (`/recuperar-clave`):**
   - Campo único: `Documento de identidad o correo electrónico`.
   - Respuesta siempre neutra: *"Si encontramos una cuenta activa con ese dato y correo registrado, enviaremos un enlace de restablecimiento válido por 15 minutos."*
   - Si el estudiante de Primaria/Preescolar no tiene correo propio, el sistema puede enviar el enlace al correo del acudiente principal registrado en `guardian_links` (o indicar contactar a Secretaría).
2. **Restablecimiento (`/recuperar-clave/[token]`):**
   - Valida el token hasheado (`SHA-256`) contra tabla `password_reset_tokens` (`expires_at > now` y `used_at IS NULL`).
   - Formulario: `Nueva contraseña` (mín. 8 caracteres, combinación recomendada con indicador visual) + `Confirmar contraseña`.
   - Al guardar (dentro de una transacción):
     1. Actualiza `users.password_hash` con `scrypt`.
     2. Marca `password_reset_tokens.used_at = now`.
     3. Ejecuta **`revokeAllUserSessions(userId)`** para cerrar todas las sesiones abiertas en cualquier dispositivo.
     4. Registra `PASSWORD_RESET` en `audit_logs`.

### Tabla Drizzle Requerida (`src/db/schema/core.ts`)
- `password_reset_tokens`: `id`, `user_id`, `token_hash` (único, SHA-256), `expires_at`, `used_at`, `requested_ip`, `created_at`.

---

## 3. `/matriculas` — Portal de Admisiones y Matrícula en Línea 2027

### Arquitectura de Flujo (4 Pasos Reales)
Evoluciona la *"Bitácora de admisión de 8 documentos"* del sitio Astro a un portal real conectado a `admission_applications` y `enrollment_documents`:

1. **Paso 1 — Tipo de familia y grado:**
   - **Familia Nueva:** crea un registro con correo/documento del acudiente y recibe código de seguimiento.
   - **Familia Lunita (Renovación):** enlaza con `/login?next=/matriculas` para precargar automáticamente los datos del estudiante y acudiente del año anterior.
   - Muestra **tabla clara de costos 2027, descuentos por pronto pago y canales habilitados** (Nequi, Daviplata, Bre-B, PSE/Tesorería).
2. **Paso 2 — Datos del estudiante y acudientes:**
   - Validación Zod (tipo/número de documento, EPS, RH, dirección, contactos de emergencia, responsable financiero).
   - **Casilla obligatoria Ley 1581 (Habeas Data):** aceptación explícita con lectura del enlace a la Política de Tratamiento de Datos de Menores (se guarda timestamp + IP + versión de la política).
3. **Paso 3 — Bitácora interactiva de los 8 documentos:**
   - Carga real (PDF/JPG/PNG, máx. 5 MB por archivo) con vista previa y estado por documento: `Pendiente`, `Subido`, `En revisión`, `Aprobado`, `Subsanar (con nota de Secretaría)`.
   - Almacenamiento en **Object Storage privado** (nunca en `public/`), validación de **magic bytes** y renombrado UUID.
4. **Paso 4 — Comprobante de pago y confirmación:**
   - Subida de soporte de pago o pasarela en línea → estado `En validación por Secretaría` → al aprobar, se genera la matrícula oficial (`enrollments`) y las credenciales/renovación de acceso al Campus.

---

## 4. `/verificar/[codigo]` — Verificador Público de Boletines y Certificados (QR)

### Reglas de Privacidad y Diseño
- Al escanear el código QR impreso en un boletín, constancia de estudio o paz y salvo, abre `/verificar/[codigo]`.
- Valida el formato (`^[A-Za-z0-9-]{6,64}$`) y consulta `report_cards` / `certificates` en servidor con rate-limit por IP (evitar fuerza bruta de códigos).
- **Qué muestra si es válido:**
  - Sello visual verde accesible (`Documento auténtico — Liceo Lunita de Chía`).
  - Tipo de documento (*Boletín Oficial*, *Constancia de Estudio*, *Paz y Salvo*).
  - Año lectivo, periodo y fecha exacta de emisión.
  - Nombre parcial/ofuscado o iniciales + últimos 4 dígitos del documento (cumpliendo Ley 1581 para no exponer información completa de menores al público).
- **Qué muestra si no existe o fue anulado:** aviso claro sin revelar si el código existió anteriormente, indicando contactar a Secretaría.
