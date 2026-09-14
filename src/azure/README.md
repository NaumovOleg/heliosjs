# HeliosJS

🎯 A modern decorator-based Node.js framework for building scalable applications.

## Documentation

👉 **[Full Documentation](https://naumovoleg.github.io/heliosjs/)**

## Packages

| Package                                                                                     | Version | Description             |
| ------------------------------------------------------------------------------------------- | ------- | ----------------------- |
| [@heliosjs/core](https://github.com/NaumovOleg/heliosjs/tree/master/src/core)               |         | Core decorators and DI  |
| [@heliosjs/http](https://github.com/NaumovOleg/heliosjs/tree/master/src/http)               |         | HTTP server and routing |
| [@heliosjs/middlewares](https://github.com/NaumovOleg/heliosjs/tree/master/src/middlewares) |         | Built-in middlewares    |
| [@heliosjs/aws](https://github.com/NaumovOleg/heliosjs/tree/master/src/aws)                 |         | Aws support             |
| [@heliosjs/azure](https://github.com/NaumovOleg/heliosjs/tree/master/src/azure)             |         | Azure Functions support |
| [@heliosjs/grpc](https://github.com/NaumovOleg/heliosjs/tree/master/src/grpc)               |         | Grpc support            |

## Quick Start

```bash
npm install @heliosjs/core @heliosjs/azure @azure/functions reflect-metadata
```

```typescript
import { app } from '@azure/functions';
import { Helios } from '@heliosjs/azure';
import { AppController } from './app.controller';

const helios = new Helios(AppController);

app.http('api', {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  authLevel: 'anonymous',
  route: '{*path}',
  handler: helios.handler,
});
```

> Azure Functions prepends `host.json`'s `routePrefix` (`"api"` by default) to
> every route above — set `"extensions": { "http": { "routePrefix": "" } }`
> in `host.json` if your controllers use bare paths like `/users`.
