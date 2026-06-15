import type { ControllerMeta, Request, Response, Route } from "@heliosjs/core/types";

export function makeRequest(overrides: Record<string, any> = {}): Request {
  const state = new Map<string, unknown>();
  const headers: Record<string, string | string[]> = overrides.headers ?? {};
  const query: Record<string, unknown> = overrides.query ?? {};
  const params: Record<string, string> = overrides.params ?? {};
  const base: any = {
    method: "GET",
    url: "/",
    path: "/",
    cookies: {},
    isBase64Encoded: false,
    userAgent: "",
    body: undefined,
    rawBody: undefined,
    ...overrides,
    headers,
    query,
    params,
    getHeader: (n: string) => headers[n.toLowerCase()] ?? headers[n],
    getParam: (n: string) => params[n],
    getQuery: (n: string) => query[n],
    getClientIp: () => overrides.ip ?? "127.0.0.1",
    getState: <T>(k: string) => state.get(k) as T | undefined,
    setState: (k: string, v: unknown) => {
      state.set(k, v);
    },
  };
  return base as Request;
}

export interface FakeResponse extends Response {
  errored?: Error;
}

export function makeResponse(): FakeResponse {
  const res: any = {
    status: 200,
    data: undefined,
    errored: undefined,
    error(e: Error) {
      this.errored = e;
    },
  };
  return res as FakeResponse;
}

export function makeRoute(overrides: Record<string, any> = {}): Route {
  return {
    name: "handler",
    route: "/",
    method: "GET",
    parameters: [],
    functions: [],
    fn: () => undefined,
    cors: undefined,
    ...overrides,
  } as unknown as Route;
}

export function makeControllerMeta(overrides: Record<string, any> = {}): ControllerMeta {
  return {
    prefix: "/",
    name: "root",
    routes: [],
    children: [],
    functions: [],
    controllers: [],
    ...overrides,
  } as unknown as ControllerMeta;
}
