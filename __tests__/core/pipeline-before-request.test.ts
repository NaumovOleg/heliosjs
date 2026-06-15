import { describe, expect, it } from "vitest";
import { beforeRequest, ForbiddenError } from "@heliosjs/core/utils";
import { makeRequest, makeResponse, makeRoute } from "../helpers/http";

describe("beforeRequest", () => {
  it("runs a passing guard then a middleware", async () => {
    const req = makeRequest();
    const route = makeRoute({
      functions: [
        { guard: () => true },
        {
          middleware: (r: any, _res: any, next: any) => {
            r.setState("mw", true);
            next();
          },
        },
      ],
    });
    await beforeRequest(req, makeResponse(), route);
    expect(req.getState("mw")).toBe(true);
  });

  it("rejects with ForbiddenError when a guard denies", async () => {
    const route = makeRoute({ functions: [{ guard: () => false }] });
    await expect(
      beforeRequest(makeRequest(), makeResponse(), route),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("runs guards and middleware in declaration order", async () => {
    const order: string[] = [];
    const route = makeRoute({
      functions: [
        {
          guard: () => {
            order.push("guard");
            return true;
          },
        },
        {
          middleware: (_r: any, _res: any, next: any) => {
            order.push("middleware");
            next();
          },
        },
      ],
    });
    await beforeRequest(makeRequest(), makeResponse(), route);
    expect(order).toEqual(["guard", "middleware"]);
  });

  it("applies a pipe transform to the request body", async () => {
    const req = makeRequest({ body: { a: 1 } });
    const route = makeRoute({
      functions: [{ pipe: { body: (b: any) => ({ ...b, piped: true }) } }],
    });
    await beforeRequest(req, makeResponse(), route);
    expect(req.body).toEqual({ a: 1, piped: true });
  });

  it("invokes a collected error handler when a later middleware throws", async () => {
    let handled: Error | undefined;
    const route = makeRoute({
      functions: [
        { errorHandler: (err: Error, _req: any, _res: any) => { handled = err; } },
        {
          middleware: () => {
            throw new Error("boom");
          },
        },
      ],
    });
    await beforeRequest(makeRequest(), makeResponse(), route);
    expect(handled?.message).toBe("boom");
  });

  it("rejects with the guard's string as the ForbiddenError message", async () => {
    const route = makeRoute({ functions: [{ guard: () => "no access" }] });
    await expect(
      beforeRequest(makeRequest(), makeResponse(), route),
    ).rejects.toThrow("no access");
  });
});
