import { describe, expect, it } from 'vitest';
import { HttpRequest, InvocationContext } from '@azure/functions';
import { RequestFactory } from '../../../src/azure/src/utils/azure/request.factory';
import { ResponseFactory } from '../../../src/azure/src/utils/azure/response.factory';

const ctx = new InvocationContext({ functionName: 'fn', invocationId: 'inv-1' });

describe('RequestFactory', () => {
  it('creates Req from an Azure HttpRequest', async () => {
    const req = new HttpRequest({
      method: 'POST',
      url: 'https://fn.azurewebsites.net/api/users?page=1',
      headers: { 'content-type': 'application/json' },
      body: { string: JSON.stringify({ id: 1 }) },
    });
    const result = await RequestFactory.create(req, ctx);
    expect(result.method).toBe('POST');
    expect(result.source).toBe('azure');
    expect(result.requestId).toBe('inv-1');
    expect(result.body).toEqual({ id: 1 });
  });

  it('defaults trustProxy to true', async () => {
    const req = new HttpRequest({ method: 'GET', url: 'https://fn.azurewebsites.net/api/x' });
    const result = await RequestFactory.create(req, ctx);
    expect(result.trustProxy).toBe(true);
  });

  it('honors an explicit trustProxy: false', async () => {
    const req = new HttpRequest({ method: 'GET', url: 'https://fn.azurewebsites.net/api/x' });
    const result = await RequestFactory.create(req, ctx, false);
    expect(result.trustProxy).toBe(false);
  });
});

describe('ResponseFactory', () => {
  it('creates Res with azure source', () => {
    const meta = { method: 'GET', url: '/test' } as any;
    const res = ResponseFactory.create(meta);
    expect(res.source).toBe('azure');
  });
});
