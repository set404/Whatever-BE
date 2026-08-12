import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { GlobalRole } from '../roles/global-role.enum';
import { AuthenticatedUser } from './authenticated-user';
import { IS_PUBLIC_KEY } from './public.decorator';

interface SupabaseAccessTokenPayload extends JWTPayload {
  sub: string;
  email?: string;
}

// Supabase Auth signs access tokens asymmetrically (ES256) and publishes the
// verification key at this well-known JWKS endpoint — there is no shared secret
// to configure. `createRemoteJWKSet` fetches and caches it (with automatic
// refresh on a kid it hasn't seen), one set per process.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(supabaseUrl: string) {
  jwks ??= createRemoteJWKSet(
    new URL('/auth/v1/.well-known/jwks.json', supabaseUrl),
  );
  return jwks;
}

/**
 * Verifies the same access token Supabase Auth issues to the FE (supabase-js) —
 * this app has no login of its own. Runs globally (see AppModule); routes opt out
 * with @Public(). On success, attaches AuthenticatedUser (including the profile's
 * global_role) to the request for RolesGuard and @CurrentUser to use.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
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

    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    let payload: SupabaseAccessTokenPayload;
    try {
      const result = await jwtVerify(token, getJwks(supabaseUrl));
      payload = result.payload as SupabaseAccessTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: payload.sub },
    });
    if (!profile) {
      throw new UnauthorizedException('No profile for this user');
    }

    request.user = {
      id: profile.id,
      email: payload.email ?? null,
      displayName: profile.displayName,
      globalRole: profile.globalRole as GlobalRole,
    };
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
