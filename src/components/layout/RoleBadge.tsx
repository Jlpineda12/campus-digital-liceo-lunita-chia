import { Chip } from "@/components/ui/Chip";
import { ROLE_META, type Role } from "@/modules/core/auth/roles";

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <Chip tone={ROLE_META[role].tone} className={className}>
      {ROLE_META[role].label}
    </Chip>
  );
}
