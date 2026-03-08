# Project Overview

This project is a decorator-based API framework supporting both HTTP and WebSocket servers. It is designed to simplify the creation of scalable and maintainable APIs with features such as controllers, middlewares, interceptors, error handling, and WebSocket support. Additionally, it supports AWS Lambda integration for serverless deployments.

# Installation

To install dependencies and build the project, run:

```bash
yarn install
# or npm install

yarn build
# or npm run build
```

# Usage

## Defining Controllers

Use the `@Controller` decorator to define controllers with options such as prefix, sub-controllers, middlewares, and interceptors.

```typescript
import { Controller } from 'quantum-flow/core';

@Controller({
  prefix: 'api',
  controllers: [UserController, SocketController],
  interceptors: [(resp) => resp],
})
class RootController {}
```

## Creating a Server

Use the `@Server` decorator with configuration options like port, host, controllers, and WebSocket enablement.

```typescript
import { Server, Port, Host, Use, Intercept, Catch, HttpServer } from 'quantum-flow/http';

@Server({
  controllers: [RootController],
})
@Port(3000)
@Host('localhost')
@Use((res: any) => res)
@Intercept((data, req, res) => data)
@Catch((error) => error)
class App {}

const server = new HttpServer(App);

server.listen().catch(console.error);
```

## Middlewares, Interceptors, and Error Handlers

- Use `@Use` to apply middlewares.
- Use `@Intercept` to apply interceptors.
- Use `@Catch` to handle errors.
- Use `@Port` and `@Host` to configure server port and host.

## Request decorators

- Use `@Body` to handle request bodies.
- Use `@Headers` to access request headers.
- Use `@Query` to handle query parameters.
- Use `@Params` to access route parameters.
- Use `@Host` to configure the server host.
- Use `@Port` to configure the server port.
- Use `@Multipart` for handling multipart/form-data requests.
- Use `@Request` to access the entire request object.
- Use `@Response` to access the response object.

# AWS Lambda Support

Use `LambdaAdapter` to convert API Gateway events to requests and responses. Create Lambda handlers from controllers.

```typescript
Example Lambda handler creation
import { LambdaAdapter } from 'quantum-flow/aws';
export const handler = LambdaAdapter.createHandler(RootController);
```

# WebSocket Support

Enable WebSocket in the server configuration and register WebSocket controllers.

```typescript
@Controller('socket')
export class Socket {
  @OnConnection()
  onConnection(event: WebSocketEvent) {
    console.log(`✅ Connected: ${event.client.id}`);

    // Send greeting ONLY to this client
    event.client.socket.send(
      JSON.stringify({
        type: 'welcome',
        data: { message: 'Welcome!' },
      }),
    );
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
    console.log(`💬 Message in chat: ${msg?.text}`);

    // You can add logic, but no need to broadcast
    if (msg?.text.includes('bad')) {
      // If return empty, the message will not be sent
      return;
    }

    // That's it, the message will be sent to subscribers automatically!
  }

  /**
   * 3. @Subscribe for another room
   */
  @Subscribe('news')
  onNewsMessage(event: WebSocketEvent) {
    console.log(`📰 News: ${event.message?.data.title}`);
    // Automatic broadcast to all subscribed to 'news'
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
    console.log(`📌 Client ${event.client.id} subscribed to ${topic}`);

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
@Server({
  controllers: [Socket],
  websocket: { enabled: true },
})
@Use(middleware)
class App {}
```

# Usage

You can use controllers and server functionality by importing controllers and creating server instances as shown in the examples above. Use your preferred testing framework to write unit and integration tests.

# Project Structure

- `quantum-flow/http` - Main application source code for HTTP servers.
- `quantum-flow/aws` - Main application source code AWS Lambda.
- `quantum-flow/core` - Core framework components like Controller and Endpoint.

---

# Decorators

### Server

Class decorator to configure the server with options like controllers, global middlewares, and interceptors.

```typescript
@Server({ controllers: [RootController] })
class App {}
```

### Use

Class decorator to add global middlewares to the server.

```typescript
@Use(middleware)
class App {}
```

### Intercept

Class decorator to add global interceptors to the server.

```typescript
@Intercept(interceptor)
class App {}
```

### Catch

Class decorator to set a global error handler for the server.

```typescript
@Catch((error) => {
  return { message: 'Internal Server Error' };
})
class App {}
```

### Port

Class decorator to set the server port.

```typescript
@Port(3000)
class App {}
```

### Host

Class decorator to set the server host.

```typescript
@Host('localhost')
class App {}
```

### Validate

Method or class decorator to validate request parameters (query, body, params, headers) against a DTO class using class-validator.

```typescript
class UserDTO {
  @IsEmail()
  email: string;

  @Length(6, 20)
  password: string;
}

class UserController {
  @POST('/')
  async createUser(@Body(UserDTO) user: UserDTO, @Query() query) {
    // Your logic here
  }
}
```
