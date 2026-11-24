import "server-only";
import { getGuardianChildren, getStudentPlacement } from "@/modules/core/academic-structure/queries";
import { can } from "@/modules/core/auth/permissions";
import { resolveSelectedChildId } from "@/modules/core/auth/policies";
import type { SessionUser } from "@/modules/core/auth/session";
import { getCourseContext, type CourseContext } from "@/modules/siga/siee-grades/access";

export interface AulaCourseAccess {
  course: CourseContext;
  /** Puede crear unidades, recursos, tareas y calificar entregas. */
  canManage: boolean;
  /** Puede enviar entregas de tareas (solo `STUDENT` matriculado en el grupo). */
  canSubmit: boolean;
  /** Puede publicar en el muro/foro del curso. */
  canPostForum: boolean;
  /** Matrícula del estudiante consultado (propia para STUDENT, hijo seleccionado para GUARDIAN). */
  viewerEnrollmentId: string | null;
  /** Nombre del estudiante consultado cuando entra un acudiente. */
  viewerStudentName: string | null;
}

/**
 * Verifica en servidor si el usuario en sesión tiene autorización sobre un curso
 * del Aula Virtual (anti-IDOR). Devuelve `null` si no pertenece al curso.
 */
export async function resolveCourseAccess(
  actor: SessionUser,
  courseAssignmentId: string,
): Promise<AulaCourseAccess | null> {
  const course = await getCourseContext(courseAssignmentId);
  if (!course) return null;

  if (actor.role === "ADMIN" || actor.role === "COORDINATOR") {
    return {
      course,
      canManage: false,
      canSubmit: false,
      canPostForum: true,
      viewerEnrollmentId: null,
      viewerStudentName: null,
    };
  }

  if (actor.role === "TEACHER") {
    const isOwner = course.teacherId === actor.id;
    const isDirector = course.directorTeacherId === actor.id;
    if (!isOwner && !isDirector) return null;
    return {
      course,
      canManage: isOwner && can(actor.role, "aula.manage.ownCourses"),
      canSubmit: false,
      canPostForum: true,
      viewerEnrollmentId: null,
      viewerStudentName: null,
    };
  }

  if (actor.role === "STUDENT") {
    const placement = await getStudentPlacement(actor.id, course.academicYearId);
    if (!placement || placement.groupId !== course.groupId) return null;
    return {
      course,
      canManage: false,
      canSubmit: can(actor.role, "aula.submit"),
      canPostForum: true,
      viewerEnrollmentId: placement.enrollmentId,
      viewerStudentName: actor.firstName,
    };
  }

  if (actor.role === "GUARDIAN") {
    const children = await getGuardianChildren(actor.id, course.academicYearId);
    if (children.length === 0) return null;
    const selectedId = await resolveSelectedChildId(children.map((c) => c.studentId));
    // Verifica primero el hijo seleccionado y, si el enlace apunta a un curso de otro hijo, lo valida.
    const ordered = [
      ...children.filter((c) => c.studentId === selectedId),
      ...children.filter((c) => c.studentId !== selectedId),
    ];
    for (const child of ordered) {
      const placement = await getStudentPlacement(child.studentId, course.academicYearId);
      if (placement && placement.groupId === course.groupId) {
        return {
          course,
          canManage: false,
          canSubmit: false, // Regla institucional: el acudiente acompaña pero NO entrega tareas del hijo.
          canPostForum: false,
          viewerEnrollmentId: placement.enrollmentId,
          viewerStudentName: child.firstName,
        };
      }
    }
    return null;
  }

  return null;
}
