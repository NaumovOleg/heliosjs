import { describe, expect, it } from "vitest";
import { matchRoutes, execute } from "@heliosjs/core/utils";
import { makeControllerMeta, makeRoute, makeRequest, makeResponse } from "../helpers/http";

const meta = (routes: any[]) => makeControllerMeta({ routes });

describe("matchRoutes with OAuth callback query strings (external services)", () => {
  it("Google OAuth — matches /ping with full callback query string", () => {
    const route = makeRoute({ route: "/ping", method: "GET" });
    const url =
      "/ping?iss=https%3A%2F%2Faccounts.google.com&code=4%2F0ATsMZqCmA7u4_h902TYTLFiETrXVE5GjNP3qbTeoIDhOska5pdLpq7I2RjJVLrgUKQLXXw&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+openid&authuser=0&prompt=none";
    expect(matchRoutes(meta([route]), url, "GET")).toBe(route);
  });

  it("GitHub OAuth — matches /callback with code+state", () => {
    const route = makeRoute({ route: "/callback", method: "GET" });
    expect(
      matchRoutes(meta([route]), "/callback?code=Ov23liFakeCode&state=xyz123", "GET")
    ).toBe(route);
  });

  it("Discord OAuth — matches /auth/discord with code+type", () => {
    const route = makeRoute({ route: "/auth/discord", method: "GET" });
    expect(
      matchRoutes(meta([route]), "/auth/discord?code=fake_code&type=authorization", "GET")
    ).toBe(route);
  });

  it("Stripe webhook — matches POST /webhooks/stripe with sig", () => {
    const route = makeRoute({ route: "/webhooks/stripe", method: "POST" });
    expect(
      matchRoutes(meta([route]), "/webhooks/stripe?sig=t_1234567890", "POST")
    ).toBe(route);
  });

  it("Slack events — matches /slack/events with token+team_id", () => {
    const route = makeRoute({ route: "/slack/events", method: "POST" });
    expect(
      matchRoutes(meta([route]), "/slack/events?token=verification_token&team_id=T123", "POST")
    ).toBe(route);
  });

  it("parameterized route + query string — matches /users/:id", () => {
    const route = makeRoute({ route: "/users/:id", method: "GET" });
    expect(
      matchRoutes(meta([route]), "/users/42?token=abc&foo=bar", "GET")
    ).toBe(route);
  });

  it("wildcard route + query string — matches /webhooks/*", () => {
    const route = makeRoute({ route: "/webhooks/*", method: "POST" });
    expect(
      matchRoutes(meta([route]), "/webhooks/stripe?sig=t_123", "POST")
    ).toBe(route);
  });

  it("no false positive — different path with query string doesn't match", () => {
    const route = makeRoute({ route: "/ping", method: "GET" });
    expect(
      matchRoutes(meta([route]), "/pong?code=abc", "GET")
    ).toBeUndefined();
  });

  it("method mismatch still rejects — POST to GET route with query string", () => {
    const route = makeRoute({ route: "/ping", method: "GET" });
    expect(
      matchRoutes(meta([route]), "/ping?code=abc", "POST")
    ).toBeUndefined();
  });
});

describe("execute with query-string URLs", () => {
  it("handler receives correct request when URL has query string", async () => {
    const route = makeRoute({
      route: "/ping",
      method: "GET",
      fn: (req: any) => req.url,
    });
    const req = makeRequest({
      url: "/ping?iss=https%3A%2F%2Faccounts.google.com&code=abc",
      path: "/ping",
      method: "GET",
    });
    const res = makeResponse();
    await execute(route, req, res);
    expect(res.data).toBe("/ping?iss=https%3A%2F%2Faccounts.google.com&code=abc");
  });

  it("handler receives query via request.query with OAuth params", async () => {
    const route = makeRoute({
      route: "/callback",
      method: "GET",
      fn: (req: any) => req.query,
    });
    const req = makeRequest({
      url: "/callback?code=Ov23li&state=xyz",
      path: "/callback",
      query: { code: "Ov23li", state: "xyz" },
      method: "GET",
    });
    const res = makeResponse();
    await execute(route, req, res);
    expect(res.data).toEqual({ code: "Ov23li", state: "xyz" });
  });

  it("handler receives body + query for POST with both", async () => {
    const route = makeRoute({
      route: "/webhook",
      method: "POST",
      parameters: [{ index: 0, type: "body" }],
      fn: (body: any) => body,
    });
    const req = makeRequest({
      url: "/webhook?source=github",
      path: "/webhook",
      query: { source: "github" },
      body: { event: "push" },
      method: "POST",
    });
    const res = makeResponse();
    await execute(route, req, res);
    expect(res.data).toEqual({ event: "push" });
  });
});
