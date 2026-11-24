import { count, eq } from "drizzle-orm";
import { createDatabase, type Database } from "../client";
import {
  academicYears,
  circularReads,
  circulars,
  groups,
  levels,
  users,
} from "../schema";
import { loadScriptEnv } from "../scripts/env";

/**
 * Circulares institucionales y de grupo de demostración para Agenda y Circulares.
 * Idempotente: no duplica si ya existen registros en `circulars`.
 */
export async function seedDemoAgenda(db: Database): Promise<number> {
  const [existing] = await db.select({ total: count() }).from(circulars);
  if ((existing?.total ?? 0) > 0) return 0;

  const [year] = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1);
  if (!year) return 0;

  const [adminUser] = await db.select({ id: users.id }).from(users).where(eq(users.role, "ADMIN")).limit(1);
  const [coordUser] = await db.select({ id: users.id }).from(users).where(eq(users.role, "COORDINATOR")).limit(1);
  const [guardian] = await db.select({ id: users.id }).from(users).where(eq(users.email, "laura.castro@campus.lunita.test")).limit(1);

  const allLevels = await db.select({ id: levels.id, code: levels.code }).from(levels);
  const levelByCode = new Map(allLevels.map((l) => [l.code, l.id]));

  const [group7A] = await db
    .select({ id: groups.id, directorTeacherId: groups.directorTeacherId })
    .from(groups)
    .where(eq(groups.name, "7A"))
    .limit(1);

  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000);

  const rows: Array<typeof circulars.$inferInsert & { id: string }> = [
    {
      id: crypto.randomUUID(),
      title: "Habilitación de boletines del Tercer Periodo y jornada de entrega",
      bodySanitized:
        "Estimadas familias luniteras:\n\nRectoría ha habilitado la consulta en línea de los boletines oficiales del Tercer Periodo a través del módulo Boletines del Campus Digital.\n\nLes invitamos a revisarlos con sus hijos y confirmar su asistencia a la jornada presencial de retroalimentación académica el próximo viernes de 7:00 a. m. a 11:30 a. m. en las sedes de Chía.",
      targetScope: "ALL",
      authorId: adminUser?.id ?? null,
      publishedAt: daysAgo(1),
    },
    {
      id: crypto.randomUUID(),
      title: "Feria STHEAMI y Muestra de Robótica Lunita 2026",
      bodySanitized:
        "Nos complace invitar a toda la comunidad educativa a nuestra Feria STHEAMI 2026.\n\nLos estudiantes de Preescolar, Primaria y Bachillerato presentarán sus prototipos de ciencia, robótica, arte y territorio muisca. El ingreso para padres de familia será desde las 8:30 a. m. por la portería principal.",
      targetScope: "ALL",
      authorId: coordUser?.id ?? adminUser?.id ?? null,
      publishedAt: daysAgo(4),
    },
  ];

  const primariaId = levelByCode.get("PRIMARIA");
  if (primariaId) {
    rows.push({
      id: crypto.randomUUID(),
      title: "Salida pedagógica al Parque Jaime Duque — Básica Primaria",
      bodySanitized:
        "Apreciados padres de Básica Primaria:\n\nEl próximo miércoles realizaremos nuestra salida pedagógica de exploración científica y ambiental.\n\nPor favor enviar a los estudiantes con sudadera institucional, gorra, bloqueador solar y refrigerio ligero. La salida es a las 7:45 a. m. y el regreso al colegio a las 2:15 p. m.",
      targetScope: "LEVEL",
      targetLevelId: primariaId,
      authorId: coordUser?.id ?? adminUser?.id ?? null,
      publishedAt: daysAgo(2),
    });
  }

  if (group7A) {
    rows.push({
      id: crypto.randomUUID(),
      title: "Recordatorio de entrega del proyecto integrador de 7A",
      bodySanitized:
        "Familias y estudiantes de Séptimo A:\n\nRecuerden que el lunes iniciamos la socialización de los proyectos integradores de Ciencias y Tecnología.\n\nCada equipo debe traer su bitácora impresa o en el cuaderno y el prototipo listo para pruebas en laboratorio.",
      targetScope: "GROUP",
      targetGroupId: group7A.id,
      authorId: group7A.directorTeacherId ?? coordUser?.id ?? null,
      publishedAt: daysAgo(0),
    });
  }

  await db.transaction(async (tx) => {
    await tx.insert(circulars).values(rows);
    // Deja una circular ya leída por la acudiente demo para probar filtros Sin leer / Leídas.
    if (guardian && rows[1]) {
      await tx
        .insert(circularReads)
        .values({ circularId: rows[1].id, userId: guardian.id, readAt: daysAgo(3) })
        .onConflictDoNothing();
    }
  });

  return rows.length;
}

if (require.main === module) {
  loadScriptEnv();
  const db = createDatabase();
  seedDemoAgenda(db)
    .then((n) => console.log(`✔ Circulares demo creadas: ${n}`))
    .catch((err: unknown) => {
      console.error("✖ Error sembrando circulares:", err);
      process.exitCode = 1;
    })
    .finally(() => db.$client.end());
}
