"use server";

import { and, count, eq, inArray, ne, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { academicYears, enrollments, groups, guardianLinks, users } from "@/db/schema";
import { recordAudit } from "@/modules/core/audit/service";
import { requirePermission } from "@/modules/core/auth/guards";
import { hashPassword } from "@/modules/core/auth/password";
import { validateNewPassword } from "@/modules/core/auth/password-policy";
import { ROLE_META, type Role } from "@/modules/core/auth/roles";
import { formText } from "@/modules/core/auth/schemas";
import { getRequestMeta, revokeAllUserSessions } from "@/modules/core/auth/session";
import {
  generateInstitutionalEmail,
  generateInstitutionalPassword,
  MAX_BULK_FILE_BYTES,
  parseCsvMatrix,
  validateBulkMatrix,
  type BulkRowError,
} from "./bulk";
import { parseXlsxBuffer } from "./excel";
import {
  adminResetPasswordSchema,
  createGuardianLinkSchema,
  createUserSchema,
  removeGuardianLinkSchema,
  revokeSessionsSchema,
  toggleUserActiveSchema,
  updateUserSchema,
  validateAdminSafety,
} from "./schemas";

export interface UserActionState {
  status: "idle" | "error" | "success";
  message?: string;
}

/** Crea una nueva cuenta institucional (exclusivo de Secretaría / Rectoría `ADMIN`). */
export async function createUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const actor = await requirePermission("users.manage");
  const parsed = createUserSchema.safeParse({
    documentType: formText(formData, "documentType"),
    documentNumber: formText(formData, "documentNumber"),
    firstName: formText(formData, "firstName"),
    lastName: formText(formData, "lastName"),
    email: formText(formData, "email"),
    phone: formText(formData, "phone"),
    role: formText(formData, "role"),
    password: formText(formData, "password"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos del usuario." };
  }

  const input = parsed.data;
  const pwdProblems = validateNewPassword(input.password, {
    documentNumber: input.documentNumber,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
  });
  if (pwdProblems.length > 0) {
    return { status: "error", message: pwdProblems[0] };
  }

  const conflictClause = input.email
    ? or(eq(users.documentNumber, input.documentNumber), eq(users.email, input.email))
    : eq(users.documentNumber, input.documentNumber);

  const [conflict] = await db
    .select({ documentNumber: users.documentNumber, email: users.email })
    .from(users)
    .where(conflictClause)
    .limit(1);

  if (conflict) {
    if (conflict.documentNumber === input.documentNumber) {
      return { status: "error", message: "Ya existe un usuario registrado con ese número de documento." };
    }
    return { status: "error", message: "Ya existe un usuario registrado con ese correo electrónico." };
  }

  const passwordHash = await hashPassword(input.password);
  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        role: input.role,
        passwordHash,
        isActive: true,
      })
      .returning({ id: users.id });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "USER_CREATED",
        entityType: "user",
        entityId: created!.id,
        after: {
          documentType: input.documentType,
          documentNumber: input.documentNumber,
          role: input.role,
          email: input.email,
        },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return { status: "success", message: `Cuenta creada para ${input.firstName} ${input.lastName}.` };
}

