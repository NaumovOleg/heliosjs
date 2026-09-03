import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RequestFactory } from '../../../src/aws/src/utils/aws/request.factory';
import { ResponseFactory } from '../../../src/aws/src/utils/aws/response.factory';

const ctx = { awsRequestId: 'req-1', functionName: 'fn', functionVersion: '1' } as any;

describe('RequestFactory', () => {
  it('creates Req from API Gateway v1 event', () => {
    const event = {
      httpMethod: 'GET', path: '/users', resource: '/users',
      headers: { host: 'api.example.com' },
      requestContext: { apiId: 'a', httpMethod: 'GET', identity: { sourceIp: '1.2.3.4' } },
      body: null, isBase64Encoded: false,
    } as any;
    const req = RequestFactory.create(event, ctx);
    expect(req.method).toBe('GET');
    expect(req.url).toContain('/users');
    expect(req.source).toBe('lambda');
  });

  it('creates Req from API Gateway v2 event', () => {
    const event = {
      version: '2.0', rawPath: '/items',
      headers: { host: 'api.example.com' },
      requestContext: { http: { method: 'POST', sourceIp: '5.6.7.8' }, apiId: 'a', domainName: 'api.example.com' },
      body: '{"id":1}', isBase64Encoded: false,
    } as any;
    const req = RequestFactory.create(event, ctx);
    expect(req.method).toBe('POST');
  });

  it('creates Req from Lambda URL event', () => {
    const event = {
      version: '2.0', rawPath: '/func', rawQueryString: 'key=val',
      headers: { host: 'x.lambda-url.us-east-1.on.aws' },
      requestContext: {
        http: { method: 'GET', sourceIp: '1.1.1.1', path: '/func', protocol: 'HTTP/1.1', userAgent: '' },
        domainName: 'x.lambda-url.us-east-1.on.aws', accountId: '1', apiId: 'a',
        domainPrefix: 'x', requestId: 'r', routeKey: '$default', stage: '$default',
        time: '', timeEpoch: Date.now(),
      },
    } as any;
    const req = RequestFactory.create(event, ctx);
    expect(req.method).toBe('GET');
  });
});

describe('ResponseFactory', () => {
  it('creates Res with lambda source', () => {
    const meta = { method: 'GET', url: '/test' } as any;
    const res = ResponseFactory.create(meta);
    expect(res).toBeDefined();
  });
});
