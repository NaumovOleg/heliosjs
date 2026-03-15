# Project Overview

This project is a decorator-based API framework supporting both HTTP and WebSocket servers. It is designed to simplify the creation of scalable and maintainable APIs with features such as controllers, middlewares, interceptors, error handling, and WebSocket support. Additionally, it supports AWS Lambda integration for serverless deployments.

# Installation

To install dependencies and build the project, run:

```bash
yarn install
# or npm install
```

# Usage

You can use controllers and server functionality by importing controllers and creating server instances as shown in the examples above. Use your preferred testing framework to write unit and integration tests.

# Project Structure

- `quantum-flow/http` - Main application source code for HTTP servers.
- `quantum-flow/aws` - Main application source code for AWS Lambda.
- `quantum-flow/core` - Core framework components like Controller and Endpoint.
- `quantum-flow/middlewares` - Core middlewares to use within the application.
- `quantum-flow/ws` - Websocket decorators.
- `quantum-flow/sse` - Server side events decorators.
- `quantum-flow/plugins/aws` - Exports plugins types for lambda.
- `quantum-flow/plugins/http` - Exports plugins types for http server.

---

## Defining Controllers

Use the `@Controller` decorator to define controllers with options such as prefix, sub-controllers, middlewares, and interceptors.

```typescript
import {
  Body,
  Controller,
  Headers,
  IWebSocketService,
  Params,
  PUT,
  Query,
  Request,
  Response,
  Status,
  ANY,
} from 'quantum-flow/core';
import {IsString} from  'class-validator'
import { Catch, Cors, Sanitize, Use, SANITIZER } from 'quantum-flow/middlewares';
import { InjectWS } from 'quantum-flow/ws';
// SANITIZER - prefilled Joi shema for  common data
class UserDto {
  constructor() {}
  @IsString()
  name: string;
}

@Controller({
  prefix: 'user',
  controllers: [UserMetadata, ...],
  interceptor: (data, req, res) => data,
})
@Cors({ origin: '*' })
@Catch((err) => ({ status: 500, err }))
@Use(()=>{})
@Sanitize({
  schema: Joi.object({name: Joi.string().trim().min(2).max(50).required()}),
  action: 'both',
  options: { abortEarly: false },
  stripUnknown: true,
  type: 'body',
})
export class User {
  @Status(201)
  @PUT(':id',[(req, res)=>{} , ...middlewares])
  @Cors({ origin: '*' })
  async createUser(
    @Body(UserDto) body: UserDto,
    @Query() query: any,
    @Headers() headers: any,
    @Params(ParamDTO, 'param') params: any,
    @Request() req: any,
    @Response() resp: any,
    @InjectWS() ws: IWebSocketService,
  ) {
  }

  @ANY([...middlewares])
  async any(@Response() resp: any) {...}
}

@Controller(api, [...middlewares])
@Controller({
  prefix: 'api',
  controllers: [UserController, SocketController],
  middlewares: [...middlewares],
  interceptor: (data, req, res) => data,
})
@Catch((error) => ({ status: 400, error }))
class RootController {}
```

## Creating a http Server

Use the `@Server` decorator with configuration options like port, host, controllers, and WebSocket enablement.

```typescript
import { Server, Port, Host, Use, Catch, HttpServer } from 'quantum-flow/http';

@Server({ controllers: [RootController], cors: { origin: '*' } })
@Port(3000)
@Host('localhost')
@Use((data) => data)
@Catch((error) => ({ status: 400, error }))
class App {}

const server = new HttpServer(App);

server.listen().catch(console.error);
```

## Middlewares, Interceptors, and Error Handlers

- Use `@Use` to apply middlewares.
- Use `@Catch` to handle errors.
- Use `@Port` and `@Host` to configure server port and host.
- Use `@Cors` to configure cors.
- Use `@Sanitize` to apply sanitization to reqest.

## Request decorators

- Use `@Body` to handle request bodies.
- Use `@Headers` to access request headers.
- Use `@Query` to handle query parameters.
- Use `@Params` to access route parameters.
- Use `@Multipart` for handling multipart/form-data requests.
- Use `@Request` to access the original request object.
- Use `@Response` to access the original object.
- Use `@InjectWS` to access the websocket service.
- Use `@InjectSSE()` to access the server-side-event service.

# AWS Lambda Support

Use `LambdaAdapter` to convert API Gateway events to requests and responses. Create Lambda handlers from controllers.

