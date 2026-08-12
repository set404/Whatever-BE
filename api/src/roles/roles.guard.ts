import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { GlobalRole, satisfiesRole } from './global-role.enum';
import { ROLES_KEY } from './roles.decorator';

/** Runs after SupabaseAuthGuard has attached request.user. No @Roles() on a route means any authenticated user may access it. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRole = this.reflector.getAllAndOverride<
      GlobalRole | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRole) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    if (!satisfiesRole(user.globalRole, requiredRole)) {
      throw new ForbiddenException(`Requires ${requiredRole} role`);
    }
    return true;
  }
}
