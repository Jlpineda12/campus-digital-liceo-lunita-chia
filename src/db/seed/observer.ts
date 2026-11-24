import { and, count, eq } from "drizzle-orm";
import type { Database } from "../client";
import {
  academicPeriods,
  academicYears,
  enrollments,
  observerRecords,
  users,
} from "../schema";
import { COORDINATOR, DEMO_FAMILY, SPECIALISTS, TITULARS } from "./data";

/**
 * Anotaciones de demostración en el Observador para el año vigente.
 * Idempotente: si ya existen registros en `observer_records`, no inserta duplicados.
 */
export async function seedDemoObserver(db: Database): Promise<number> {
  const [existing] = await db.select({ total: count() }).from(observerRecords);
  if ((existing?.total ?? 0) > 0) return 0;

  const [year] = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1);
  if (!year) return 0;

  const [periods, allUsers, activeEnrollments] = await Promise.all([
    db.select().from(academicPeriods).where(eq(academicPeriods.academicYearId, year.id)),
    db.select({ id: users.id, documentNumber: users.documentNumber }).from(users),
    db
      .select({ id: enrollments.id, studentId: enrollments.studentId })
      .from(enrollments)
      .where(and(eq(enrollments.academicYearId, year.id), eq(enrollments.status, "ACTIVE"))),
  ]);

  const userByDoc = new Map(allUsers.map((u) => [u.documentNumber, u.id]));
  const enrollmentByStudent = new Map(activeEnrollments.map((e) => [e.studentId, e.id]));
  const periodByNum = new Map(periods.map((p) => [p.number, p.id]));

  const sofiaId = userByDoc.get(DEMO_FAMILY.children[0].person.documentNumber);
  const tomasId = userByDoc.get(DEMO_FAMILY.children[1].person.documentNumber);
  const lauraId = userByDoc.get(DEMO_FAMILY.guardian.documentNumber);
  const andresId = userByDoc.get(SPECIALISTS.MATEMATICAS.documentNumber);
  const dianaId = userByDoc.get(SPECIALISTS.CIENCIAS.documentNumber);
  const sandraId = userByDoc.get(TITULARS["3A"]!.documentNumber);
  const patriciaId = userByDoc.get(COORDINATOR.documentNumber);

  const sofiaEnr = sofiaId ? enrollmentByStudent.get(sofiaId) : undefined;
  const tomasEnr = tomasId ? enrollmentByStudent.get(tomasId) : undefined;

  const rows: Array<typeof observerRecords.$inferInsert> = [];
  const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

  if (sofiaEnr) {
    rows.push(
      {
        enrollmentId: sofiaEnr,
        periodId: periodByNum.get(3) ?? null,
        authorId: dianaId ?? null,
        category: "PRAISE",
        title: "Participación destacada en el equipo NASA Space Apps",
        description:
          "Sofía lideró la documentación científica y la exposición del prototipo de su equipo de séptimo grado, demostrando curiosidad investigativa y trabajo colaborativo.",
        guardianAcknowledgedAt: daysAgo(18),
        guardianAcknowledgedBy: lauraId ?? null,
        guardianComment: "¡Qué orgullo! Gracias por motivar a los chicos en estos proyectos.",
        createdAt: daysAgo(20),
      },
      {
        enrollmentId: sofiaEnr,
        periodId: periodByNum.get(4) ?? null,
        authorId: andresId ?? null,
        category: "ACADEMIC",
        title: "Seguimiento de entregas en talleres de álgebra",
        description:
          "Se registra entrega incompleta en el segundo taller del periodo. En clase demuestra comprensión del tema, pero requiere organizar mejor sus tiempos de entrega en el Aula Virtual.",
        commitment: "Entregar los ejercicios de refuerzo de ecuaciones el próximo viernes antes de la clase.",
        createdAt: daysAgo(3),
      },
    );
  }

  if (tomasEnr) {
    rows.push(
      {
        enrollmentId: tomasEnr,
        periodId: periodByNum.get(4) ?? null,
        authorId: sandraId ?? null,
        category: "PRAISE",
        title: "Compañerismo y liderazgo en lectura compartida",
        description:
          "Tomás apoyó con mucha paciencia a sus compañeros durante la jornada de lectura en voz alta y cuidó los materiales del salón al finalizar la actividad.",
        guardianAcknowledgedAt: daysAgo(5),
        guardianAcknowledgedBy: lauraId ?? null,
        guardianComment: "Gracias profe Sandra, lo felicitamos mucho en casa.",
        createdAt: daysAgo(6),
      },
      {
        enrollmentId: tomasEnr,
        periodId: periodByNum.get(4) ?? null,
        authorId: sandraId ?? null,
        category: "TYPE_I",
        title: "Manejo de turnos durante el descanso",
        description:
          "Se dialogó con Tomás y dos compañeros por una discusión durante un juego en el patio. Escucharon las indicaciones, ofrecieron disculpas y retomaron el juego con respeto.",
        studentStatement: "Me enojé porque no me pasaban el balón, pero ya hablé con mis amigos y prometo respetar los turnos.",
        studentStatementAt: daysAgo(2),
        commitment: "Respetar las reglas del juego y pedir ayuda a la profe ante cualquier desacuerdo.",
        createdAt: daysAgo(2),
      },
    );
  }

  // Una anotación Tipo II en otro estudiante para que Coordinación vea el flujo de escalamiento.
  const otherEnrollment = activeEnrollments.find((e) => e.id !== sofiaEnr && e.id !== tomasEnr);
  if (otherEnrollment) {
    rows.push({
      enrollmentId: otherEnrollment.id,
      periodId: periodByNum.get(4) ?? null,
      authorId: patriciaId ?? null,
      category: "TYPE_II",
      title: "Reiteración de conflicto verbal en cambio de clase",
      description:
        "Tras dos diálogos pedagógicos previos en aula, se cita a seguimiento en Coordinación de Convivencia para establecer plan de mejora y acompañamiento con la familia.",
      commitment: "Asistir a taller de resolución pacífica de conflictos y reunión con acudientes el lunes.",
      createdAt: daysAgo(1),
    });
  }

  if (rows.length === 0) return 0;
  await db.insert(observerRecords).values(rows);
  return rows.length;
}
