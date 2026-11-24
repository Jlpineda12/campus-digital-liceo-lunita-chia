# Sección 03 — Portal de Padres y Acudientes

**Rol autorizado:** `GUARDIAN`  
**Etapa visual (`data-stage`):** Marco general **`institucional`** (claro, confiable y profesional para boletines, pagos, excusas y firmas) + zona académica del hijo adaptada automáticamente a **`primaria`** o **`bachillerato`** según el hijo elegido en `ChildSwitcher`.  
**Aislamiento RBAC:** Solo puede consultar estudiantes vinculados y activos en `guardian_links`. Toda acción sobre un estudiante valida `canAccessStudent(actor, studentId)` en servidor.

---

## 1. Experiencia Multi-Hijo (`ChildSwitcher`)

Un acudiente puede tener hijos en etapas distintas (como en el seed: **Tomás en 3A Primaria** y **Sofía en 7A Bachillerato**):
- **En el encabezado (`ChildSwitcher`):** selector visible en escritorio y móvil con foco accesible (`focus-within` visible), mostrando nombre, grado y etapa.
- **En `/dashboard` (`GuardianChildren`):** tarjetas horizontales compactas con indicador de estado rápido de cada hijo (ej. `"Al día"`, `"1 anotación por firmar"`, `"2 tareas para mañana"`) para ver a todos los hijos de un vistazo antes de entrar al detalle de uno.
- Al cambiar de hijo, toda la vista (`/dashboard`, `/siga/*`, `/aula/tareas`) se actualiza en servidor manteniendo la preferencia segura en cookie HTTP-only.

---

## 2. Secciones y Flujos Clave del Acudiente

### A. `/dashboard` — Centro de Seguimiento Familiar
1. **Bandeja de Atención Inmediata (solo aparece si hay pendientes):**
   - Anotaciones del Observador pendientes de confirmación (*Enterado*).
   - Inasistencias o retardos de la semana sin excusa radicada.
   - Circular institucional pendiente de lectura o pensión próxima a vencer.
2. **Selector de Hijos (`GuardianChildren`)** con resumen por hijo.
3. **Panel del Hijo Activo (hereda `data-stage` del nivel del hijo):**
   - Resumen rápido: Asistencia del periodo, Promedio SIEE (o avance cualitativo en Preescolar), Tareas próximas a vencer y Director(a) de grupo.
   - Accesos de 1 clic: `Ver calificaciones`, `Descargar último boletín`, `Radicar excusa`, `Ver cartera`.
   - Grilla de asignaturas del hijo con docente y acceso de solo-lectura a las tareas/guías del curso.

### B. `/siga/calificaciones` y `/siga/boletines`
- Consulta en tiempo real de las notas parciales de cada periodo (incluyendo cuáles provienen del Aula Virtual y comentarios del docente).
- **Descarga de Boletines PDF + QR** por año lectivo y periodo, incluyendo **boletines históricos migrados del SIGA anterior**.
- Si existe restricción por cartera activa configurada por Secretaría, muestra un aviso respetuoso con enlace directo a `/siga/cartera` (sin pantallas de error rotas).

### C. `/siga/observador` — Seguimiento y Firma de Enterado
- Visualiza todas las felicitaciones, seguimientos académicos y anotaciones de convivencia del hijo, incluyendo los descargos que haya escrito el estudiante.
- **Acción principal del acudiente:** botón **`Confirmar lectura (Enterado)`** + campo opcional de comentario/compromiso familiar.
- Al confirmar, se registra `guardian_acknowledged_at`, `guardian_acknowledged_by` e IP en `observer_records` y `audit_logs`, cerrando la alerta pendiente.

### D. `/siga/asistencia` — Asistencia y Radicación de Excusas
- Calendario y resumen de fallas/retardos del hijo.
- **Formulario de radicación de excusa:**
  - Seleccionar fecha(s) o clase(s), motivo (*Incapacidad médica*, *Calamidad doméstica*, *Representación institucional/Banda*, *Otro*) y adjuntar soporte (PDF o foto de incapacidad, guardado en storage privado).
  - Estado trazable: `Radicada` → `Aprobada por Coordinación` / `Rechazada (con motivo)`.

### E. `/aula/tareas` y `/aula` — Acompañamiento en el Aula Virtual (Solo Lectura)
- El padre puede ver **qué tareas tiene su hijo**, las instrucciones, la fecha límite y si ya fueron entregadas o calificadas.
- **Regla estricta:** El acudiente **no** puede enviar entregas ni responder cuestionarios en nombre del estudiante (solo lectura).

### F. `/siga/cartera` — Estado de Cuenta, Pagos y Paz y Salvo
- Visible si el acudiente tiene `is_financial_responsible = true` (o permiso familiar configurado).
- Muestra:
  - Resumen de matrícula y mensualidades (enero–noviembre) con estado (`Pagado`, `Pendiente`, `Vencido`, `Acuerdo de pago`).
  - Descuentos aplicados (hermanos, pronto pago) e historial de recibos descargables en PDF.
  - Botón para subir comprobante de transferencia (Nequi, Daviplata, Bre-B) o pagar por pasarela en línea.
  - Descarga automática de **Paz y Salvo PDF con QR** cuando no existan saldos vencidos.

### G. `/siga/agenda` y Renovación de Matrícula
- **Circulares:** listado con etiqueta `Nueva` y botón `Marcar como leída` (Secretaría puede ver porcentaje de lectura por grupo).
- **Renovación de Matrícula 2027:** cuando `academic_years.enrollment_open = true`, muestra un banner directo para iniciar la renovación con datos precargados del hijo.
