import { describe, expect, it } from "vitest";
import { PayloadTooLargeError } from "@heliosjs/core/utils";

describe("PayloadTooLargeError", () => {
  it("maps to HTTP status 413 and code PAYLOAD_TOO_LARGE", () => {
    const err = new PayloadTooLargeError();
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(413);
    expect(err.code).toBe("PAYLOAD_TOO_LARGE");
    expect(err.name).toBe("PayloadTooLargeError");
  });

  it("accepts a custom message", () => {
    expect(new PayloadTooLargeError("too big").message).toBe("too big");
  });
});
