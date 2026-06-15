import { describe, expect, it } from "vitest";
import { matchRoutes } from "@heliosjs/core/utils";
import { makeControllerMeta, makeRoute } from "../helpers/http";

const meta = (routes: any[]) => makeControllerMeta({ routes });

describe("matchRoutes", () => {
  it("matches a static route by path and method", () => {
    const r = makeRoute({ route: "/users", method: "GET" });
    expect(matchRoutes(meta([r]), "/users", "GET")).toBe(r);
  });

  it("matches a parameterized route", () => {
    const r = makeRoute({ route: "/users/:id", method: "GET" });
    expect(matchRoutes(meta([r]), "/users/5", "GET")).toBe(r);
  });

  it("matches a wildcard route", () => {
    const r = makeRoute({ route: "/files/*", method: "GET" });
    expect(matchRoutes(meta([r]), "/files/a/b", "GET")).toBe(r);
  });

  it("does not match a different HTTP method", () => {
    const r = makeRoute({ route: "/users", method: "GET" });
    expect(matchRoutes(meta([r]), "/users", "POST")).toBeUndefined();
  });

  it("matches any method for an ANY route", () => {
    const r = makeRoute({ route: "/x", method: "ANY" });
    expect(matchRoutes(meta([r]), "/x", "DELETE")).toBe(r);
  });

  it("returns undefined when nothing matches", () => {
    const r = makeRoute({ route: "/users", method: "GET" });
    expect(matchRoutes(meta([r]), "/nope", "GET")).toBeUndefined();
  });

  it("returns the FIRST route by declaration order (first-match, not specificity)", () => {
    // FINDING: a wildcard declared before a specific route wins, because the
    // search returns on first match and the specificity sort is dead code.
    const wildcard = makeRoute({ route: "/*", method: "GET", name: "wild" });
    const specific = makeRoute({ route: "/users", method: "GET", name: "specific" });
    expect(matchRoutes(meta([wildcard, specific]), "/users", "GET")).toBe(wildcard);
  });
});
