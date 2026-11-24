import { and, count, eq } from "drizzle-orm";
import { createDatabase, type Database } from "../client";
import {
  academicYears,
  admissionApplications,
  billingCharges,
  billingPayments,
  enrollmentDocuments,
  enrollments,
  grades,
  groups,
  levels,
  users,
} from "../schema";
import { loadScriptEnv } from "../scripts/env";
import { ADMISSION_DOC_KEYS, calculateAdmissionFees, FEE_SCHEDULE_2027 } from "@/modules/matriculas/catalog";
import { SCHOOL_MONTH_LABELS } from "@/modules/siga/cartera/calculator";

/**
 * Siembra idempotente de Fase 4:
 * - 3 solicitudes de admisión 2027 (`ADM-2027-DEMO01..03`) con su bitácora de 8 documentos.
 * - Cartera 2026 (Matrícula + Pensiones Feb–Nov) con pagos de ejemplo (Sofía al día, Tomás con saldo Nov).
 */
export async function seedDemoFase4(db: Database): Promise<{ applications: number; charges: number }> {
  let applicationsCreated = 0;
  let chargesCreated = 0;

  // 1. Solicitudes de Matrícula 2027
  const [existingApps] = await db.select({ total: count() }).from(admissionApplications);
  if ((existingApps?.total ?? 0) === 0) {
    const allGrades = await db
      .select({ id: grades.id, name: grades.name, levelCode: levels.code })
      .from(grades)
      .innerJoin(levels, eq(levels.id, grades.levelId));

    const gPrimero = allGrades.find((g) => g.name === "Primero") ?? allGrades[0];
    const gOctavo = allGrades.find((g) => g.name === "Octavo") ?? allGrades[0];
    const gPrejardin = allGrades.find((g) => g.name === "Prejardín") ?? allGrades[0];

    if (gPrimero && gOctavo && gPrejardin) {
      const f1 = calculateAdmissionFees({ levelCode: gPrimero.levelCode, hasEarlyBirdDiscount: true });
      const f2 = calculateAdmissionFees({ levelCode: gOctavo.levelCode, hasEarlyBirdDiscount: true, hasSiblingDiscount: true });
      const f3 = calculateAdmissionFees({ levelCode: gPrejardin.levelCode });

      const demoApps = [
        {
          trackingCode: "ADM-2027-DEMO01",
          applicationType: "NEW" as const,
          status: "DOCS_REVIEW" as const,
          targetGradeId: gPrimero.id,
          studentFirstName: "Luciana",
          studentLastName: "Vargas Nieto",
          studentDocType: "RC" as const,
          studentDocNumber: "1072991001",
          studentBirthDate: "2020-05-14",
          studentEps: "Sanitas",
          studentBloodType: "O+",
          previousSchool: "Jardín Infantil Pequeños Pasos Chía",
          guardianFirstName: "Marcela",
          guardianLastName: "Nieto Ruiz",
          guardianDocType: "CC" as const,
          guardianDocNumber: "52987654",
          guardianEmail: "marcela.nieto@correo.test",
          guardianPhone: "3104458821",
          address: "Vereda Fonquetá, Chía",
          hasEarlyBirdDiscount: true,
          hasSiblingDiscount: false,
          estimatedEnrollmentCop: f1.enrollmentFinal,
          estimatedMonthlyCop: f1.monthlyFinal,
          habeasDataAcceptedAt: new Date(),
          reviewNotes: "Pendiente validar certificado médico.",
        },
        {
          trackingCode: "ADM-2027-DEMO02",
          applicationType: "RENEWAL" as const,
          status: "PAYMENT_REVIEW" as const,
          targetGradeId: gOctavo.id,
          studentFirstName: "Mateo",
          studentLastName: "Giraldo Peña",
          studentDocType: "TI" as const,
          studentDocNumber: "1072991002",
          studentBirthDate: "2013-08-22",
          studentEps: "Sura",
          studentBloodType: "A+",
          previousSchool: "Liceo Lunita de Chía",
          guardianFirstName: "Carlos",
          guardianLastName: "Giraldo Torres",
          guardianDocType: "CC" as const,
          guardianDocNumber: "79554321",
          guardianEmail: "carlos.giraldo@correo.test",
          guardianPhone: "3157729012",
          address: "Barrio Santa Lucía, Chía",
          hasEarlyBirdDiscount: true,
          hasSiblingDiscount: true,
          estimatedEnrollmentCop: f2.enrollmentFinal,
          estimatedMonthlyCop: f2.monthlyFinal,
          habeasDataAcceptedAt: new Date(),
          paymentChannel: "NEQUI" as const,
          paymentReference: "NQ-882410",
          reviewNotes: "Aval académico aprobado por Coordinación. Pago reportado por Nequi.",
        },
        {
          trackingCode: "ADM-2027-DEMO03",
          applicationType: "NEW" as const,
          status: "SUBMITTED" as const,
          targetGradeId: gPrejardin.id,
          studentFirstName: "Emiliano",
          studentLastName: "Cárdenas Rojas",
          studentDocType: "RC" as const,
          studentDocNumber: "1072991003",
          studentBirthDate: "2023-02-10",
          studentEps: "Compensar",
          studentBloodType: "B+",
          previousSchool: "",
          guardianFirstName: "Paula",
          guardianLastName: "Rojas Díaz",
          guardianDocType: "CC" as const,
          guardianDocNumber: "1015442889",
          guardianEmail: "paula.rojas@correo.test",
          guardianPhone: "3209184455",
          address: "Cajicá - Chía",
          hasEarlyBirdDiscount: false,
          hasSiblingDiscount: false,
          estimatedEnrollmentCop: f3.enrollmentFinal,
          estimatedMonthlyCop: f3.monthlyFinal,
          habeasDataAcceptedAt: new Date(),
          reviewNotes: "",
        },
      ];

      await db.transaction(async (tx) => {
        for (const item of demoApps) {
          const [created] = await tx
            .insert(admissionApplications)
            .values(item)
            .returning({ id: admissionApplications.id });
          await tx.insert(enrollmentDocuments).values(
            ADMISSION_DOC_KEYS.map((docKey, idx) => ({
              applicationId: created!.id,
              docKey,
              status:
                item.trackingCode === "ADM-2027-DEMO02"
                  ? ("APPROVED" as const)
                  : item.trackingCode === "ADM-2027-DEMO01" && idx < 3
                    ? ("APPROVED" as const)
                    : ("PENDING" as const),
            })),
          );
          applicationsCreated++;
        }
      });
    }
  }

  // 2. Cartera 2026
  const [existingCharges] = await db.select({ total: count() }).from(billingCharges);
  if ((existingCharges?.total ?? 0) === 0) {
    const [year] = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1);
    if (year) {
      const roster = await db
        .select({
          enrollmentId: enrollments.id,
          email: users.email,
          levelCode: levels.code,
        })
        .from(enrollments)
        .innerJoin(users, eq(users.id, enrollments.studentId))
        .innerJoin(groups, eq(groups.id, enrollments.groupId))
        .innerJoin(grades, eq(grades.id, groups.gradeId))
        .innerJoin(levels, eq(levels.id, grades.levelId))
        .where(and(eq(enrollments.academicYearId, year.id), eq(enrollments.status, "ACTIVE")));

      const months = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      let receiptSeq = 1001;

      await db.transaction(async (tx) => {
        for (let idx = 0; idx < roster.length; idx++) {
          const st = roster[idx]!;
          const tariff = FEE_SCHEDULE_2027[st.levelCode];
          const isSofia = st.email === "sofia.ramirez@campus.lunita.test";
          const isTomas = st.email === "tomas.ramirez@campus.lunita.test";
          // Sofía al día (11/11), Tomás hasta octubre (10/11), resto variado realista
          const paidThroughMonth = isSofia ? 11 : isTomas ? 10 : idx % 4 === 0 ? 11 : idx % 3 === 0 ? 9 : 10;

          for (const m of months) {
            const isFee = m === 0;
            const amountCop = isFee ? tariff.enrollmentCop : tariff.monthlyCop;
            const dueDate = isFee ? `${year.year}-01-25` : `${year.year}-${String(m).padStart(2, "0")}-10`;
            const isPaid = m <= paidThroughMonth;
            const status = isPaid ? ("PAID" as const) : m < 11 ? ("OVERDUE" as const) : ("PENDING" as const);

            const [createdCharge] = await tx
              .insert(billingCharges)
              .values({
                enrollmentId: st.enrollmentId,
                academicYearId: year.id,
                chargeType: isFee ? "ENROLLMENT_FEE" : "TUITION",
                billingMonth: m,
                concept: `${SCHOOL_MONTH_LABELS[m]} ${year.year}`,
                amountCop,
                discountCop: 0,
                paidCop: isPaid ? amountCop : 0,
                dueDate,
                status,
              })
              .returning({ id: billingCharges.id });

            if (isPaid && createdCharge) {
              await tx.insert(billingPayments).values({
                chargeId: createdCharge.id,
                amountCop,
                channel: m % 3 === 0 ? "NEQUI" : m % 2 === 0 ? "PSE" : "BRE_B",
                referenceCode: `REF-${year.year}-${receiptSeq}`,
                receiptNumber: `REC-${year.year}-${receiptSeq}`,
              });
              receiptSeq++;
            }
            chargesCreated++;
          }
        }
      });
    }
  }

  return { applications: applicationsCreated, charges: chargesCreated };
}

if (require.main === module) {
  loadScriptEnv();
  const db = createDatabase();
  seedDemoFase4(db)
    .then((res) =>
      console.log(`✔ Fase 4 sembrada: ${res.applications} solicitudes 2027, ${res.charges} cobros de cartera.`),
    )
    .catch((err: unknown) => {
      console.error("✖ Error sembrando Fase 4:", err);
      process.exitCode = 1;
    })
    .finally(() => db.$client.end());
}
