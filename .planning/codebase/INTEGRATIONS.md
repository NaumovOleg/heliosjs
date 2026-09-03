# External Integrations

**Analysis Date:** 2026-09-03

## APIs & External Services

**AWS Lambda:**
- AWS Lambda handler adapter via `@heliosjs/aws`
  - SDK/Client: `aws-lambda` types
  - Supports API Gateway REST/HTTP events and Lambda Function URLs
  - Auth: None (framework library, not a service)

**gRPC:**
- gRPC server/client via `@heliosjs/grpc`
  - SDK/Client: `@grpc/grpc-js` + `@grpc/proto-loader`
  - Proto-based service definitions

**GraphQL:**
- GraphQL Yoga server via `@heliosjs/http`
  - SDK/Client: `graphql-yoga`, `type-graphql`, `graphql-ws`
  - Supports subscriptions via WebSocket

## Data Storage

**Databases:**
- None detected - This is a framework library, not an application

**File Storage:**
- Local filesystem only (static file serving via `staticMiddleware`)

**Caching:**
- In-memory rate limit store (`MemoryStore`)
- No external cache (Redis/Memcached) detected

## Authentication & Identity

**Auth Provider:**
- None - RBAC is user-provided via `RolesExtractor` callback
  - Implementation: User injects `getRoles` function in server config

## Monitoring & Observability

**Error Tracking:**
- None - Error serialization via `ApplicationError` class

**Logs:**
- `console.log` for server startup banners
- `LOG_ERRORS` env flag in `.env`

## CI/CD & Deployment

**Hosting:**
- Published to npm registry (`https://registry.npmjs.org`)

**CI Pipeline:**
- GitHub Actions (`.github/` directory present)
- Changesets for versioning/publishing

## Environment Configuration

**Required env vars:**
- `NPM_TOKEN` - npm publish authentication
- `LOG_ERRORS` - Error logging toggle
- `NODE_ENV` - Controls stack trace inclusion in errors

**Secrets location:**
- `.env` file (committed - contains `NPM_TOKEN`)

## Webhooks & Callbacks

**Incoming:**
- HTTP request handler (`Helios.requestHandler`)
- WebSocket connections (`/ws` path)
- GraphQL subscriptions (`/graphql` path)

**Outgoing:**
- None detected

---

*Integration audit: 2026-09-03*
