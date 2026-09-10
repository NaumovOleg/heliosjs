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

  it("prefers the more specific route over declaration order", () => {
    const wildcard = makeRoute({ route: "/*", method: "GET", name: "wild" });
    const specific = makeRoute({ route: "/users", method: "GET", name: "specific" });
    expect(matchRoutes(meta([wildcard, specific]), "/users", "GET")).toBe(specific);
  });

  it("prefers a static child route over a parent param route", () => {
    const param = makeRoute({ route: "/api/ping/:id", method: "GET" });
    const exact = makeRoute({ route: "/api/ping/ddd", method: "GET" });
    const tree = makeControllerMeta({ routes: [param], children: [meta([exact])] });
    expect(matchRoutes(tree, "/api/ping/ddd", "GET")).toBe(exact);
    expect(matchRoutes(tree, "/api/ping/42", "GET")).toBe(param);
  });

  it("ranks static > regex param > param > optional > wildcard", () => {
    const routes = ["/a/*", "/a/:id?", "/a/:id", "/a/:id(\\d+)", "/a/1"].map((route) =>
      makeRoute({ route, method: "GET" })
    );
    expect(matchRoutes(meta(routes), "/a/1", "GET")!.route).toBe("/a/1");
    expect(matchRoutes(meta(routes.slice(0, 4)), "/a/1", "GET")!.route).toBe("/a/:id(\\d+)");
    expect(matchRoutes(meta(routes.slice(0, 3)), "/a/1", "GET")!.route).toBe("/a/:id");
    expect(matchRoutes(meta(routes.slice(0, 2)), "/a/1", "GET")!.route).toBe("/a/:id?");
  });

  it("keeps declaration order for equally specific routes", () => {
    const first = makeRoute({ route: "/u/:a", method: "GET" });
    const second = makeRoute({ route: "/u/:b", method: "GET" });
    expect(matchRoutes(meta([first, second]), "/u/1", "GET")).toBe(first);
  });
});
