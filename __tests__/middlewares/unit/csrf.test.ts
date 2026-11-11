import { describe, expect, it, vi } from 'vitest';
import { csrfProtection } from '../../../src/middlewares/src/csrf';

function makeRequest(overrides: Record<string, any> = {}) {
  const headers: Record<string, string | string[]> = overrides.headers ?? {};
  const cookies: Record<string, string> = overrides.cookies ?? {};
  return {
    method: 'GET',
    path: '/resource',
    headers,
    cookies,
    getHeader: (name: string) => headers[name.toLowerCase()],
    getCookie: (name: string) => cookies[name],
    isSecure: () => overrides.secure ?? false,
    ...overrides,
  } as any;
}

function makeResponse() {
  return {
    setCookie: vi.fn(),
  } as any;
}

describe('csrfProtection', () => {
  it('issues a token cookie on safe requests', async () => {
    const middleware = csrfProtection();
    const request = makeRequest();
    const response = makeResponse();
    const next = vi.fn();

    await middleware(request, response, next);

    expect(response.setCookie).toHaveBeenCalledOnce();
    const [name, token, options] = response.setCookie.mock.calls[0];
    expect(name).toBe('csrf_token');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(options).toEqual({ secure: false, httpOnly: false, sameSite: 'lax' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('does not replace an existing token', async () => {
    const middleware = csrfProtection();
    const request = makeRequest({ cookies: { csrf_token: 'existing' } });
    const response = makeResponse();
    const next = vi.fn();

    await middleware(request, response, next);

    expect(response.setCookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('marks the token cookie secure on HTTPS requests', async () => {
    const middleware = csrfProtection();
    const response = makeResponse();

    await middleware(makeRequest({ secure: true }), response, vi.fn());

    expect(response.setCookie.mock.calls[0][2]).toMatchObject({ secure: true });
  });

  it('merges custom cookie options over the defaults', async () => {
    const middleware = csrfProtection({
      cookie: { path: '/app', sameSite: 'strict', secure: true, maxAge: 60 },
    });
    const response = makeResponse();

    await middleware(makeRequest(), response, vi.fn());

    expect(response.setCookie.mock.calls[0][2]).toEqual({
      secure: true,
      httpOnly: false,
      sameSite: 'strict',
      path: '/app',
      maxAge: 60,
    });
  });

  it('uses custom cookie and header names', async () => {
    const middleware = csrfProtection({ cookieName: 'app_csrf', headerName: 'x-app-csrf' });
    const request = makeRequest({
      method: 'POST',
      cookies: { app_csrf: 'token' },
      headers: { 'x-app-csrf': 'token' },
    });
    const next = vi.fn();

    await middleware(request, makeResponse(), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('accepts a matching token on unsafe methods', async () => {
    const middleware = csrfProtection();
    const request = makeRequest({
      method: 'POST',
      cookies: { csrf_token: 'token-value' },
      headers: { 'x-csrf-token': 'token-value' },
    });
    const next = vi.fn();

    await middleware(request, makeResponse(), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('uses the first value when the header repeats', async () => {
    const middleware = csrfProtection();
    const request = makeRequest({
      method: 'POST',
      cookies: { csrf_token: 'token-value' },
      headers: { 'x-csrf-token': ['token-value', 'other'] },
    });
    const next = vi.fn();

    await middleware(request, makeResponse(), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects an unsafe request without a cookie', async () => {
    const middleware = csrfProtection();
    const request = makeRequest({
      method: 'POST',
      headers: { 'x-csrf-token': 'token' },
    });

    await expect(middleware(request, makeResponse(), vi.fn())).rejects.toMatchObject({
      status: 403,
      message: 'Invalid CSRF token',
    });
  });

  it('rejects an unsafe request without a header', async () => {
    const middleware = csrfProtection();
    const request = makeRequest({ method: 'DELETE', cookies: { csrf_token: 'token' } });

    await expect(middleware(request, makeResponse(), vi.fn())).rejects.toMatchObject({
      status: 403,
    });
  });

  it('rejects tokens of equal length that differ', async () => {
    const middleware = csrfProtection();
    const request = makeRequest({
      method: 'PATCH',
      cookies: { csrf_token: 'aaaa' },
      headers: { 'x-csrf-token': 'bbbb' },
    });

    await expect(middleware(request, makeResponse(), vi.fn())).rejects.toMatchObject({
      status: 403,
    });
  });

  it('rejects tokens of different length without comparing them', async () => {
    const middleware = csrfProtection();
    const request = makeRequest({
      method: 'PUT',
      cookies: { csrf_token: 'short' },
      headers: { 'x-csrf-token': 'a-much-longer-token' },
    });

    await expect(middleware(request, makeResponse(), vi.fn())).rejects.toMatchObject({
      status: 403,
    });
  });

  it('honours a custom safe-method list', async () => {
    const middleware = csrfProtection({ safeMethods: ['POST'] });
    const response = makeResponse();
    const next = vi.fn();

    await middleware(makeRequest({ method: 'POST' }), response, next);

    expect(response.setCookie).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });

  it('treats HEAD and OPTIONS as safe by default', async () => {
    const middleware = csrfProtection();
    for (const method of ['HEAD', 'OPTIONS']) {
      const response = makeResponse();
      await middleware(makeRequest({ method }), response, vi.fn());
      expect(response.setCookie).toHaveBeenCalledOnce();
    }
  });

  it('includes the request path in the rejection', async () => {
    const middleware = csrfProtection();
    const request = makeRequest({ method: 'POST', path: '/orders/42' });

    await expect(middleware(request, makeResponse(), vi.fn())).rejects.toMatchObject({
      path: '/orders/42',
    });
  });
});
