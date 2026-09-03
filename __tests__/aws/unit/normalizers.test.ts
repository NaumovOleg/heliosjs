import { describe, expect, it } from 'vitest';
import {
  normalizeEvent,
  getLambdaEventType,
  normalizeLambdaFunctionUrlEvent,
  normalizeAPIGatewayV2Event,
  normalizeALBEvent,
  normalizeAPIGatewayEvent,
} from '../../../src/aws/src/utils/aws/lambda.event.normalizers';

function makeCtx(overrides: Record<string, any> = {}) {
  return { awsRequestId: 'req-123', functionName: 'test', functionVersion: '1', ...overrides } as any;
}

describe('getLambdaEventType', () => {
  it('detects apigateway', () => {
    const event = { httpMethod: 'GET', resource: '/x', requestContext: { apiId: 'a', httpMethod: 'GET', identity: { sourceIp: '1.1.1.1' } }, headers: {} } as any;
    expect(getLambdaEventType(event)).toBe('apigateway');
  });

  it('detects apigatewayv2', () => {
    const event = { version: '2.0', rawPath: '/x', requestContext: { http: { method: 'GET' }, apiId: 'a', domainName: 'api.example.com' }, headers: {} } as any;
    expect(getLambdaEventType(event)).toBe('apigatewayv2');
  });

  it('detects lambda-url', () => {
    const event = { version: '2.0', rawPath: '/x', requestContext: { http: { method: 'GET' }, domainName: 'x.lambda-url.us-east-1.on.aws' }, headers: {} } as any;
    expect(getLambdaEventType(event)).toBe('lambda-url');
  });

  it('detects alb', () => {
    const event = { httpMethod: 'GET', path: '/x', requestContext: { elb: { targetGroupArn: 'arn' } }, headers: {} } as any;
    expect(getLambdaEventType(event)).toBe('alb');
  });

  it('detects cloudfront', () => {
    const event = { Records: [{ cf: { request: { method: 'GET', uri: '/', headers: {}, clientIp: '1.1.1.1' } } }] } as any;
    expect(getLambdaEventType(event)).toBe('cloudfront');
  });

  it('returns unknown for unrecognized events', () => {
    expect(getLambdaEventType({} as any)).toBe('unknown');
  });
});

describe('normalizeEvent', () => {
  it('normalizes API Gateway v1 event', () => {
    const event = {
      httpMethod: 'GET', path: '/users', resource: '/users',
      headers: { host: 'api.example.com' },
      queryStringParameters: { page: '1' },
      pathParameters: { id: '123' },
      requestContext: { apiId: 'a', httpMethod: 'GET', identity: { sourceIp: '1.2.3.4' } },
      body: null, isBase64Encoded: false,
    } as any;
    const result = normalizeEvent(event, makeCtx());
    expect(result.method).toBe('GET');
    expect(result.path).toBe('/users');
    expect(result.params).toEqual({ id: '123' });
    expect(result.query).toEqual({ page: '1' });
    expect(result.source).toBe('lambda');
  });

  it('normalizes API Gateway v2 event', () => {
    const event = {
      version: '2.0', rawPath: '/users',
      headers: { host: 'api.example.com' },
      requestContext: { http: { method: 'POST', sourceIp: '5.6.7.8' }, apiId: 'a', domainName: 'api.example.com' },
      body: '{"name":"test"}', isBase64Encoded: false,
    } as any;
    const result = normalizeEvent(event, makeCtx());
    expect(result.method).toBe('POST');
    expect(result.path).toBe('/users');
    expect(result.sourceIp).toBe('5.6.7.8');
  });

  it('normalizes ALB event', () => {
    const event = {
      httpMethod: 'PUT', path: '/items',
      headers: { host: 'alb.example.com', 'user-agent': 'test-agent' },
      requestContext: { elb: { targetGroupArn: 'arn' } },
      body: '{"id":1}', isBase64Encoded: false,
    } as any;
    const result = normalizeEvent(event, makeCtx());
    expect(result.method).toBe('PUT');
    expect(result.path).toBe('/items');
  });

  it('normalizes Lambda Function URL event', () => {
    const event = {
      version: '2.0', rawPath: '/func', rawQueryString: 'key=val',
      headers: { host: 'x.lambda-url.us-east-1.on.aws' },
      requestContext: {
        http: { method: 'GET', sourceIp: '9.9.9.9', path: '/func', protocol: 'HTTP/1.1', userAgent: 'curl' },
        domainName: 'x.lambda-url.us-east-1.on.aws', accountId: '123', apiId: 'a',
        domainPrefix: 'x', requestId: 'r', routeKey: '$default', stage: '$default',
        time: '', timeEpoch: Date.now(),
      },
    } as any;
    const result = normalizeEvent(event, makeCtx());
    expect(result.method).toBe('GET');
    expect(result.path).toBe('/func');
    expect(result.query).toEqual({ key: 'val' });
  });

  it('throws for unknown event type', () => {
    expect(() => normalizeEvent({} as any, makeCtx())).toThrow('Unsupported event type');
  });
});

