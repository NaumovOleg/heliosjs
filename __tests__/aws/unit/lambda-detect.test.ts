import { describe, expect, it } from 'vitest';
import {
  isRestApiEvent,
  isHttpApiEvent,
  getEventType,
  isAPIGatewayV2Context,
  isLambdaUrlContext,
  isAPIGatewayV1Context,
  isALBContext,
  isCloudFrontContext,
  isAPIGatewayV1Event,
  isAPIGatewayV2Event,
  isLambdaUrlEvent,
  isALBEvent,
  isCloudFrontEvent,
  getSourceIp,
  getQueryStringParameters,
  getMultiValueQueryStringParameters,
} from '../../../src/aws/src/utils/aws/lambda';

// Mock events
const restEvent = {
  httpMethod: 'GET',
  resource: '/users',
  path: '/users',
  headers: {},
  requestContext: { apiId: 'abc', httpMethod: 'GET', identity: { sourceIp: '1.2.3.4' } },
} as any;

const httpEvent = {
  version: '2.0',
  requestContext: { http: { method: 'GET', sourceIp: '1.2.3.4' }, apiId: 'abc', domainName: 'api.example.com' },
  rawPath: '/users',
  headers: {},
} as any;

const lambdaUrlEvent = {
  version: '2.0',
  rawPath: '/users',
  requestContext: { http: { method: 'GET', sourceIp: '1.2.3.4' }, domainName: 'abc.lambda-url.us-east-1.on.aws' },
  headers: {},
} as any;

const albEvent = {
  httpMethod: 'GET',
  path: '/users',
  headers: {},
  requestContext: { elb: { targetGroupArn: 'arn:aws:...' } },
} as any;

const cfEvent = {
  Records: [{ cf: { request: { method: 'GET', uri: '/users', headers: {}, clientIp: '1.2.3.4' } } }],
} as any;

describe('Event type detectors', () => {
  it('isRestApiEvent detects REST API', () => {
    expect(isRestApiEvent(restEvent)).toBe(true);
    expect(isRestApiEvent(httpEvent)).toBe(false);
  });

  it('isHttpApiEvent detects HTTP API v2', () => {
    expect(isHttpApiEvent(httpEvent)).toBe(true);
    expect(isHttpApiEvent(restEvent)).toBe(false);
    expect(isHttpApiEvent(lambdaUrlEvent)).toBe(false);
  });

  it('isLambdaUrlEvent detects Lambda URL', () => {
    expect(isLambdaUrlEvent(lambdaUrlEvent)).toBe(true);
    expect(isLambdaUrlEvent(httpEvent)).toBe(false);
  });

  it('isALBEvent detects ALB', () => {
    expect(isALBEvent(albEvent)).toBe(true);
    expect(isALBEvent(restEvent)).toBe(false);
  });

  it('isCloudFrontEvent detects CloudFront', () => {
    expect(isCloudFrontEvent(cfEvent)).toBe(true);
    expect(isCloudFrontEvent(restEvent)).toBe(false);
  });

  it('isAPIGatewayV1Event detects API GW v1', () => {
    expect(isAPIGatewayV1Event(restEvent)).toBe(true);
    expect(isAPIGatewayV1Event(httpEvent)).toBe(false);
  });

  it('isAPIGatewayV2Event detects API GW v2', () => {
    expect(isAPIGatewayV2Event(httpEvent)).toBe(true);
    expect(isAPIGatewayV2Event(lambdaUrlEvent)).toBe(false);
    expect(isAPIGatewayV2Event(restEvent)).toBe(false);
  });
});

describe('getEventType', () => {
  it('returns rest for REST API', () => {
    expect(getEventType(restEvent)).toBe('rest');
  });

  it('returns http for HTTP API v2', () => {
    expect(getEventType(httpEvent)).toBe('http');
  });

  it('returns url for Lambda URL', () => {
    expect(getEventType(lambdaUrlEvent)).toBe('url');
  });

  it('returns rest for ALB (fallback)', () => {
    expect(getEventType(albEvent)).toBe('rest');
  });

  it('returns rest for unknown event', () => {
    expect(getEventType({} as any)).toBe('rest');
  });

  it('returns rest for event with httpMethod+resource but no version', () => {
    expect(getEventType({ httpMethod: 'GET', resource: '/test' } as any)).toBe('rest');
  });

  it('returns http for event with version 2.0 but no http/apiId', () => {
    expect(getEventType({ version: '2.0' } as any)).toBe('http');
  });
});

