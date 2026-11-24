import { Check, Clock, FileCheck2, X } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import {
  ATTENDANCE_STATUS_META,
  EXCUSE_STATUS_META,
  type AttendanceStatus,
  type ExcuseStatus,
} from "@/modules/siga/attendance/meta";

const STATUS_ICONS: Record<AttendanceStatus, typeof Check> = {
  PRESENT: Check,
  ABSENT: X,
  LATE: Clock,
  EXCUSED: FileCheck2,
};

/** Etiqueta accesible de estado de asistencia (icono + letra + nombre + color). */
export function AttendanceBadge({ status, compact = false }: { status: AttendanceStatus; compact?: boolean }) {
  const meta = ATTENDANCE_STATUS_META[status];
  const Icon = STATUS_ICONS[status];
  return (
    <Chip tone={meta.tone}>
      <Icon aria-hidden />
      <span>{compact ? `${meta.code} · ${meta.label}` : meta.label}</span>
    </Chip>
  );
}

export function ExcuseBadge({ status }: { status: ExcuseStatus }) {
  const meta = EXCUSE_STATUS_META[status];
  return <Chip tone={meta.tone}>{meta.label}</Chip>;
}