describe('normalizeLambdaFunctionUrlEvent', () => {
  it('handles cookies from event.cookies array', () => {
    const event = {
      version: '2.0', rawPath: '/test', rawQueryString: '',
      headers: { host: 'x.lambda-url.us-east-1.on.aws' },
      cookies: ['session=abc123', 'theme=dark'],
      requestContext: {
        http: { method: 'GET', sourceIp: '1.1.1.1', path: '/test', protocol: 'HTTP/1.1', userAgent: '' },
        domainName: 'x.lambda-url.us-east-1.on.aws', accountId: '1', apiId: 'a',
        domainPrefix: 'x', requestId: 'r', routeKey: '$default', stage: '$default',
        time: '', timeEpoch: Date.now(),
      },
    } as any;
    const result = normalizeLambdaFunctionUrlEvent(event, makeCtx());
    expect(result.cookies?.session).toBe('abc123');
    expect(result.cookies?.theme).toBe('dark');
  });

  it('parses base64-encoded body', () => {
    const body = Buffer.from('hello world').toString('base64');
    const event = {
      version: '2.0', rawPath: '/test', rawQueryString: '',
      headers: { host: 'x.lambda-url.us-east-1.on.aws' },
      body, isBase64Encoded: true,
      requestContext: {
        http: { method: 'POST', sourceIp: '1.1.1.1', path: '/test', protocol: 'HTTP/1.1', userAgent: '' },
        domainName: 'x.lambda-url.us-east-1.on.aws', accountId: '1', apiId: 'a',
        domainPrefix: 'x', requestId: 'r', routeKey: '$default', stage: '$default',
        time: '', timeEpoch: Date.now(),
      },
    } as any;
    const result = normalizeLambdaFunctionUrlEvent(event, makeCtx());
    expect(result.body).toBe('hello world');
  });

  it('parses JSON body from string', () => {
    const event = {
      version: '2.0', rawPath: '/test', rawQueryString: '',
      headers: { host: 'x.lambda-url.us-east-1.on.aws' },
      body: '{"key":"value"}', isBase64Encoded: false,
      requestContext: {
        http: { method: 'POST', sourceIp: '1.1.1.1', path: '/test', protocol: 'HTTP/1.1', userAgent: '' },
        domainName: 'x.lambda-url.us-east-1.on.aws', accountId: '1', apiId: 'a',
        domainPrefix: 'x', requestId: 'r', routeKey: '$default', stage: '$default',
        time: '', timeEpoch: Date.now(),
      },
    } as any;
    const result = normalizeLambdaFunctionUrlEvent(event, makeCtx());
    expect(result.body).toEqual({ key: 'value' });
  });

  it('uses rawQueryString when queryStringParameters is absent', () => {
    const event = {
      version: '2.0', rawPath: '/test', rawQueryString: 'a=1&b=2',
      headers: { host: 'x.lambda-url.us-east-1.on.aws' },
      requestContext: {
        http: { method: 'GET', sourceIp: '1.1.1.1', path: '/test', protocol: 'HTTP/1.1', userAgent: '' },
        domainName: 'x.lambda-url.us-east-1.on.aws', accountId: '1', apiId: 'a',
        domainPrefix: 'x', requestId: 'r', routeKey: '$default', stage: '$default',
        time: '', timeEpoch: Date.now(),
      },
    } as any;
    const result = normalizeLambdaFunctionUrlEvent(event, makeCtx());
    expect(result.query).toEqual({ a: '1', b: '2' });
  });

  it('uses x-forwarded-proto from headers', () => {
    const event = {
      version: '2.0', rawPath: '/test', rawQueryString: '',
      headers: { host: 'x.lambda-url.us-east-1.on.aws', 'x-forwarded-proto': 'https' },
      requestContext: {
        http: { method: 'GET', sourceIp: '1.1.1.1', path: '/test', protocol: 'HTTP/1.1', userAgent: '' },
        domainName: 'x.lambda-url.us-east-1.on.aws', accountId: '1', apiId: 'a',
        domainPrefix: 'x', requestId: 'r', routeKey: '$default', stage: '$default',
        time: '', timeEpoch: Date.now(),
      },
    } as any;
    const result = normalizeLambdaFunctionUrlEvent(event, makeCtx());
    expect(result.requestUrl?.protocol).toBe('https:');
  });
});

describe('normalizeAPIGatewayV2Event', () => {
  it('normalizes basic v2 event', () => {
    const event = {
      version: '2.0', rawPath: '/users',
      headers: { host: 'api.example.com', 'user-agent': 'curl' },
      requestContext: { http: { method: 'GET', sourceIp: '1.2.3.4' }, apiId: 'a', domainName: 'api.example.com' },
      queryStringParameters: { q: 'test' },
      pathParameters: { id: '42' },
      body: null, isBase64Encoded: false,
    } as any;
    const result = normalizeAPIGatewayV2Event(event, makeCtx());
    expect(result.method).toBe('GET');
    expect(result.query).toEqual({ q: 'test' });
    expect(result.params).toEqual({ id: '42' });
  });
});

describe('normalizeALBEvent', () => {
  it('normalizes ALB event with multi-value params', () => {
    const event = {
      httpMethod: 'GET', path: '/search',
      headers: { host: 'alb.example.com' },
      requestContext: { elb: { targetGroupArn: 'arn' } },
      queryStringParameters: { q: 'test' },
      multiValueQueryStringParameters: { tags: ['a', 'b'] },
    } as any;
    const result = normalizeALBEvent(event, makeCtx());
    expect(result.method).toBe('GET');
  });
});

describe('normalizeAPIGatewayEvent', () => {
  it('normalizes v1 event', () => {
    const event = {
      httpMethod: 'POST', path: '/create', resource: '/create',
      headers: { host: 'api.example.com', 'user-agent': 'Mozilla' },
      requestContext: { apiId: 'a', httpMethod: 'POST', identity: { sourceIp: '1.1.1.1' } },
      queryStringParameters: {},
      pathParameters: {},
      body: '{"name":"test"}', isBase64Encoded: false,
    } as any;
    const result = normalizeAPIGatewayEvent(event, makeCtx());
    expect(result.method).toBe('POST');
  });
});
