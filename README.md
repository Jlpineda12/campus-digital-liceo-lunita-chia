# Campus Digital — Liceo Lunita de Chía (SIGA + Aula Virtual + Matrículas)

Plataforma académica, administrativa y de aprendizaje virtual unificada para el **Liceo Lunita de Chía**, diseñada para reemplazar, personalizar y elevar a nivel profesional tanto el **SIGA** actual (`siga.liceolunita.edu.co`) como el **Aula Virtual Moodle** (`26.aula2021.liceolunita.edu.co`).

---

## Propósito del Proyecto

1. **Unificar la experiencia escolar en un solo Campus Digital:** un único inicio de sesión y una sola base de datos para **Estudiantes**, **Padres/Acudientes**, **Docentes**, **Coordinación** y **Secretaría/Rectoría**.
2. **Conectar el Aula Virtual con el SIGA en tiempo real:** las tareas, entregas y cuestionarios calificados en el Aula Virtual alimentan automáticamente la planilla de notas del periodo según el **SIEE** del colegio.
3. **Mantener independencia respecto al sitio web informativo:** este proyecto se construye de forma independiente al repositorio del sitio público en Astro ([prototipo-pagina-web-liceo-lunita-de-chia](https://jlpineda12.github.io/prototipo-pagina-web-liceo-lunita-de-chia/)), pero comparte al 100 % su identidad visual táctil 3D, paleta cósmica y modelo **STHEAMI** para unirlos limpiamente al desplegar en el servidor.
4. **Garantizar migración sin pérdida de datos:** soporte nativo para importar historial académico, matrículas y boletines desde el SIGA anterior y cursos/recursos/bancos de preguntas desde Moodle.

---

## Mapa de Documentación del Proyecto (`.md`)

| Archivo | Contenido Principal |
| :--- | :--- |
| [`ARQUITECTURA.md`](./ARQUITECTURA.md) | Arquitectura modular (**Core**, **SIGA**, **Aula Virtual**, **Matrículas**, **Migración**), stack tecnológico, estructura de carpetas, modelo de base de datos relacional y puntos de unión con la web Astro. |
| [`REGLAS.md`](./REGLAS.md) | Reglas obligatorias de negocio escolar (SIEE, Decreto 1290, SIMAT, STHEAMI, Ley 1581), **ciberseguridad**, **rendimiento para ~600 personas**, accesibilidad WCAG 2.2 AA y código. |
| [`SISTEMA_DISENO.md`](./SISTEMA_DISENO.md) | **Sistema Visual Dual** (`primaria` infantil/táctil 3D vs. `bachillerato` serio/editorial vs. `institucional`), tokens accesibles WCAG AA y paleta STHEAMI. |
| [`PLAN_MIGRACION_Y_FASES.md`](./PLAN_MIGRACION_Y_FASES.md) | Plan de desarrollo en 5 fases (desde el MVP hasta producción) y protocolo técnico para migrar datos desde el SIGA PHP actual y Moodle 5.1. |
| [`AUDITORIA_FASE1_Y_PLAN.md`](./AUDITORIA_FASE1_Y_PLAN.md) | Auditoría completa de la Fase 1 (código, ciberseguridad, escalabilidad y UX/UI) + **Paso 0** de hardening y plan detallado sección por sección. |

### Planos por Sección y Rol (`docs/secciones/`)

| Archivo | Sección / Rol Cubierto |
| :--- | :--- |
| [`docs/secciones/01_PUBLICO_Y_ACCESO.md`](./docs/secciones/01_PUBLICO_Y_ACCESO.md) | Rutas públicas (`/login`, `/recuperar-clave`, `/matriculas`, `/verificar/[codigo]`), rate-limit dual y Ley 1581. |
| [`docs/secciones/02_PORTAL_ESTUDIANTES.md`](./docs/secciones/02_PORTAL_ESTUDIANTES.md) | Portal de **Estudiantes** con Tema Dual (**Primaria** lúdico vs. **Bachillerato** serio), tareas, cursos, notas y descargos. |
| [`docs/secciones/03_PORTAL_ACUDIENTES.md`](./docs/secciones/03_PORTAL_ACUDIENTES.md) | Portal de **Padres/Acudientes**: selector multi-hijo, boletines PDF+QR, firma *Enterado* en observador, excusas y cartera. |
| [`docs/secciones/04_PORTAL_DOCENTES.md`](./docs/secciones/04_PORTAL_DOCENTES.md) | Portal de **Docentes y Directores de Grupo**: planilla SIEE tipo hoja de cálculo, asistencia móvil < 30s, Aula Virtual y dirección de grupo. |
| [`docs/secciones/05_PORTAL_ADMINISTRACION.md`](./docs/secciones/05_PORTAL_ADMINISTRACION.md) | Portal de **Coordinación, Secretaría y Rectoría**: tablero 600 personas, estructura, usuarios, matrículas 2027, cartera, auditoría y migración/SIMAT. |
| [`docs/secciones/06_MODULO_SIGA.md`](./docs/secciones/06_MODULO_SIGA.md) | Especificación técnica del **SIGA**: submódulos, tablas Drizzle, índices, motor SIEE y boletines PDF cacheados con cenefa Muisca y QR. |
| [`docs/secciones/07_MODULO_AULA_VIRTUAL.md`](./docs/secciones/07_MODULO_AULA_VIRTUAL.md) | Especificación técnica del **Aula Virtual**: tablas Drizzle, sanitización XSS, quizzes en sala de sistemas y puente transaccional `grade-sync` → SIGA. |

---

## Puntos de Integración Futura con el Sitio Web en Astro

El sitio informativo en Astro tiene actualmente tres puntos de salida hacia plataformas externas (en *Inicio → Accesos rápidos*, `/comunidad/`, `/admisiones/`, buscador `Ctrl+K` y menú móvil). Cuando el Campus Digital se despliegue en el servidor, solo se actualizarán esas tres URLs:

| Acceso en la Web Informativa (Astro) | URL Anterior | Nueva Ruta en Campus Digital |
| :--- | :--- | :--- |
| **Plataforma SIGA** (Notas, boletines, observador, asistencia, pagos) | `https://siga.liceolunita.edu.co/inicio/panel/index.php` | `/login` → `/siga` (o `/dashboard`) |
| **Aula Virtual** (Cursos, guías, tareas y evaluaciones) | `https://aula2021.liceolunita.edu.co/` | `/login` → `/aula` |
| **Matrícula en línea 2027** (Admisiones y carga de los 8 documentos) | `https://siga.liceolunita.edu.co/inicio/matricula/` | `/matriculas` |

---

## Desarrollo Local

Requisitos: Node.js 22.12 o superior (probado con Node 26) y **PostgreSQL 18** (el mismo motor de producción).

```bash
# 1. PostgreSQL local (macOS con Homebrew; queda como servicio que inicia con la sesión)
brew install postgresql@18
brew services start postgresql@18
/opt/homebrew/opt/postgresql@18/bin/psql -h localhost -d postgres -c "CREATE ROLE campus LOGIN PASSWORD 'campus_dev'"
/opt/homebrew/opt/postgresql@18/bin/createdb -h localhost -O campus campus_lunita

# 2. Proyecto
npm install
cp .env.example .env.local   # DATABASE_URL ya apunta a la base local anterior
npm run db:reset             # vacía la base LOCAL, aplica migraciones y carga el seed institucional
npm run dev                  # http://localhost:3000 → /login
```

En Linux/Windows sirve cualquier PostgreSQL 16+ (paquete del sistema o Docker) con el mismo usuario y base.

| Script | Uso |
| :--- | :--- |
| `npm run dev` / `build` / `start` | Servidor de desarrollo, build y servidor de producción. |
| `npm run typecheck` · `lint` · `test` | TypeScript estricto, ESLint y pruebas unitarias del dominio (`node:test`). |
| `npm run db:generate` | Genera una migración SQL en `drizzle/` tras cambiar `src/db/schema/`. |
| `npm run db:migrate` · `db:seed` · `db:reset` | Aplica migraciones, carga el seed o recrea la base local desde cero. |
| `npm run db:studio` | Explorador visual de la base de datos (Drizzle Studio). |

**Cuentas de demostración:** con `DEMO_LOGIN_ENABLED=true`, `/login` muestra accesos rápidos para los 5 roles (siempre deshabilitados en producción). Los documentos de cada cuenta están en `src/modules/core/auth/demo.ts` y la contraseña común en `SEED_DEMO_PASSWORD`.

**Disco exFAT / memoria USB:** macOS crea archivos `._*` (AppleDouble) junto a cada archivo, y algunas herramientas (drizzle-kit, la caché de Turbopack en `.next/`) fallan al leerlos. Por eso:
- `npm run clean:appledouble` los elimina, y los scripts `dev`, `build`, `db:generate` y `test` ya lo ejecutan;
- TypeScript y ESLint ignoran `._*` por configuración;
- los datos de PostgreSQL viven en el disco interno (`/opt/homebrew/var/postgresql@18`), no en el USB.

**Producción:** `DATABASE_URL` debe apuntar a un pooler (PgBouncer, Neon o Supabase en modo transacción) con `?sslmode=require`; ajustar `DATABASE_POOL_MAX` por instancia. Configurar también `APP_URL` y `SMTP_URL` (ver `.env.example`).

---

## Stack Base

- **Framework Full-Stack:** Next.js (App Router) + TypeScript
- **Estilos y UI:** Tailwind CSS + Sistema de Componentes Táctiles Lunita + TanStack Table
- **ORM y Base de Datos:** Drizzle ORM + PostgreSQL 18 en desarrollo y producción (driver `pg` con pool de conexiones; un solo esquema `pg-core`)
- **Autenticación y Permisos:** Sesiones seguras HTTP-only + RBAC de 5 roles + Auditoría de notas
- **Archivos y Documentos:** Almacenamiento S3 / Cloudflare R2 + Generador de Boletines y Certificados PDF con código QR verificable
