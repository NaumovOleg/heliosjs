---
description: Protect cookie-authenticated routes with the double-submit-cookie CSRF middleware.
---

# CSRF Protection

`csrfProtection()` is an opt-in double-submit-cookie middleware for routes that
authenticate with browser cookies. It creates a readable CSRF token cookie on
safe requests and requires the same token in a request header for state-changing
methods.

## Basic Usage

```typescript
import { Server } from "@heliosjs/http";
import { csrfProtection } from "@heliosjs/middlewares";

const csrf = csrfProtection();

@Server({
  controllers: [AppController],
  middlewares: [csrf],
})
export class App {}
```

The defaults are:

- cookie: `csrf_token`
- header: `x-csrf-token`
- safe methods: `GET`, `HEAD`, `OPTIONS`
- token comparison: constant-time when lengths match

The browser or frontend client must read the cookie and copy it into the
configured header for `POST`, `PUT`, `PATCH`, `DELETE`, and any other unsafe
method:

```typescript
const token = document.cookie
  .split("; ")
  .find((part) => part.startsWith("csrf_token="))
  ?.split("=")[1];

await fetch("/api/profile", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-csrf-token": token ?? "",
  },
  body: JSON.stringify({ displayName: "Ada" }),
});
```

## Configuration

```typescript
const csrf = csrfProtection({
  cookieName: "app_csrf",
  headerName: "x-app-csrf",
  safeMethods: ["GET", "HEAD", "OPTIONS"],
  cookie: {
    path: "/",
    sameSite: "lax",
    secure: true,
  },
});
```

`csrfProtection()` is intended for cookie/session authentication. APIs that use
only bearer tokens in the `Authorization` header generally do not need this
middleware; enabling it there only adds an unnecessary cookie round trip.

CSRF protection does not replace authentication, authorization, CORS policy,
or XSS defenses. Keep `httpOnly: false` for the CSRF token because the client
must copy it into a header, but keep session/authentication cookies `httpOnly`
and `secure`.

## Related

- [CORS](./cors) — configure allowed browser origins
- [Guards](./guard) — authenticate and authorize requests
- [Cookies](../core-module/parameter-decorators#cookies-cookies) — read cookies in handlers