```typescript
Example Lambda handler creation
import { LambdaAdapter } from 'quantum-flow/aws';

let dbConnection = null;

@Controller({
  prefix: 'api',
  controllers: [UserController, SocketController],
})
class RootController {}
const lambdaAdapter = new LambdaAdapter(Root);
export const handler = lambdaAdapter.handler;
```

# WebSocket Support

Enable WebSocket in the server configuration and register WebSocket controllers.

## Enabling WebSocket Support in Server

To enable WS support, configure your HTTP server with the `enabled: true` option and register controllers that use SSE.

Example server setup:

```typescript
@Server( {websocketPath:'/ws',    websocket: { enabled: true } })
```

## Injecting WebSocket events in Controller

```typescript
import { OnConnection, Subscribe, OnMessage } from 'quantum-flow/ws';
@Controller('socket')
export class Socket {
  @OnConnection()
  onConnection(event: WebSocketEvent) {
    // Send greeting ONLY to this client
    event.client.socket.send(JSON.stringify({ type: 'welcome', data: { message: 'Welcome!' } }));
  }

  /**
   * 2. @Subscribe - AUTOMATIC broadcast to all subscribers
   * No need to use WebSocketService!
   */
  @Subscribe('chat')
  onChatMessage(event: WebSocketEvent) {
    // This method is called for EACH subscriber
    // The message is ALREADY automatically broadcast to all!

    const msg = event.message?.data;
    // You can add logic, but no need to broadcast
    if (msg?.text.includes('bad')) {
      // If return empty, the message will not be sent
      return;
    }

    // That's it, the message will be sent to subscribers automatically!
  }

  /**
   * 4. @OnMessage for commands (without WebSocketService)
   */
  @OnMessage('ping')
  onPing(event: WebSocketEvent) {
    // Send response only to this client
    event.client.socket.send(
      JSON.stringify({
        type: 'pong',
        data: { time: Date.now() },
      }),
    );
  }

  /**
   * 5. @OnMessage for subscription
   */
  @OnMessage('subscribe')
  onSubscribe(event: WebSocketEvent) {
    const topic = event.message?.data.topic;

    // Server will save the subscription automatically, no need to do anything!
    // Just confirm
    event.client.socket.send(
      JSON.stringify({
        type: 'subscribed',
        topic,
        data: { success: true },
      }),
    );
  }
}
```

# Server-Sent Events (SSE) Support

The framework supports Server-Sent Events (SSE) to enable real-time, one-way communication from the server to clients over HTTP.

## Defining SSE Controllers

Use the `@Controller` decorator to define controllers with a `prefix` and optionally include sub-controllers. This allows modular organization of your API endpoints.

Example:

```typescript
@Controller({
  prefix: 'user',
  controllers: [UserMetadata],
  middlewares: [function UserGlobalUse() {}],
  interceptor: (data, req, res) => {
    return { data, intercepted: true };
  },
})
export class User {}
```

## Injecting SSE Service

Use the `@InjectSSE` decorator in your controller methods to create and manage SSE connections. This service allows sending events to connected clients.

Example method using SSE:

```typescript
import { InjectSSE } from 'quantum-flow/sse';

@Controller('user')
export class UserMetadata {
  @GET('/subscribesse')
  async subscribesse(@InjectSSE() sse) {
    const client = sse.createConnection(res);
    sse.sendToClient(client.id, {
      event: 'welcome message',
      data: { message: 'Connected to notifications' },
    });
  }
}
```

## SSE Event Decorators

The framework provides decorators to handle SSE connection lifecycle events:

- `@OnSSEConnection()`: Decorate a method to handle new SSE connections.
- `@OnSSEError()`: Decorate a method to handle SSE errors.
- `@OnSSEClose()`: Decorate a method to handle SSE connection closures.

Example usage:

```typescript
import { OnSSEConnection, OnSSEError, OnSSEClose } from 'quantum-flow/sse';

@Controller('user')
export class User {
  @OnSSEConnection()
  async onsseconnection(@Request() req: any, @Response() res: any) {
    console.log('SSE connection established');
    return req.body;
  }

  @OnSSEError()
  async onsseerror(@Request() req: any, @Response() res: any) {
    console.log('SSE error occurred');
    return req.body;
  }

  @OnSSEClose()
  async onsseclose(@Request() req: any, @Response() res: any) {
    console.log('SSE connection closed');
    return req.body;
  }
}
```

