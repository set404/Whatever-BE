import { GlobalRole } from '../roles/global-role.enum';

/** Attached to the request by JwtAuthGuard after verifying the access token and loading the user. */
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  displayName: string | null;
  globalRole: GlobalRole;
}