describe('Context detectors', () => {
  it('isAPIGatewayV2Context detects v2 context', () => {
    expect(isAPIGatewayV2Context({ http: {}, apiId: 'abc' } as any)).toBe(true);
    expect(isAPIGatewayV2Context({ identity: {} } as any)).toBe(false);
  });

  it('isLambdaUrlContext detects lambda-url domain', () => {
    expect(isLambdaUrlContext({ http: {}, domainName: 'x.lambda-url.us-east-1.on.aws' } as any)).toBe(true);
    expect(isLambdaUrlContext({ http: {}, domainName: 'api.example.com' } as any)).toBe(false);
  });

  it('isAPIGatewayV1Context detects v1 context', () => {
    expect(isAPIGatewayV1Context({ identity: {}, httpMethod: 'GET' } as any)).toBe(true);
    expect(isAPIGatewayV1Context({ http: {} } as any)).toBe(false);
  });

  it('isALBContext detects ALB context', () => {
    expect(isALBContext({ elb: {} } as any)).toBe(true);
    expect(isALBContext({ identity: {} } as any)).toBe(false);
  });

  it('isCloudFrontContext detects CloudFront context', () => {
    expect(isCloudFrontContext({ distributionId: 'abc' } as any)).toBe(true);
    expect(isCloudFrontContext({ http: {} } as any)).toBe(false);
  });
});

describe('getSourceIp', () => {
  it('extracts from x-forwarded-for string', () => {
    const event = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, requestContext: {} } as any;
    expect(getSourceIp(event)).toBe('1.2.3.4');
  });

  it('extracts from x-forwarded-for array', () => {
    const event = { headers: { 'x-forwarded-for': ['1.2.3.4, 5.6.7.8'] }, requestContext: {} } as any;
    expect(getSourceIp(event)).toBe('1.2.3.4');
  });

  it('falls back to v2 context sourceIp', () => {
    const event = { headers: {}, requestContext: { http: { sourceIp: '9.8.7.6' }, apiId: 'abc' } } as any;
    expect(getSourceIp(event)).toBe('9.8.7.6');
  });

  it('falls back to v1 context identity.sourceIp', () => {
    const event = { headers: {}, requestContext: { identity: { sourceIp: '5.5.5.5' }, httpMethod: 'GET' } } as any;
    expect(getSourceIp(event)).toBe('5.5.5.5');
  });

  it('falls back to 0.0.0.0', () => {
    const event = { headers: {}, requestContext: {} } as any;
    expect(getSourceIp(event)).toBe('0.0.0.0');
  });
});

describe('getQueryStringParameters', () => {
  it('parses query string params', () => {
    const event = { queryStringParameters: { q: 'test', page: '1' } } as any;
    expect(getQueryStringParameters(event)).toEqual({ q: 'test', page: '1' });
  });

  it('handles null values', () => {
    const event = { queryStringParameters: { q: null, page: '1' } } as any;
    expect(getQueryStringParameters(event)).toEqual({ q: '', page: '1' });
  });

  it('handles undefined queryStringParameters', () => {
    const event = { queryStringParameters: undefined } as any;
    expect(getQueryStringParameters(event)).toEqual({});
  });
});

describe('getMultiValueQueryStringParameters', () => {
  it('parses multi-value params', () => {
    const event = { multiValueQueryStringParameters: { tags: ['a', 'b'] } } as any;
    expect(getMultiValueQueryStringParameters(event)).toEqual({ tags: ['a', 'b'] });
  });

  it('handles undefined', () => {
    const event = { multiValueQueryStringParameters: undefined } as any;
    expect(getMultiValueQueryStringParameters(event)).toEqual({});
  });
});