/** Actualiza datos básicos y rol de un usuario, revocando sesiones si cambia el rol. */
export async function updateUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const actor = await requirePermission("users.manage");
  const parsed = updateUserSchema.safeParse({
    userId: formText(formData, "userId"),
    documentType: formText(formData, "documentType"),
    documentNumber: formText(formData, "documentNumber"),
    firstName: formText(formData, "firstName"),
    lastName: formText(formData, "lastName"),
    email: formText(formData, "email"),
    phone: formText(formData, "phone"),
    role: formText(formData, "role"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los campos." };
  }
  const input = parsed.data;

  const [current] = await db
    .select({
      id: users.id,
      documentType: users.documentType,
      documentNumber: users.documentNumber,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!current) return { status: "error", message: "La cuenta no existe." };

  const [otherAdmins] = await db
    .select({ total: count() })
    .from(users)
    .where(and(eq(users.role, "ADMIN"), eq(users.isActive, true), ne(users.id, current.id)));

  const safety = validateAdminSafety({
    actorId: actor.id,
    targetId: current.id,
    currentRole: current.role,
    nextRole: input.role,
    currentActive: current.isActive,
    nextActive: current.isActive,
    otherActiveAdminsCount: otherAdmins?.total ?? 0,
  });
  if (!safety.ok) return { status: "error", message: safety.message };

  const conflictClause = input.email
    ? and(
        ne(users.id, current.id),
        or(eq(users.documentNumber, input.documentNumber), eq(users.email, input.email)),
      )
    : and(ne(users.id, current.id), eq(users.documentNumber, input.documentNumber));

  const [conflict] = await db
    .select({ documentNumber: users.documentNumber })
    .from(users)
    .where(conflictClause)
    .limit(1);
  if (conflict) {
    return {
      status: "error",
      message:
        conflict.documentNumber === input.documentNumber
          ? "Otro usuario ya tiene ese número de documento."
          : "Otro usuario ya tiene ese correo electrónico.",
    };
  }

  const { ip } = await getRequestMeta();
  const roleChanged = current.role !== input.role;

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        role: input.role,
      })
      .where(eq(users.id, current.id));

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "USER_UPDATED",
        entityType: "user",
        entityId: current.id,
        before: { role: current.role, email: current.email, documentNumber: current.documentNumber },
        after: { role: input.role, email: input.email, documentNumber: input.documentNumber },
        ipAddress: ip,
      },
      tx,
    );

    if (roleChanged) {
      await revokeAllUserSessions(
        current.id,
        { actorUserId: actor.id, reason: `Cambio de rol (${current.role} → ${input.role})`, ipAddress: ip },
        tx,
      );
    }
  });

  refresh();
  return {
    status: "success",
    message: roleChanged
      ? "Datos y rol actualizados. Se cerraron las sesiones anteriores del usuario."
      : "Datos actualizados correctamente.",
  };
}

/** Activa o desactiva una cuenta. Al desactivar cierra de inmediato todas sus sesiones. */
export async function toggleUserActiveAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const actor = await requirePermission("users.manage");
  const parsed = toggleUserActiveSchema.safeParse({
    userId: formText(formData, "userId"),
    nextActive: formText(formData, "nextActive"),
  });
  if (!parsed.success) return { status: "error", message: "Parámetros inválidos." };

  const { userId, nextActive } = parsed.data;
  const [current] = await db
    .select({ id: users.id, firstName: users.firstName, role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!current) return { status: "error", message: "La cuenta no existe." };

  const [otherAdmins] = await db
    .select({ total: count() })
    .from(users)
    .where(and(eq(users.role, "ADMIN"), eq(users.isActive, true), ne(users.id, current.id)));

  const safety = validateAdminSafety({
    actorId: actor.id,
    targetId: current.id,
    currentRole: current.role,
    nextRole: current.role,
    currentActive: current.isActive,
    nextActive,
    otherActiveAdminsCount: otherAdmins?.total ?? 0,
  });
  if (!safety.ok) return { status: "error", message: safety.message };

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ isActive: nextActive }).where(eq(users.id, current.id));
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "USER_STATUS_CHANGED",
        entityType: "user",
        entityId: current.id,
        before: { isActive: current.isActive },
        after: { isActive: nextActive },
        ipAddress: ip,
      },
      tx,
    );
    if (!nextActive) {
      await revokeAllUserSessions(
        current.id,
        { actorUserId: actor.id, reason: "Cuenta desactivada por administración", ipAddress: ip },
        tx,
      );
    }
  });

  refresh();
  return {
    status: "success",
    message: nextActive
      ? `Cuenta de ${current.firstName} reactivada.`
      : `Cuenta de ${current.firstName} desactivada y sesiones cerradas.`,
  };
}

/** Cierra todas las sesiones activas de un usuario (incidente o cambio de dispositivo). */
export async function revokeUserSessionsAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const actor = await requirePermission("sessions.revoke");
  const parsed = revokeSessionsSchema.safeParse({ userId: formText(formData, "userId") });
  if (!parsed.success) return { status: "error", message: "Usuario inválido." };

  if (parsed.data.userId === actor.id) {
    return { status: "error", message: "Usa «Salir» en el menú para cerrar tu propia sesión actual." };
  }

  const { ip } = await getRequestMeta();
  await revokeAllUserSessions(parsed.data.userId, {
    actorUserId: actor.id,
    reason: "Cierre remoto desde Gestión de Usuarios",
    ipAddress: ip,
  });

  refresh();
  return { status: "success", message: "Todas las sesiones activas de esta cuenta fueron cerradas." };
}

