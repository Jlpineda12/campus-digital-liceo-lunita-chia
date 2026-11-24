# Sección 05 — Portal de Coordinación Académica, Secretaría y Rectoría

**Roles autorizados:** `COORDINATOR` (Coordinación Académica y de Convivencia) y `ADMIN` (Secretaría Académica, Tesorería y Rectoría).  
**Etapa visual (`data-stage`):** Siempre **`institucional`** (máxima claridad operativa, tablas paginadas en servidor, filtros rápidos y trazabilidad completa).

---

## 1. Matriz de Permisos: Coordinación vs. Secretaría / Rectoría (`ADMIN`)

| Capacidad / Módulo | `COORDINATOR` | `ADMIN` (Secretaría / Rectoría) |
| :--- | :---: | :---: |
| Tablero ejecutivo, alertas académicas y de ausentismo | Sí | Sí |
| Aprobar / rechazar excusas de asistencia | Sí | Sí |
| Revisar Observador (Tipo I/II/III) y gestionar compromisos | Sí | Sí |
| Abrir ventana temporal de edición en periodos cerrados (auditado) | Sí | Sí |
| Configurar años lectivos, periodos, grados, grupos y cargas | Lectura / Edición académica | Control total |
| Emitir boletines masivos, constancias y configurar bloqueo por cartera | Consulta / Vista previa | Control total |
| Revisar y aprobar Matrículas 2027 y los 8 documentos | Consulta / Aprobación académica | Control total (crea matrícula) |
| Gestionar Usuarios, Roles, Vínculos familiares y Revocar sesiones | Solo consulta | Control total |
| Gestión de Cartera, Recibos y Paz y Salvos | No | Control total |
| Visor de Auditoría (`audit_logs`) | Eventos académicos/convivencia | Control total |
| Módulo de Migración SIGA / Moodle y Exportación SIMAT | No | Control total |

---

## 2. `/dashboard` — Tablero Ejecutivo para ~600 Personas

Diseñado con consultas paralelas (`Promise.all`) y sin recargar datos innecesarios:
1. **KPIs de pulso institucional:** Estudiantes activos, Docentes activos, Grupos abiertos, Tasa de asistencia del día, Solicitudes de matrícula 2027 en revisión.
2. **Centro de Alertas Accionables:**
   - Cargas académicas sin docente asignado (con enlace directo a `/admin/estructura`).
   - Docentes pendientes de completar notas cuando faltan ≤ 5 días para cerrar periodo.
   - Estudiantes en riesgo académico (≥ 3 áreas en desempeño `BAJO`) o ausentismo reiterado (≥ 3 fallas injustificadas en el mes).
   - Situaciones de convivencia `Tipo II` o `Tipo III` sin atención registrada.
3. **Control Rápido de Periodos y Ocupación por Nivel:**
   - Estado de los 4 periodos (`Abierto` / `Cerrado`) con acceso directo a gestión de cierre.
   - Ocupación por nivel (*Preescolar*, *Primaria*, *Bachillerato*) y tabla filtrable de grupos con director y cupo.

---

## 3. `/admin/estructura` — Estructura Académica y SIEE

Dividido en 4 pestañas limpias:
1. **Años Lectivos y Periodos:**
   - Crear/activar año lectivo (`2026`, `2027`), definir nota mínima aprobatoria (`3.5`), rangos SIEE y fechas de los 4 periodos + pesos porcentuales (validando suma = `100 %`).
   - **Cierre y Reapertura de Periodos:** botón `Cerrar periodo` (bloquea edición docente y habilita pre-generación de boletines) y botón `Reapertura temporal` (exige motivo obligatorio, fecha/hora de expiración y guarda registro inmutable `PERIOD_UNLOCKED` en `audit_logs`).
2. **Grados y Grupos:**
   - Gestión de los 14 grados (`Prejardín` a `Undécimo` con `simat_code` y `assessment_mode`: `QUALITATIVE` para Preescolar, `NUMERIC` para Primaria/Bachillerato).
   - Creación de grupos (`6A`, `6B`, etc.), asignación de cupo máximo y **Director(a) de Grupo**.
3. **Plan de Estudios y Pilares STHEAMI:**
   - Catálogo de asignaturas con código, horas semanales y pilar STHEAMI (`S, T, H, E, A, M, I`).
4. **Cargas Académicas (`course_assignments`):**
   - Matriz rápida *Grupo × Asignatura → Docente* con alerta visual de celdas sin docente y validación de carga horaria semanal por profesor.

---

