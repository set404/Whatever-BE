import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './authenticated-user';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Runs globally (see AppModule); routes opt out with @Public(). Verifies the
 * bearer access token issued by AuthService and attaches AuthenticatedUser
 * (including the current global_role) to the request for RolesGuard and
 * @CurrentUser to use.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const userId = await this.authService.verifyAccessToken(token);
    request.user = await this.authService.loadAuthenticatedUser(userId);
    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    return header.slice('Bearer '.length);
  }
}
