import { describe, expect, it } from "vitest";
import { execute } from "@heliosjs/core/utils";
import { makeRequest, makeResponse, makeRoute } from "../helpers/http";

describe("execute", () => {
  it("calls the handler with (request, response) when there are no params", async () => {
    const req = makeRequest({ url: "/" });
    const res = makeResponse();
    let gotReq: unknown;
    let gotRes: unknown;
    const route = makeRoute({
      route: "/",
      fn: (a: any, b: any) => {
        gotReq = a;
        gotRes = b;
        return "ok";
      },
    });
    await execute(route, req, res);
    expect(gotReq).toBe(req);
    expect(gotRes).toBe(res);
    expect(res.data).toBe("ok");
    expect(res.status).toBe(200);
  });

  it("injects the request for a 'request' param", async () => {
    const route = makeRoute({
      route: "/",
      parameters: [{ index: 0, type: "request" }],
      fn: (req: any) => req.method,
    });
    const res = makeResponse();
    await execute(route, makeRequest({ url: "/", method: "GET" }), res);
    expect(res.data).toBe("GET");
  });

  it("injects a computed fingerprint for a 'fingerprint' param", async () => {
    const route = makeRoute({
      route: "/",
      parameters: [{ index: 0, type: "fingerprint" }],
      fn: (fp: string) => fp,
    });
    const res = makeResponse();
    await execute(route, makeRequest({ url: "/" }), res);
    expect(typeof res.data).toBe("string");
    expect((res.data as string).length).toBe(64); // sha256 hex
  });

  it("passes a no-DTO 'body' param straight through", async () => {
    const route = makeRoute({
      route: "/",
      parameters: [{ index: 0, type: "body" }],
      fn: (b: any) => b,
    });
    const res = makeResponse();
    await execute(route, makeRequest({ url: "/", body: { x: 1 } }), res);
    expect(res.data).toEqual({ x: 1 });
  });

  it("applies the configured status", async () => {
    const route = makeRoute({ route: "/", functions: [{ status: 201 }], fn: () => "x" });
    const res = makeResponse();
    await execute(route, makeRequest({ url: "/" }), res);
    expect(res.status).toBe(201);
  });

  it("applies interceptors to the handler result with correct req/res args", async () => {
    let seenReq: unknown = "unset";
    let seenRes: unknown = "unset";
    const route = makeRoute({
      route: "/",
      functions: [
        {
          interceptor: (data: any, req: any, res: any) => {
            seenReq = req;
            seenRes = res;
            return { ...data, wrapped: true };
          },
        },
      ],
      fn: () => ({ a: 1 }),
    });
    const res = makeResponse();
    const req = makeRequest({ url: "/" });
    await execute(route, req, res);
    expect(res.data).toEqual({ a: 1, wrapped: true });
    expect(seenReq).toBe(req);
    expect(seenRes).toBe(res);
  });

  it("routes a handler that returns an Error to response.error and skips interceptors", async () => {
    let intercepted = false;
    const err = new Error("handler failed");
    const route = makeRoute({
      route: "/",
      functions: [{ interceptor: (d: any) => { intercepted = true; return d; } }],
      fn: () => err,
    });
    const res = makeResponse();
    await execute(route, makeRequest({ url: "/" }), res);
    expect(res.errored).toBe(err);
    expect(intercepted).toBe(false);
  });
});