## 4. `/admin/usuarios` — Gestión de Comunidad (~600+ Cuentas)

- **Tabla paginada en servidor** (25–50 filas por página) con búsqueda por nombre, documento o correo y filtro por rol (`STUDENT`, `GUARDIAN`, `TEACHER`, `COORDINATOR`, `ADMIN`) y estado (`Activo` / `Inactivo`).
- **Ficha de usuario y acciones seguras:**
  - Crear / editar datos básicos y documento de identidad.
  - **Vínculos familiares (`guardian_links`):** asociar uno o varios hijos a un acudiente, marcar `is_financial_responsible` y `can_pick_up`.
  - **Restablecimiento de acceso:** generar enlace temporal de `/recuperar-clave` o contraseña temporal de un solo uso (obligando cambio al primer ingreso).
  - **Desactivar cuenta / Cerrar todas sus sesiones:** al desactivar `is_active = false` o pulsar `Revocar sesiones`, se ejecuta inmediatamente `revokeAllUserSessions(userId)` y se audita.

---

## 5. `/admin/matriculas` — Bandeja de Admisiones y Matrículas 2027

- **Vista por estados (tipo pipeline):** `Borrador`, `Enviada`, `Revisión de documentos`, `Pago por validar`, `Aprobada / Matriculada`.
- **Panel de revisión de solicitud:**
  - Datos del aspirante/estudiante, si es `Familia Nueva` o `Renovación`, grado solicitado y consentimiento registrado de **Ley 1581 (Habeas Data)**.
  - **Visor de los 8 documentos obligatorios:** descarga/vista segura mediante endpoint autenticado (nunca URL pública), con botones `Aprobar` o `Solicitar subsanación` (comentario que llega al acudiente para volver a subir solo ese archivo).
  - Validación de comprobante de pago → botón **`Aprobar y Formalizar Matrícula`** que, en una sola transacción:
    1. Crea o actualiza el `user` estudiante y acudiente + `guardian_links`.
    2. Crea el registro en `enrollments` asignando grupo y verificando cupo disponible.
    3. Registra `ENROLLMENT_APPROVED` en `audit_logs`.

---

## 6. Gestión de Boletines Masivos, Cartera y Auditoría

- **Emisión Masiva de Boletines (`/siga/boletines` vista Admin):**
  - Seleccionar periodo cerrado + grupo (o todo el colegio) → cola controlada de generación y caché de PDFs en Object Storage (evitando picos de CPU/RAM cuando 300 familias entren a descargar).
  - Control de switch institucional: `Restringir descarga a familias con mora vencida` + excepciones individuales por `Acuerdo de pago`.
- **Gestión de Cartera (`/siga/cartera` vista Admin):**
  - Generación masiva de cobros mensuales por grado, conciliación de pagos reportados (Nequi, Daviplata, Bre-B, PSE, Tesorería), aplicación de descuentos (hermanos, pronto pago) y emisión de recibos / paz y salvos.
- **Visor de Auditoría (`/admin/auditoria`):**
  - Consulta paginada de `audit_logs` con filtros por fecha, acción (`GRADE_UPDATED`, `PERIOD_UNLOCKED`, `USER_LOGIN_FAILED`, `OBSERVER_CREATED`, `ENROLLMENT_APPROVED`), actor e IP, mostrando el `beforeJson` vs. `afterJson`.

---

## 7. `/admin/migracion` — Importadores SIGA / Moodle y Exportador SIMAT

Asistente guiado en 4 pasos (*Subir archivo → Mapear columnas → Vista previa y validación Zod → Confirmar e importar en transacción*):
1. **Importador SIGA (Excel/CSV):**
   - Plantillas descargables para: Estudiantes + Acudientes, Cargas académicas, Sábanas históricas de notas y Carga masiva de **boletines históricos en PDF** vinculados por documento y año lectivo.
2. **Importador Moodle (`.mbz`, Moodle XML, CSV):**
   - Extrae unidades temáticas y recursos PDF de backups `.mbz` (descartando categorías obsoletas como `ADMISIONES 2023` y normalizando nombres como `Trasición` → `Transición`) e importa bancos de preguntas en formato Moodle XML.
3. **Exportador SIMAT:**
   - Genera archivo plano CSV/Excel validado con los códigos `simat_code` (`-2` a `11`), documentos de identidad, grados y estado de matrícula listos para reporte oficial ante el Ministerio de Educación Nacional.
4. **Acta de Conciliación:** reporte automático al final de cada importación con filas creadas, actualizadas, deduplicadas por documento y filas rechazadas con explicación exacta.
