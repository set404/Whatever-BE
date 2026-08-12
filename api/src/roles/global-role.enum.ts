// Platform-wide role (profiles.global_role) — distinct from the per-group role in
// group_members. Ranked so @Roles(Role.Admin) also admits a Superadmin.
export enum GlobalRole {
  Superadmin = 'superadmin',
  Admin = 'admin',
  Member = 'member',
}

const RANK: Record<GlobalRole, number> = {
  [GlobalRole.Superadmin]: 3,
  [GlobalRole.Admin]: 2,
  [GlobalRole.Member]: 1,
};

export function satisfiesRole(
  actual: GlobalRole,
  required: GlobalRole,
): boolean {
  return RANK[actual] >= RANK[required];
}
