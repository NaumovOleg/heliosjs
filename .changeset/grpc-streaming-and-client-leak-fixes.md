---
"@heliosjs/grpc": patch
---

Fix four bugs found reviewing streaming support and lifecycle cleanup:

- `GrpcServer`'s `executeHandler` catch block always called `callback(...)`, but grpc-js invokes a response-streaming/bidi handler as `(call)` alone (no callback). A handler that threw synchronously before subscribing to an Observable produced `TypeError: callback is not a function`, an unhandled rejection that could crash the process. Now reports through `call.destroy(...)` when there's no callback.
- `GrpcClient.getService()` wrapped every proto method as unary (callback-shaped). A server-streaming/bidi call's real stream object was discarded and its callback never invoked, so the returned Observable never emitted — a streaming client call hung forever. Now reads `requestStream`/`responseStream` off each generated method and wires stream events for server-streaming, and errors immediately (instead of hanging) for client-streaming/bidi, which `getService()`'s one-call-in/one-Observable-out shape can't express.
- `GrpcModule.stop()` stopped the server but never closed the named `GrpcClient`s registered via `forRoot({ clients })`, leaking their channels on shutdown.
- `toPromise()`'s subscription teardown read a `const subscription` that a synchronously-emitting source (e.g. a `BehaviorSubject`) could reference before it was assigned — a TDZ `ReferenceError` that RxJS re-throws on the next tick, crashing the process rather than just failing the promise.
