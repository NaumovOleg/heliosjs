---
"@heliosjs/core": patch
---

Add Azure Functions as a recognized request/response source: `RequestSource`/`ResponseSource` now include `'azure'`, and `Request` gains `isAzure()`, `getAzureRequest()`, and `getAzureContext()` (mirroring the existing `isLambda()`/`getLambdaEvent()`/`getLambdaContext()`). Backs the new `@heliosjs/azure` adapter package.
