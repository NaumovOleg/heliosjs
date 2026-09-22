import { describe, expect, it, vi } from 'vitest';
import { Controller, Get, Params } from '@heliosjs/core';
import { Helios } from '@heliosjs/aws';

// Real end-to-end coverage for @heliosjs/aws's plugin system — unlike
// __tests__/aws/unit/lambda-adapter.test.ts (a hand-mocked [CONTROLLER_REQUEST]
// that never touches routing), this runs a real @Controller/@Get through the
// full compiled pipeline (route matching, param extraction, handler) behind
// app.handler, mirroring what __tests__/http/e2e/http-plugins-pipeline.test.ts
// already proves for @heliosjs/http. Direct regression test for the Plugin
// consolidation (PluginDispatch in @heliosjs/core) on the AWS side.

// Realistic API Gateway REST (v1) event/context — the shape isRestApiEvent()
// recognizes (httpMethod + resource, no `version` field). request.path comes
// straight from event.path (see lambda.event.normalizers.ts), which is what
// the core router matches against — event.resource/pathParameters aren't
// consumed by routing at all (request.params gets overwritten by the router's
// own regex extraction in execute()), so only `path` needs to be real.
function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    httpMethod: 'GET',
    path: '/greet/world',
    resource: '/greet/{name}',
    headers: { host: 'api.example.com' },
    requestContext: { apiId: 'a', httpMethod: 'GET', identity: { sourceIp: '1.2.3.4' } },
    body: null,
    isBase64Encoded: false,
    ...overrides,
  };
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return { awsRequestId: 'req-1', functionName: 'fn', functionVersion: '1', ...overrides };
}

describe('AWS e2e: plugin lifecycle through a real routed controller', () => {
  it('onInit fires on registration; beforeRequest/beforeRoute/afterResponse fire per request; the real controller/route/param pipeline runs', async () => {
    @Controller('/greet')
    class GreetController {
      @Get('/:name')
      hello(@Params('name') name: string) {
        return { message: `hello ${name}` };
      }
    }

    const onInit = vi.fn();
    const beforeRequest = vi.fn();
    const beforeRoute = vi.fn();
    const afterResponse = vi.fn();

    const app = new Helios(GreetController);
    app.usePlugin({
      name: 'lifecycle',
      onInit,
      hooks: { beforeRequest, beforeRoute, afterResponse },
    });

    // onInit runs synchronously off usePlugin, not off the first request.
    expect(onInit).toHaveBeenCalledTimes(1);
    expect(onInit).toHaveBeenCalledWith(app);

    const event = makeEvent();
    const context = makeContext();
    const result: any = await app.handler(event, context, undefined as any);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ message: 'hello world' });

    expect(beforeRequest).toHaveBeenCalledTimes(1);
    expect(beforeRequest).toHaveBeenCalledWith(event, context);

    expect(beforeRoute).toHaveBeenCalledTimes(1);
    // beforeRoute gets the normalized core Request/Response, not the raw event.
    const [routedRequest] = beforeRoute.mock.calls[0];
    expect(routedRequest.path).toBe('/greet/world');
    expect(routedRequest.method).toBe('GET');

    expect(afterResponse).toHaveBeenCalledTimes(1);
    const [, afterResponseArg] = afterResponse.mock.calls[0];
    expect(afterResponseArg.data).toEqual({ message: 'hello world' });
  });

  it('fires the per-request hooks again on a second request, but onInit only once', async () => {
    @Controller('/ping')
    class PingController {
      @Get('/')
      ping() {
        return { ok: true };
      }
    }

    const onInit = vi.fn();
    const beforeRequest = vi.fn();

    const app = new Helios(PingController);
    app.usePlugin({ name: 'lifecycle', onInit, hooks: { beforeRequest } });

    const event = makeEvent({ path: '/ping', resource: '/ping' });
    await app.handler(event, makeContext(), undefined as never);
    await app.handler(event, makeContext(), undefined as never);

    expect(onInit).toHaveBeenCalledTimes(1);
    expect(beforeRequest).toHaveBeenCalledTimes(2);
  });
});
