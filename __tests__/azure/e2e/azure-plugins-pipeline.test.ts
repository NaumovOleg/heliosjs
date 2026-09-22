import { describe, expect, it, vi } from 'vitest';
import { HttpRequest, InvocationContext } from '@azure/functions';
import { Controller, Get, Params } from '@heliosjs/core';
import { Helios } from '@heliosjs/azure';

// Real end-to-end coverage for @heliosjs/azure's plugin system — unlike
// __tests__/azure/unit/functions-adapter.test.ts (a hand-mocked
// [CONTROLLER_REQUEST] that never touches routing), this runs a real
// @Controller/@Get through the full compiled pipeline (route matching, param
// extraction, handler) behind app.handler, mirroring what
// __tests__/http/e2e/http-plugins-pipeline.test.ts already proves for
// @heliosjs/http. Direct regression test for the Plugin consolidation
// (PluginDispatch in @heliosjs/core) on the Azure side.

// Real HttpRequest/InvocationContext (from @azure/functions itself, not hand-
// rolled) — same fixture shape __tests__/azure/unit/functions-adapter.test.ts
// already uses. request.path comes from `new URL(req.url).pathname` (see
// request.normalizer.ts), which is what the core router matches against.
function makeRequest(overrides: ConstructorParameters<typeof HttpRequest>[0] = {}): HttpRequest {
  return new HttpRequest({
    method: 'GET',
    url: 'https://fn.azurewebsites.net/greet/world',
    headers: { host: 'fn.azurewebsites.net' },
    ...overrides,
  });
}

function makeContext(overrides: Record<string, unknown> = {}): InvocationContext {
  return new InvocationContext({ functionName: 'fn', invocationId: 'inv-1', ...overrides });
}

describe('Azure e2e: plugin lifecycle through a real routed controller', () => {
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

    const req = makeRequest();
    const context = makeContext();
    const result = await app.handler(req, context);

    expect(result.status).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual({ message: 'hello world' });

    expect(beforeRequest).toHaveBeenCalledTimes(1);
    const [rawReq, rawCtx] = beforeRequest.mock.calls[0];
    expect(rawReq).toBeInstanceOf(HttpRequest);
    expect(rawCtx).toBe(context);

    expect(beforeRoute).toHaveBeenCalledTimes(1);
    // beforeRoute gets the normalized core Request/Response, not the raw HttpRequest.
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

    const makePingRequest = () =>
      new HttpRequest({
        method: 'GET',
        url: 'https://fn.azurewebsites.net/ping',
        headers: { host: 'fn.azurewebsites.net' },
      });

    await app.handler(makePingRequest(), makeContext());
    await app.handler(makePingRequest(), makeContext());

    expect(onInit).toHaveBeenCalledTimes(1);
    expect(beforeRequest).toHaveBeenCalledTimes(2);
  });
});
