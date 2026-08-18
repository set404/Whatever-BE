import { CookieOptions } from 'express';

export const REFRESH_COOKIE_NAME = 'refresh_token';

/**
 * SameSite=None (+ Secure) is required for the cookie to survive a cross-site
 * XHR, which is the deployed shape (FE and BE on different origins). Local dev
 * over plain http can't set Secure, so it falls back to Lax there instead.
 */
export function getRefreshCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/auth',
  };
}