## Sending SSE Events

Use the injected SSE service to send events to clients. You can send events to all clients or specific clients by ID.

Example:

```typescript
sse.sendToClient(clientId, { event: 'eventName', data: { key: 'value' } });
```

## Enabling SSE Support in Server

To enable SSE support, configure your HTTP server with the `sse: true` option and register controllers that use SSE.

Example server setup:

```typescript
import { Server, HttpServer } from 'quantum-flow/http';
import { User, UserMetadata } from './controllers';

@Server({
  controllers: [User, UserMetadata],
  sse: { enabled: true },
})
class App {}

const server = new HttpServer(App);
server.listen().catch(console.error);
```

## Enabling static files

To enable serving static files, use statics option.

Example server setup:

```typescript
import { Server, HttpServer } from 'quantum-flow/http';
import { User, UserMetadata } from './controllers';

@Server({
  statics: [
    {
      path: path.join(__dirname, './public'),
      options: {
        index: 'index.html',
        extensions: ['html', 'htm', 'css', 'js'],
        maxAge: 86400,
        immutable: true,
        dotfiles: 'deny',
        fallthrough: false,
        setHeaders: (res, filePath, stats) => {
          if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
          }
        },
      },
    },
  ],
})
class App {}

const server = new HttpServer(App);
server.listen().catch(console.error);
```

## Custom plugins.

Use plugins to extend app with custom logic.

Example server setup:

```typescript
import { Server, HttpServer } from 'quantum-flow/http';
import { User, UserMetadata } from './controllers';
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

@Controller({ prefix: 'metrics' })
export class MetricsController {...}
@Server({...})
class App {}

const server = new HttpServer(App);
server.usePligun(metricsPlugin)
server.listen().catch(console.error);

// Lambda setup
let connection;
const dbConnectionPlugin: Plugin = {
  name: 'metric',
   beforeRequest: async(server) => {
    if(!connection){
      connection = await connetct(...)
    }
  },
  hooks: {...},
};

const lambdaAdapter = new LambdaAdapter(Root);
lambdaAdapter.usePlugin(dbConnectionPlugin);

export const handler = lambdaAdapter.handler;
```

## GraphQL

Quantum Flow provides seamless GraphQL integration using the popular **TypeGraphQL** library. You can build fully typed GraphQL APIs with decorators, while the framework handles the server setup, subscriptions, and PubSub.

### Installation

```bash
npm install type-graphql graphql graphql-yoga @graphql-yoga/subscriptions
# or
yarn add type-graphql graphql graphql-yoga @graphql-yoga/subscriptions
```

```typescript
@Server({
  controllers: [/* your REST controllers */],
  websocketPath:'/ws',  //GraphQL subscriptions uses same ws server as  main application
  graphql: {                   // GraphQL endpoint (default: '/graphql')
    playground: true,                  // Enable GraphQL Playground
    resolvers: [UserResolver, MessageResolver], // Your resolver classes
    pubSub: pubSub,                    // Your PubSub instance (required for subscriptions)
  },
})
```

## Usage example

```typescript
import { IsEmail, MinLength } from 'class-validator';
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  Subscription,
} from 'type-graphql';

import { createPubSub } from 'graphql-yoga';

export type PubSubChannels = {
  NOTIFICATIONS: [{ id: string; userId: string; message: string }];
  USER_UPDATED: [{ user: User }];
};

export const pubSub = createPubSub<PubSubChannels>();

@ObjectType()
export class User {
  @Field()
  id: string;
  @Field()
  name: string;
  @Field()
  email: string;
}

@InputType()
export class CreateUserInput {
  @Field()
  @MinLength(2)
  name: string;
  @Field()
  @IsEmail()
  email: string;
}

@Resolver()
export class UserResolver {
  @Query(() => [User])
  async users(): Promise<User[]> {
    // pubSub.publish('USER_UPDATED', {...});
    return [];
  }

  @Mutation(() => User)
  async createUser(@Ctx() ctx: any, @Arg('input') input: CreateUserInput): Promise<User> {
    const user = {
      id: Date.now().toString(),
      ...input,
    };

    return user;
  }

  @Subscription(() => User, {
    topics: 'USER_UPDATED',
    filter: ({ payload, args }) => true,
  })
  newUser(@Root() user: User): User {
    return user;
  }
}
```
