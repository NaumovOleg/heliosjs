import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, MiddlewareCB } from '@heliosjs/core/types';
import { ForbiddenError } from '@heliosjs/core/utils';

export interface CsrfOptions {
  /** Double-submit cookie name. Defaults to `csrf_token`. */
  cookieName?: string;
  /** Header carrying the token. Defaults to `x-csrf-token`. */
  headerName?: string;
  /** Methods that do not mutate state and do not require a token. */
  safeMethods?: string[];
  /** Cookie attributes. Secure/SameSite defaults are applied when omitted. */
  cookie?: CookieOptions;
}

/**
 * Double-submit-cookie CSRF protection for cookie-authenticated routes.
 *
 * The middleware creates a readable token cookie on safe requests and requires
 * the same value in a request header for every unsafe method. It is opt-in so
 * token/bearer-authenticated APIs do not pay for an unnecessary cookie.
 */
export function csrfProtection(options: CsrfOptions = {}): MiddlewareCB {
  const cookieName = options.cookieName ?? 'csrf_token';
  const headerName = options.headerName ?? 'x-csrf-token';
  const safeMethods = new Set(
    (options.safeMethods ?? ['GET', 'HEAD', 'OPTIONS']).map((method) => method.toUpperCase()),
  );

  return async (request, response, next) => {
    const cookieToken = request.getCookie(cookieName);
    const method = request.method.toUpperCase();

    if (safeMethods.has(method)) {
      if (!cookieToken) {
        response.setCookie(cookieName, randomBytes(32).toString('hex'), {
          secure: request.isSecure(),
          httpOnly: false,
          sameSite: 'lax',
          ...options.cookie,
        });
      }
      await next();
      return;
    }

    const header = request.getHeader(headerName);
    const headerToken = Array.isArray(header) ? header[0] : header;
    if (!cookieToken || !headerToken || !tokensEqual(cookieToken, headerToken)) {
      throw new ForbiddenError('Invalid CSRF token', { path: request.path });
    }

    await next();
  };
}

function tokensEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
