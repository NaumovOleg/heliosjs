import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { request } from '../../../../src/core/src/descriptors/request';
import { CONTROLLER_PRECOMPILED } from '../../../../src/core/src/constants';
import { makeRequest, makeResponse, makeRoute, makeControllerMeta } from '../../../helpers/http';

function makeController(routes: any[] = []) {
  return {
    [CONTROLLER_PRECOMPILED]: makeControllerMeta({ routes }),
  };
}

describe('request descriptor', () => {
  it('calls execute when route matches', async () => {
    const route = makeRoute({ route: '/users', method: 'GET' });
    const controller = makeController([route]);
    const req = makeRequest({ path: '/users', method: 'GET' }) as any;
    const res = makeResponse() as any;

    const result = await request.call(controller as any, req, res);
    expect(result).toBeDefined();
  });

  it('returns null and calls response.error when no route matches', async () => {
    const controller = makeController([]);
    const req = makeRequest({ path: '/nonexistent', method: 'GET', url: '/nonexistent', requestId: 'req-1' }) as any;
    const res = makeResponse() as any;

    const result = await request.call(controller as any, req, res);
    expect(result).toBeNull();
    expect(res.errored).toBeDefined();
  });

  it('returns null for wrong method', async () => {
    const route = makeRoute({ route: '/users', method: 'GET' });
    const controller = makeController([route]);
    const req = makeRequest({ path: '/users', method: 'POST', url: '/users', requestId: 'req-2' }) as any;
    const res = makeResponse() as any;

    const result = await request.call(controller as any, req, res);
    expect(result).toBeNull();
  });
});
