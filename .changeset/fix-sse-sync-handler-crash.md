---
"@heliosjs/core": patch
---

Fix `SSEServer.triggerHandlers` crashing when an `@OnSSE` handler is a
synchronous function (or otherwise doesn't return a promise). It called
`handler.fn(event).catch(...)` unconditionally, which throws
`Cannot read properties of undefined (reading 'catch')` for a non-thenable
return value — taking down connection/close event dispatch for every other
handler too. Now wraps the call in `Promise.resolve(...)` first, matching
the equivalent try/catch in `WebSocketServer.triggerHandlers`.
