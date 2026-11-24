import { count } from "drizzle-orm";
import { hashPassword } from "../../modules/core/auth/password";
import { createDatabase, type Database } from "../client";
import {
  academicPeriods,
  academicYears,
  courseAssignments,
  enrollments,
  grades,
  groups,
  guardianLinks,
  levels,
  subjects,
  users,
} from "../schema";
import { loadScriptEnv } from "../scripts/env";
import { seedDemoAgenda } from "./agenda";
import { seedDemoAttendance } from "./attendance";
import { seedDemoAula } from "./aula";
import { seedDemoGrades } from "./grades";
import { seedDemoLogros } from "./logros";
import { seedDemoObserver } from "./observer";
import { seedDemoReportCards } from "./report-cards";
import {
  ACADEMIC_YEARS,
  ADMIN,
  BACHILLERATO_DIRECTORS,
  COORDINATOR,
  DEMO_FAMILY,
  FIRST_NAMES,
  GRADES,
  LAST_NAMES,
  LEVELS,
  SPECIALISTS,
  STUDENTS_PER_GROUP,
  SUBJECTS,
  TITULARS,
  type PersonSeed,
  type Specialty,
} from "./data";

type NewUser = typeof users.$inferInsert;
type Role = NewUser["role"];

const DEFAULT_DEMO_PASSWORD = "Lunita2026!";

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export async function runSeed(db: Database): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("El seed de demostración no puede ejecutarse en producción.");
  }

  const [existing] = await db.select({ total: count() }).from(users);
  if ((existing?.total ?? 0) > 0) {
    console.log("ℹ La base de datos ya tiene usuarios. Usa `npm run db:reset` para recrearla.");
    return;
  }

  // Un solo hash para todas las cuentas semilla: el seed es exclusivo de desarrollo.
  const passwordHash = await hashPassword(process.env.SEED_DEMO_PASSWORD ?? DEFAULT_DEMO_PASSWORD);
  const newUser = (person: PersonSeed, role: Role): NewUser & { id: string } => ({
    id: crypto.randomUUID(),
    ...person,
    email: person.email.toLowerCase(),
    passwordHash,
    role,
  });

  /* Niveles y grados ------------------------------------------------------ */
  const levelRows = LEVELS.map((l) => ({ id: crypto.randomUUID(), ...l }));
  const levelIdByCode = new Map(levelRows.map((l) => [l.code, l.id]));

  const gradeRows = GRADES.map((g, index) => ({
    id: crypto.randomUUID(),
    levelId: levelIdByCode.get(g.level)!,
    name: g.name,
    displayOrder: index + 1,
    simatCode: String(g.number),
    assessmentMode: g.assessmentMode,
  }));

  /* Años lectivos y periodos ---------------------------------------------- */
  const yearRows = ACADEMIC_YEARS.map((y) => ({
    id: crypto.randomUUID(),
    year: y.year,
    name: y.name,
    isCurrent: y.isCurrent,
    enrollmentOpen: y.enrollmentOpen,
    startDate: y.startDate,
    endDate: y.endDate,
  }));
  const periodRows = ACADEMIC_YEARS.flatMap((y, i) =>
    y.periods.map((p) => ({
      academicYearId: yearRows[i]!.id,
      number: p.number,
      name: p.name,
      weightPercent: 100 / y.periods.length,
      gradesLocked: p.locked,
      startDate: p.startDate,
      endDate: p.endDate,
    })),
  );
  const currentYear = yearRows.find((y) => y.isCurrent)!;

  /* Asignaturas ----------------------------------------------------------- */
  const subjectRows = SUBJECTS.map((s) => ({
    id: crypto.randomUUID(),
    name: s.name,
    code: s.code,
    stheamiPillar: s.pillar,
    weeklyHours: s.weeklyHours,
  }));
  const subjectIdByCode = new Map(subjectRows.map((s) => [s.code, s.id]));

  /* Personal ------------------------------------------------------------- */
  const coordinator = newUser(COORDINATOR, "COORDINATOR");
  const admin = newUser(ADMIN, "ADMIN");
  const specialistUsers = new Map<Specialty, NewUser & { id: string }>(
    (Object.entries(SPECIALISTS) as Array<[Specialty, PersonSeed]>).map(([key, person]) => [
      key,
      newUser(person, "TEACHER"),
    ]),
  );
  const titularUsers = new Map(
    Object.entries(TITULARS).map(([groupName, person]) => [groupName, newUser(person, "TEACHER")]),
  );

  /* Grupos del año en curso ---------------------------------------------- */
  const groupSeeds = GRADES.map((g, index) => {
    const directorSpecialty = BACHILLERATO_DIRECTORS[g.groupName];
    const director = directorSpecialty
      ? specialistUsers.get(directorSpecialty)
      : titularUsers.get(g.groupName);
    return {
      gradeNumber: g.number,
      row: {
        id: crypto.randomUUID(),
        academicYearId: currentYear.id,
        gradeId: gradeRows[index]!.id,
        name: g.groupName,
        directorTeacherId: director?.id ?? null,
        capacity: g.level === "PREESCOLAR" ? 20 : 30,
      } satisfies typeof groups.$inferInsert,
    };
  });
  const groupRows = groupSeeds.map((g) => ({ ...g.row, gradeNumber: g.gradeNumber }));
  const groupByName = new Map(groupRows.map((g) => [g.name, g]));

  /* Cargas académicas ----------------------------------------------------- */
  const assignmentRows = groupRows.flatMap((group) =>
    SUBJECTS.filter((s) => group.gradeNumber >= s.fromGrade && group.gradeNumber <= s.toGrade).map(
      (s) => {
        const byTitular = s.titularUpToGrade !== undefined && group.gradeNumber <= s.titularUpToGrade;
        const teacher = byTitular
          ? titularUsers.get(group.name)
          : s.specialty
            ? specialistUsers.get(s.specialty)
            : undefined;
        return {
          academicYearId: currentYear.id,
          groupId: group.id,
          subjectId: subjectIdByCode.get(s.code)!,
          teacherId: teacher?.id ?? null,
        };
      },
    ),
  );

  /* Estudiantes, acudientes y matrículas ---------------------------------- */
  const studentUsers: Array<NewUser & { id: string }> = [];
  const guardianUsers: Array<NewUser & { id: string }> = [];
  const enrollmentRows: Array<typeof enrollments.$inferInsert> = [];
  const linkRows: Array<typeof guardianLinks.$inferInsert> = [];

  const demoGuardian = newUser(DEMO_FAMILY.guardian, "GUARDIAN");
  guardianUsers.push(demoGuardian);
  const demoChildrenByGroup = new Map<string, PersonSeed[]>();
  for (const child of DEMO_FAMILY.children) {
    const list = demoChildrenByGroup.get(child.groupName) ?? [];
    list.push(child.person);
    demoChildrenByGroup.set(child.groupName, list);
  }

  let sequence = 0;
  for (const group of groupRows) {
    const demoChildren = demoChildrenByGroup.get(group.name) ?? [];
    const generated = Array.from({ length: STUDENTS_PER_GROUP - demoChildren.length }, () => {
      sequence += 1;
      const first = FIRST_NAMES[(sequence * 7) % FIRST_NAMES.length]!;
      const last1 = LAST_NAMES[(sequence * 5) % LAST_NAMES.length]!;
      const last2 = LAST_NAMES[(sequence * 11 + 3) % LAST_NAMES.length]!;
      const documentNumber = String(1070000100 + sequence);
      return {
        documentType: group.gradeNumber <= 0 ? "RC" : "TI",
        documentNumber,
        firstName: first,
        lastName: `${last1} ${last2}`,
        email: `${slug(first)}.${slug(last1)}.${documentNumber.slice(-3)}@campus.lunita.test`,
      } satisfies PersonSeed;
    });

    for (const person of [...demoChildren, ...generated]) {
      const student = newUser(person, "STUDENT");
      studentUsers.push(student);
      enrollmentRows.push({
        studentId: student.id,
        academicYearId: currentYear.id,
        groupId: group.id,
        status: "ACTIVE",
        enrollmentType: group.gradeNumber === -2 ? "NEW" : "RENEWAL",
      });

      if (demoChildren.includes(person)) {
        linkRows.push({
          guardianId: demoGuardian.id,
          studentId: student.id,
          relationship: "MADRE",
          isFinancialResponsible: true,
          canPickUp: true,
        });
        continue;
      }

      const isMother = studentUsers.length % 2 === 0;
      const guardianFirst = isMother ? "María" : "Carlos";
      const guardianLast = person.lastName.split(" ")[isMother ? 1 : 0] ?? person.lastName;
      const guardianDoc = String(52000100 + studentUsers.length);
      const guardian = newUser(
        {
          documentType: "CC",
          documentNumber: guardianDoc,
          firstName: guardianFirst,
          lastName: `${guardianLast} Acudiente`,
          email: `acudiente.${guardianDoc}@campus.lunita.test`,
        },
        "GUARDIAN",
      );
      guardianUsers.push(guardian);
      linkRows.push({
        guardianId: guardian.id,
        studentId: student.id,
        relationship: isMother ? "MADRE" : "PADRE",
        isFinancialResponsible: true,
        canPickUp: true,
      });
    }
  }

  if (!groupByName.has("7A") || !groupByName.has("3A")) {
    throw new Error("Los grupos de la familia de demostración no existen en el catálogo.");
  }

  /* Inserción transaccional ------------------------------------------------ */
  await db.transaction(async (tx) => {
    await tx.insert(levels).values(levelRows);
    await tx.insert(grades).values(gradeRows);
    await tx.insert(academicYears).values(yearRows);
    await tx.insert(academicPeriods).values(periodRows);
    await tx.insert(subjects).values(subjectRows);
    await tx
      .insert(users)
      .values([
        coordinator,
        admin,
        ...specialistUsers.values(),
        ...titularUsers.values(),
        ...studentUsers,
        ...guardianUsers,
      ]);
    await tx.insert(groups).values(groupSeeds.map((g) => g.row));
    await tx.insert(courseAssignments).values(assignmentRows);
    await tx.insert(enrollments).values(enrollmentRows);
    await tx.insert(guardianLinks).values(linkRows);
  });

  const gradeCount = await seedDemoGrades(db);
  const logrosCount = await seedDemoLogros(db);
  const observerCount = await seedDemoObserver(db);
  const attendanceCounts = await seedDemoAttendance(db);
  const reportCardCount = await seedDemoReportCards(db);
  const agendaCount = await seedDemoAgenda(db);
  const aulaCounts = await seedDemoAula(db);

  console.log("✔ Seed institucional creado:");
  console.table({
    niveles: levelRows.length,
    grados: gradeRows.length,
    "años lectivos": yearRows.length,
    periodos: periodRows.length,
    asignaturas: subjectRows.length,
    docentes: specialistUsers.size + titularUsers.size,
    grupos: groupRows.length,
    "cargas académicas": assignmentRows.length,
    estudiantes: studentUsers.length,
    acudientes: guardianUsers.length,
    "notas de demostración": gradeCount,
    "logros pedagógicos": logrosCount,
    "anotaciones observador": observerCount,
    "registros asistencia": attendanceCounts.logs,
    "excusas demo": attendanceCounts.excuses,
    "boletines emitidos": reportCardCount,
    "circulares agenda": agendaCount,
    "unidades aula virtual": aulaCounts.units,
    "tareas aula virtual": aulaCounts.activities,
  });
  console.log(
    "ℹ Cuentas demo por rol: ver src/modules/core/auth/demo.ts (contraseña: SEED_DEMO_PASSWORD).",
  );
}

if (require.main === module) {
  loadScriptEnv();
  const db = createDatabase();
  runSeed(db)
    .catch((error: unknown) => {
      console.error("✖ Error ejecutando el seed:", error);
      process.exitCode = 1;
    })
    .finally(() => db.$client.end());
}
