import { SetMetadata } from '@nestjs/common';
import { GlobalRole } from './global-role.enum';

export const ROLES_KEY = 'requiredRole';

/** Minimum global role required to access a route. Superadmin always satisfies any check. */
export const Roles = (role: GlobalRole) => SetMetadata(ROLES_KEY, role);
