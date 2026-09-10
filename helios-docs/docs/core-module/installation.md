---
sidebar_position: 2
---

# Installation & Setup

## Prerequisites

```bash
node --version  # v20.0.0 or higher
```

## Step 1: Create a New Project

```bash
mkdir my-helios-app && cd my-helios-app
npm init -y
```

## Step 2: Install Packages

```bash
npm install @heliosjs/core @heliosjs/http reflect-metadata
```

For middleware support:

```bash
npm install @heliosjs/middlewares
```

For AWS Lambda:

```bash
npm install @heliosjs/aws
```

For gRPC:

```bash
npm install @heliosjs/grpc
```

| Package | Purpose |
|---------|---------|
| `@heliosjs/core` | Decorators, request/response, validation, error classes, rate limiting |
| `@heliosjs/http` | HTTP server, WebSocket, SSE, GraphQL |
| `@heliosjs/aws` | AWS Lambda adapter |
| `@heliosjs/middlewares` | `@Use`, `@Guard`, `@Roles`, `@Catch`, `@Intercept`, `@Pipe`, `@Sanitize`, `@Cors` |
| `@heliosjs/grpc` | gRPC server and client |
| `reflect-metadata` | Required for TypeScript decorators |

## Step 3: Install TypeScript

```bash
npm install -D typescript @types/node ts-node
```

## Step 4: Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strictPropertyInitialization": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

:::warning
You **must** enable both `experimentalDecorators` and `emitDecoratorMetadata`. Without them, HeliosJS decorators will not work.
:::

## Step 5: Project Structure

```
my-helios-app/
├── src/
│   ├── controllers/
│   │   └── user.controller.ts
│   ├── app.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── .gitignore
```

## Step 6: Create Your First Controller

Create `src/controllers/user.controller.ts`:

```typescript
import "reflect-metadata";
import { Controller, Get, Post, Body, Param, NotFoundError } from "@heliosjs/core";

interface User {
  id: number;
  name: string;
}

let users: User[] = [];
let nextId = 1;

@Controller("/users")
export class UserController {
  @Get("/")
  findAll(): User[] {
    return users;
  }

  @Get("/:id")
  findOne(@Param("id") id: string) {
    const user = users.find((u) => u.id === Number(id));
    if (!user) {
      throw new NotFoundError("User", id);
    }
    return user;
  }

  @Post("/")
  create(@Body() data: { name: string }) {
    const user: User = { id: nextId++, name: data.name };
    users.push(user);
    return user;
  }
}
```

## Step 7: Create the Server

Create `src/app.ts`:

```typescript
import { Server } from "@heliosjs/http";
import { UserController } from "./controllers/user.controller";

@Server({ controllers: [UserController] })
export class App {}
```

Create `src/index.ts`:

```typescript
import "reflect-metadata";
import { Helios } from "@heliosjs/http";
import { App } from "./app";

const server = new Helios(App);
server.listen(3000).then(() => {
  console.log("Server running on http://localhost:3000");
});
```

## Step 8: Add Scripts

Update `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts"
  }
}
```

## Step 9: Run and Test

```bash
npm run dev
```

```bash
curl http://localhost:3000/users
# []
```

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice"}'
# {"id":1,"name":"Alice"}
```

## Troubleshooting

### "Cannot find module 'reflect-metadata'"

Import it at the **very top** of your entry file:

```typescript
import "reflect-metadata"; // Must be first!
```

### Decorators not working

Check `tsconfig.json` has:

```json
{
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true
}
```

### Port already in use

Use a different port:

```typescript
server.listen(3001);
```

### ESM Projects

If using ESM (`"type": "module"` in package.json), use `tsx` instead of `ts-node`:

```bash
npm install -D tsx
```

```json
{
  "scripts": {
    "dev": "tsx src/index.ts"
  }
}
```
