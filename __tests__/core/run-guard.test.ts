import { describe, expect, it } from "vitest";
import { ForbiddenError, runGuard } from "@heliosjs/core/utils";
import type { Request, Response } from "@heliosjs/core/types";

const req = {} as Request;
const res = {} as Response;

describe("runGuard (class and instance guards)", () => {
  it("allows when a class guard's canActivate returns true", async () => {
    class AllowGuard {
      canActivate() {
        return true;
      }
    }
    await expect(runGuard(AllowGuard, req, res)).resolves.toBeUndefined();
  });

  it("rejects with ForbiddenError when a class guard denies", async () => {
    class DenyGuard {
      canActivate() {
        return false;
      }
    }
    await expect(runGuard(DenyGuard, req, res)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("uses an instance guard's message on denial", async () => {
    const guard = { canActivate: () => false, message: "nope" };
    await expect(runGuard(guard, req, res)).rejects.toThrow("nope");
  });

  it("allows when an instance guard's canActivate returns true", async () => {
    const guard = { canActivate: () => true };
    await expect(runGuard(guard, req, res)).resolves.toBeUndefined();
  });

  it("rejects with the guard's own Error instead of ForbiddenError", async () => {
    class CustomError extends Error {
      status = 402;
    }
    const custom = new CustomError('Payment required');
    const guard = { canActivate: () => custom };
    await expect(runGuard(guard, req, res)).rejects.toBe(custom);
  });

  it("propagates a function guard's returned Error", async () => {
    const custom = new Error('nope');
    await expect(runGuard(() => custom, req, res)).rejects.toBe(custom);
  });

  it("allows when a function guard returns nothing", async () => {
    await expect(runGuard(() => undefined, req, res)).resolves.toBeUndefined();
  });

  it("allows when a class guard's canActivate returns nothing", async () => {
    class VoidGuard {
      canActivate() {
        // no return
      }
    }
    await expect(runGuard(VoidGuard, req, res)).resolves.toBeUndefined();
  });
});
