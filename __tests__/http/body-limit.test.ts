import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { PayloadTooLargeError } from "@heliosjs/core/utils";
import {
  collectRawBody,
  DEFAULT_BODY_LIMIT,
} from "../../src/http/src/utils/http/body";

function makeReq(headers: Record<string, string> = {}) {
  const req = new EventEmitter() as any;
  req.headers = headers;
  req.destroyed = false;
  req.destroy = () => {
    req.destroyed = true;
  };
  return req;
}

describe("DEFAULT_BODY_LIMIT", () => {
  it("is 1 MB", () => {
    expect(DEFAULT_BODY_LIMIT).toBe(1_048_576);
  });
});

describe("collectRawBody", () => {
  it("resolves the full buffer when under the limit", async () => {
    const req = makeReq();
    const p = collectRawBody(req, 100);
    req.emit("data", Buffer.from("hello"));
    req.emit("end");
    await expect(p).resolves.toEqual(Buffer.from("hello"));
  });

  it("rejects early when content-length exceeds the limit", async () => {
    const req = makeReq({ "content-length": "999" });
    await expect(collectRawBody(req, 100)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(req.destroyed).toBe(true);
  });

  it("rejects mid-stream when actual bytes exceed the limit (no content-length)", async () => {
    const req = makeReq();
    const p = collectRawBody(req, 4);
    req.emit("data", Buffer.from("abcde")); // 5 bytes > 4
    await expect(p).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(req.destroyed).toBe(true);
  });

  it("disables the limit when maxBytes is 0", async () => {
    const req = makeReq({ "content-length": "100000" });
    const p = collectRawBody(req, 0);
    req.emit("data", Buffer.from("x".repeat(5000)));
    req.emit("end");
    await expect(p).resolves.toBeInstanceOf(Buffer);
  });

  it("propagates stream errors", async () => {
    const req = makeReq();
    const p = collectRawBody(req, 100);
    req.emit("error", new Error("socket boom"));
    await expect(p).rejects.toThrow("socket boom");
  });
});
