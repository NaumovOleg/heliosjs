---
"@heliosjs/http": patch
---

Fix `sendResponse`'s error path never actually marking the response `500`
when the final `response.end()` write throws (e.g. a destroyed socket).
`Response.end()` sets its own `headersSent` flag `true` before attempting
the write (so a concurrent call short-circuits), so by the time `.end()`
throws, `response.headersSent` already reads `true` — the `if
(!response.headersSent)` guard around `response.status = 500` could never
pass. It now checks the raw transport's own `headersSent` flag instead,
which only becomes true once bytes actually went out.
