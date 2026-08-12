import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { GlobalRole } from './global-role.enum';
import { RolesGuard } from './roles.guard';

function contextWithUser(user: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when the route has no @Roles requirement', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(
        contextWithUser({
          id: '1',
          email: null,
          displayName: null,
          globalRole: GlobalRole.Member,
        }),
      ),
    ).toBe(true);
  });

  it('allows access when the user meets the required role', () => {
    const reflector = {
      getAllAndOverride: () => GlobalRole.Admin,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(
        contextWithUser({
          id: '1',
          email: null,
          displayName: null,
          globalRole: GlobalRole.Superadmin,
        }),
      ),
    ).toBe(true);
  });

  it('throws ForbiddenException when the user is below the required role', () => {
    const reflector = {
      getAllAndOverride: () => GlobalRole.Admin,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(
        contextWithUser({
          id: '1',
          email: null,
          displayName: null,
          globalRole: GlobalRole.Member,
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