/** Asigna una nueva contraseña temporal cumpliendo la política de seguridad y revoca sesiones. */
export async function adminResetPasswordAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const actor = await requirePermission("users.manage");
  const parsed = adminResetPasswordSchema.safeParse({
    userId: formText(formData, "userId"),
    newPassword: formText(formData, "newPassword"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Contraseña inválida." };
  }

  const [target] = await db
    .select({
      id: users.id,
      documentNumber: users.documentNumber,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.id, parsed.data.userId))
    .limit(1);
  if (!target) return { status: "error", message: "La cuenta no existe." };

  const problems = validateNewPassword(parsed.data.newPassword, target);
  if (problems.length > 0) return { status: "error", message: problems[0] };

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, target.id));
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "USER_PASSWORD_ADMIN_RESET",
        entityType: "user",
        entityId: target.id,
        ipAddress: ip,
      },
      tx,
    );
    await revokeAllUserSessions(
      target.id,
      { actorUserId: actor.id, reason: "Restablecimiento administrativo de contraseña", ipAddress: ip },
      tx,
    );
  });

  refresh();
  return { status: "success", message: "Contraseña actualizada y sesiones anteriores cerradas." };
}

/** Crea un vínculo acudiente ↔ estudiante verificando roles reales. */
export async function createGuardianLinkAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const actor = await requirePermission("users.manage");
  const parsed = createGuardianLinkSchema.safeParse({
    guardianId: formText(formData, "guardianId"),
    studentId: formText(formData, "studentId"),
    relationship: formText(formData, "relationship"),
    isFinancialResponsible: formData.get("isFinancialResponsible") === "on",
    canPickUp: formData.get("canPickUp") !== "off",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa el vínculo." };
  }
  const input = parsed.data;
  if (input.guardianId === input.studentId) {
    return { status: "error", message: "El acudiente y el estudiante deben ser personas distintas." };
  }

  const [guardian, student] = await Promise.all([
    db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, input.guardianId)).limit(1),
    db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, input.studentId)).limit(1),
  ]);
  if (!guardian[0] || guardian[0].role !== "GUARDIAN") {
    return { status: "error", message: "La cuenta seleccionada como acudiente no tiene rol Acudiente." };
  }
  if (!student[0] || student[0].role !== "STUDENT") {
    return { status: "error", message: "La cuenta seleccionada como estudiante no tiene rol Estudiante." };
  }

  const { ip } = await getRequestMeta();
  const inserted = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(guardianLinks)
      .values({
        guardianId: input.guardianId,
        studentId: input.studentId,
        relationship: input.relationship,
        isFinancialResponsible: input.isFinancialResponsible,
        canPickUp: input.canPickUp,
      })
      .onConflictDoNothing()
      .returning({ id: guardianLinks.id });

    if (rows[0]) {
      await recordAudit(
        {
          actorUserId: actor.id,
          action: "GUARDIAN_LINK_CREATED",
          entityType: "guardian_link",
          entityId: rows[0].id,
          after: input,
          ipAddress: ip,
        },
        tx,
      );
    }
    return rows.length;
  });

  refresh();
  return inserted > 0
    ? { status: "success", message: "Vínculo familiar creado correctamente." }
    : { status: "error", message: "Ese vínculo familiar ya existía." };
}

/** Elimina un vínculo acudiente ↔ estudiante. */
export async function removeGuardianLinkAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const actor = await requirePermission("users.manage");
  const parsed = removeGuardianLinkSchema.safeParse({ linkId: formText(formData, "linkId") });
  if (!parsed.success) return { status: "error", message: "Vínculo inválido." };

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(guardianLinks)
      .where(eq(guardianLinks.id, parsed.data.linkId))
      .returning({
        id: guardianLinks.id,
        guardianId: guardianLinks.guardianId,
        studentId: guardianLinks.studentId,
      });

    if (removed) {
      await recordAudit(
        {
          actorUserId: actor.id,
          action: "GUARDIAN_LINK_REMOVED",
          entityType: "guardian_link",
          entityId: removed.id,
          before: removed,
          ipAddress: ip,
        },
        tx,
      );
    }
  });

  refresh();
  return { status: "success", message: "Vínculo familiar eliminado." };
}

/* ---------------------------------------------------------------------------
   Carga masiva desde Excel (.xlsx) o CSV con generación de credenciales
   --------------------------------------------------------------------------- */

export interface GeneratedCredential {
  fullName: string;
  role: Role;
  roleLabel: string;
  documentType: string;
  documentNumber: string;
  email: string;
  initialPassword: string;
  groupName: string | null;
  guardianLinked: boolean;
}

