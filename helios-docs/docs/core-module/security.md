---
sidebar_position: 9
description: Security defaults and deployment guidance for HeliosJS applications.
---

# Security Defaults

HeliosJS applies safe defaults at the request and transport boundaries, but the
application still owns authentication, authorization, secrets, and deployment
configuration.

## HTTP and Serverless

- HTTP responses include `nosniff`, `X-Frame-Options: DENY`, and a strict
  referrer policy. HSTS is added when the request is recognized as HTTPS.
- HTTP request bodies default to 1 MiB, including GraphQL requests. Set a
  finite `bodyLimit` appropriate for the endpoint.
- `trustProxy` is `false` for the Node HTTP adapter. Enable it only behind a
  proxy you control. AWS and Azure default it to `true` because their managed
  hosts provide the forwarded headers; disable it if that assumption does not
  hold.
- Set `canonicalHost` when the incoming `Host` header is not authoritative.
  This protects generated absolute URLs and redirects from host-header spoofing.
- Configure CORS explicitly for browser clients. Credentialed CORS requires an
  explicit allow-list or predicate; wildcard and omitted origins are rejected.

## Errors and Validation

- Unexpected 5xx responses use a generic message and omit stack/details.
- Validation details redact passwords, tokens, API keys, authorization values,
  and other sensitive fields.
- DTO validation rejects undeclared properties by default. Opt out only for
  DTOs that intentionally accept arbitrary fields.
- Custom error handlers must log safely and return a client-safe response; do
  not serialize raw exceptions or upstream response bodies to callers.

## Files and Streaming

- Static file mounts reject traversal and symlink escapes outside the configured
  root. Dotfiles are ignored by default.
- WebSocket connections support origin/authentication hooks, payload and
  connection limits, per-client message budgets, topic authorization, and
  slow-consumer protection. Client topic subscribe/publish frames are disabled
  by default.
- SSE supports origin/authentication checks, connection and event-size limits,
  and heartbeats. Check the return value of `createConnection()`.
- gRPC defaults to 4 MiB message limits and rejects plaintext non-loopback
  connections unless `allowInsecure: true` is explicitly set.

## Deployment Checklist

1. Use TLS at the public edge and configure `trustProxy` only for trusted hops.
2. Set explicit CORS origins and enable CSRF protection for cookie-authenticated
   browser routes.
3. Configure authentication for WebSocket, SSE, and gRPC entry points.
4. Keep body/message/connection limits finite and monitor 413/429/503 responses.
5. Keep framework diagnostics and stack traces out of public responses.
6. Run the current package major; older majors do not receive security fixes.

See the transport-specific pages for complete option tables and examples:
[HTTP](../http-module/server), [WebSocket](../http-module/websockets),
[SSE](../http-module/server-sent-events), [AWS](../aws/lambda-integration),
[Azure](../azure/functions-integration), and [gRPC](../grpc/usage).
