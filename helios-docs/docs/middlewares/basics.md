# Middleware Decorators Basics

This document provides an overview of the middleware decorators available in the HeliosJS framework. Middleware decorators allow you to apply reusable logic such as error handling, CORS configuration, guards, interceptors, pipes, sanitization, and general middleware functions at the controller or method level.

## Available Middleware Decorators

- `@Catch`
- `@Cors`
- `@GuardClass`
- `@Intercept`
- `@Pipe`
- `@Sanitize`
- `@Use`

Each decorator is described in detail in its respective documentation file.

---

For detailed usage, parameters, examples, and remarks, please refer to the individual middleware documentation files:

- [Catch Middleware](catch.md)
- [Cors Middleware](cors.md)
- [GuardClass Middleware](guard.md)
- [Intercept Middleware](intercept.md)
- [Pipe Middleware](pipe.md)
- [Sanitize Middleware](sanitize.md)
- [Use Middleware](use.md)