export interface BulkImportState {
  status: "idle" | "error" | "success";
  message?: string;
  created: GeneratedCredential[];
  skipped: Array<{ rowNumber: number; documentNumber: string; reason: string }>;
  errors: BulkRowError[];
}

/**
 * Carga masiva de usuarios desde `.xlsx` o `.csv` (hasta 1.500 filas por archivo).
 * Genera correo institucional automático (si viene vacío) y contraseña inicial
 * personalizada y segura (`LLC-Iniciales+Ult4Doc-XX`), matricula en grupo activo
 * y vincula acudientes en una sola transacción. Las contraseñas solo se devuelven
 * una vez en la respuesta para descarga/impresión y jamás se guardan en claro.
 */
export async function bulkImportUsersAction(
  _prev: BulkImportState,
  formData: FormData,
): Promise<BulkImportState> {
  const actor = await requirePermission("users.manage");
  const file = formData.get("file");
  const skipExisting = formData.get("skipExisting") !== "off";

  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "Selecciona un archivo Excel (.xlsx) o CSV (.csv) con los usuarios.",
      created: [],
      skipped: [],
      errors: [],
    };
  }
  if (file.size > MAX_BULK_FILE_BYTES) {
    return {
      status: "error",
      message: "El archivo supera el límite de 5 MB.",
      created: [],
      skipped: [],
      errors: [],
    };
  }

  const lowerName = file.name.toLowerCase();
  const isXlsx = lowerName.endsWith(".xlsx");
  const isCsv = lowerName.endsWith(".csv") || lowerName.endsWith(".txt");
  if (!isXlsx && !isCsv) {
    return {
      status: "error",
      message: "Formato no compatible. Sube un archivo .xlsx (Excel) o .csv.",
      created: [],
      skipped: [],
      errors: [],
    };
  }

  let matrix: string[][];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    matrix = isXlsx ? await parseXlsxBuffer(buffer) : parseCsvMatrix(buffer.toString("utf8"));
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "No pudimos leer el archivo subido.",
      created: [],
      skipped: [],
      errors: [],
    };
  }

  const { valid, errors } = validateBulkMatrix(matrix);
  if (valid.length === 0) {
    return {
      status: "error",
      message: errors[0]?.message ?? "No hay filas válidas para importar.",
      created: [],
      skipped: [],
      errors,
    };
  }

  // Consultas previas en lote: documentos existentes, correos existentes y grupos del año activo.
  const [existingUsers, currentYearRows] = await Promise.all([
    db.select({ id: users.id, documentNumber: users.documentNumber, email: users.email, role: users.role }).from(users),
    db.select({ id: academicYears.id }).from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1),
  ]);

  const currentYearId = currentYearRows[0]?.id ?? null;
  const activeGroups = currentYearId
    ? await db
        .select({ id: groups.id, name: groups.name })
        .from(groups)
        .where(eq(groups.academicYearId, currentYearId))
    : [];

  const existingDocSet = new Set(existingUsers.map((u) => u.documentNumber));
  const usedEmails = new Set(existingUsers.map((u) => u.email).filter((e): e is string => Boolean(e)));
  const guardianIdByDoc = new Map(
    existingUsers.filter((u) => u.role === "GUARDIAN").map((u) => [u.documentNumber, u.id]),
  );
  const groupIdByName = new Map(activeGroups.map((g) => [g.name.toUpperCase(), { id: g.id, name: g.name }]));

  const skipped: Array<{ rowNumber: number; documentNumber: string; reason: string }> = [];
  const toCreate: Array<{
    row: (typeof valid)[number];
    id: string;
    email: string;
    initialPassword: string;
    matchedGroup: { id: string; name: string } | null;
  }> = [];

  for (const row of valid) {
    if (existingDocSet.has(row.documentNumber)) {
      if (skipExisting) {
        skipped.push({
          rowNumber: row.rowNumber,
          documentNumber: row.documentNumber,
          reason: "Documento ya registrado",
        });
      } else {
        errors.push({
          rowNumber: row.rowNumber,
          message: `El documento ${row.documentNumber} ya existe en la plataforma.`,
        });
      }
      continue;
    }

    if (row.email && usedEmails.has(row.email)) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `El correo ${row.email} ya está asignado a otra cuenta.`,
      });
      continue;
    }

    const email =
      row.email ?? generateInstitutionalEmail(row.firstName, row.lastName, row.documentNumber, usedEmails);
    if (row.email) usedEmails.add(row.email);

    const initialPassword = generateInstitutionalPassword(row.firstName, row.lastName, row.documentNumber);
    const matchedGroup = row.role === "STUDENT" && row.groupName ? groupIdByName.get(row.groupName) ?? null : null;

    const newId = crypto.randomUUID();
    if (row.role === "GUARDIAN") {
      guardianIdByDoc.set(row.documentNumber, newId);
    }

    toCreate.push({ row, id: newId, email, initialPassword, matchedGroup });
  }

  if (toCreate.length === 0) {
    return {
      status: errors.length > 0 ? "error" : "success",
      message:
        skipped.length > 0
          ? `No se crearon cuentas nuevas (${skipped.length} documentos ya existían).`
          : "No se pudieron crear cuentas. Revisa los errores detectados.",
      created: [],
      skipped,
      errors,
    };
  }

  // Hasheo scrypt en lotes controlados de 20 para mantener el servidor fluido.
  const hashedPasswords = new Map<string, string>();
  for (let i = 0; i < toCreate.length; i += 20) {
    const slice = toCreate.slice(i, i + 20);
    const hashes = await Promise.all(slice.map((item) => hashPassword(item.initialPassword)));
    slice.forEach((item, idx) => hashedPasswords.set(item.id, hashes[idx]!));
  }

  const userRows = toCreate.map((item) => ({
    id: item.id,
    documentType: item.row.documentType,
    documentNumber: item.row.documentNumber,
    firstName: item.row.firstName,
    lastName: item.row.lastName,
    email: item.email,
    phone: item.row.phone,
    role: item.row.role,
    passwordHash: hashedPasswords.get(item.id)!,
    isActive: true,
  }));

  const enrollmentRows = currentYearId
    ? toCreate
        .filter((item) => item.row.role === "STUDENT" && item.matchedGroup !== null)
        .map((item) => ({
          studentId: item.id,
          academicYearId: currentYearId,
          groupId: item.matchedGroup!.id,
          status: "ACTIVE" as const,
          enrollmentType: "NEW" as const,
        }))
    : [];

  const linkRows: Array<typeof guardianLinks.$inferInsert> = [];
  const linkedStudentIds = new Set<string>();
  for (const item of toCreate) {
    if (item.row.role !== "STUDENT" || !item.row.guardianDocument) continue;
    const guardianId = guardianIdByDoc.get(item.row.guardianDocument);
    if (!guardianId || guardianId === item.id) continue;
    linkRows.push({
      guardianId,
      studentId: item.id,
      relationship: item.row.relationship,
      isFinancialResponsible: true,
      canPickUp: true,
    });
    linkedStudentIds.add(item.id);
  }

  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    for (let i = 0; i < userRows.length; i += 250) {
      await tx.insert(users).values(userRows.slice(i, i + 250));
    }
    if (enrollmentRows.length > 0) {
      for (let i = 0; i < enrollmentRows.length; i += 250) {
        await tx.insert(enrollments).values(enrollmentRows.slice(i, i + 250)).onConflictDoNothing();
      }
    }
    if (linkRows.length > 0) {
      for (let i = 0; i < linkRows.length; i += 250) {
        await tx.insert(guardianLinks).values(linkRows.slice(i, i + 250)).onConflictDoNothing();
      }
    }

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "USERS_BULK_IMPORTED",
        entityType: "user_batch",
        entityId: file.name.slice(0, 120),
        after: {
          createdCount: toCreate.length,
          enrolledCount: enrollmentRows.length,
          guardianLinksCount: linkRows.length,
          skippedCount: skipped.length,
          errorCount: errors.length,
        },
        ipAddress: ip,
      },
      tx,
    );
  });

  // Referencia explícita para evitar unused import si cambia inArray en el futuro
  void inArray;

  refresh();

  return {
    status: "success",
    message: `Importación lista: ${toCreate.length} cuenta(s) creada(s) con credenciales personalizadas.${
      enrollmentRows.length > 0 ? ` ${enrollmentRows.length} matriculado(s) en grupo.` : ""
    }${linkRows.length > 0 ? ` ${linkRows.length} vínculo(s) familiar(es).` : ""}`,
    created: toCreate.map((item) => ({
      fullName: `${item.row.firstName} ${item.row.lastName}`,
      role: item.row.role,
      roleLabel: ROLE_META[item.row.role].label,
      documentType: item.row.documentType,
      documentNumber: item.row.documentNumber,
      email: item.email,
      initialPassword: item.initialPassword,
      groupName: item.matchedGroup?.name ?? null,
      guardianLinked: linkedStudentIds.has(item.id),
    })),
    skipped,
    errors,
  };
}
