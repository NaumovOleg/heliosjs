---
"@heliosjs/aws": patch
---

Fix a spoofable `sourceIp` for ALB-triggered Lambdas. ALB has no `requestContext.identity`/`http.sourceIp` field, so `X-Forwarded-For` was the only source — but the normalizer took the *first* (client-controlled) hop, letting any caller set their own `sourceIp` and defeat IP-based rate limiting, RBAC, or audit logging. It now takes the last hop, the one ALB itself appends, matching `Request.getClientIp()`'s existing (correct) reasoning.

Also removed `getSourceIp` from `utils/aws/lambda.ts`, a dead, unreachable duplicate of this same bug that wasn't called by any real request path, and made `runControllers`' unmatched-route error path read `response.data` consistently instead of a separately-null `processed.data`.
