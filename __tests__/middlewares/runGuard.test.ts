import { describe, expect, it } from 'vitest';
import { ForbiddenError, runGuard } from '@heliosjs/core/utils';
import type { Request, Response } from '@heliosjs/core/types';

const req = {} as Request;
const res = {} as Response;

describe('runGuard (function guard)', () => {
  it('allows when the guard returns true', async () => {
    await expect(runGuard(() => true, req, res)).resolves.toBeUndefined();
  });

  it('rejects with ForbiddenError when the guard returns false', async () => {
    await expect(runGuard(() => false, req, res)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects with the returned string as message', async () => {
    await expect(runGuard(() => 'nope', req, res)).rejects.toThrow('nope');
  });
});
