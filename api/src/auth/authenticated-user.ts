import { GlobalRole } from '../roles/global-role.enum';

/** Attached to the request by SupabaseAuthGuard after verifying the JWT and loading the profile. */
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  displayName: string | null;
  globalRole: GlobalRole;
}
