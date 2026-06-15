import { describe, expect, it } from "vitest";
import {
  parseBody,
  parseHeaders,
  parseQuery,
  parseRequestCookie,
} from "@heliosjs/core/utils";

describe("parseQuery", () => {
  it("returns a single value as a string", () => {
    expect(parseQuery(new URL("http://x/?a=1"))).toEqual({ a: "1" });
  });
  it("returns repeated keys as an array", () => {
    expect(parseQuery(new URL("http://x/?b=2&b=3"))).toEqual({ b: ["2", "3"] });
  });
  it("returns an empty object when there is no query", () => {
    expect(parseQuery(new URL("http://x/"))).toEqual({});
  });
});

describe("parseBody", () => {
  it("returns an already-parsed object unchanged", () => {
    const obj = { x: 1 };
    expect(parseBody({ body: obj, headers: {} })).toBe(obj);
  });
  it("returns undefined for an empty body", () => {
    expect(parseBody({ body: "", headers: {} })).toBeUndefined();
    expect(parseBody({ body: undefined, headers: {} })).toBeUndefined();
  });
  it("parses a JSON body", () => {
    expect(
      parseBody({
        body: Buffer.from('{"a":1}'),
        headers: { "content-type": "application/json" },
      }),
    ).toEqual({ a: 1 });
  });
  it("returns the raw string on malformed JSON", () => {
    expect(
      parseBody({
        body: Buffer.from("{bad"),
        headers: { "content-type": "application/json" },
      }),
    ).toBe("{bad");
  });
  it("returns text bodies as a string", () => {
    expect(
      parseBody({ body: Buffer.from("hi"), headers: { "content-type": "text/plain" } }),
    ).toBe("hi");
  });
  it("parses urlencoded bodies, repeated keys as arrays", () => {
    expect(
      parseBody({
        body: Buffer.from("a=1&a=2&b=3"),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
    ).toEqual({ a: ["1", "2"], b: "3" });
  });
  it("returns a buffer with no content-type as a utf8 string", () => {
    expect(parseBody({ body: Buffer.from("raw"), headers: {} })).toBe("raw");
  });

  it("base64-decodes the body when isBase64Encoded is set", () => {
    const b64 = Buffer.from('{"a":1}').toString("base64");
    expect(
      parseBody({
        body: b64,
        headers: { "content-type": "application/json" },
        isBase64Encoded: true,
      }),
    ).toEqual({ a: 1 });
  });

  it("uses the first content-type when the header is an array", () => {
    expect(
      parseBody({
        body: Buffer.from('{"a":1}'),
        headers: { "content-type": ["application/json", "charset=utf-8"] },
      }),
    ).toEqual({ a: 1 });
  });

  it("returns XML bodies as a string", () => {
    expect(
      parseBody({ body: Buffer.from("<x/>"), headers: { "content-type": "application/xml" } }),
    ).toBe("<x/>");
  });

  it("wraps multipart bodies in a multipart descriptor", () => {
    const body = Buffer.from("data");
    const result: any = parseBody({
      body,
      headers: { "content-type": "multipart/form-data; boundary=xyz" },
    });
    expect(result.multipart).toBe(true);
    expect(result.contentType).toBe("multipart/form-data; boundary=xyz");
  });

  it("strips a BOM / non-printable characters from text bodies", () => {
    expect(
      parseBody({
        body: Buffer.from("﻿hi"),
        headers: { "content-type": "text/plain" },
      }),
    ).toBe("hi");
  });
});

describe("parseRequestCookie", () => {
  it("parses a cookie header into a map", () => {
    expect(parseRequestCookie("a=1; b=2")).toEqual({ a: "1", b: "2" });
  });
  it("url-decodes values", () => {
    expect(parseRequestCookie("x=%20")).toEqual({ x: " " });
  });
  it("returns an empty object for no cookies", () => {
    expect(parseRequestCookie(undefined)).toEqual({});
  });

  it("merges an array of cookie headers", () => {
    expect(parseRequestCookie(["a=1", "b=2"])).toEqual({ a: "1", b: "2" });
  });
});

describe("parseHeaders", () => {
  it("copies defined entries and drops undefined ones", () => {
    expect(parseHeaders({ a: "1", b: undefined })).toEqual({ a: "1" });
  });
  it("returns an empty object when headers are undefined", () => {
    expect(parseHeaders(undefined)).toEqual({});
  });
});
