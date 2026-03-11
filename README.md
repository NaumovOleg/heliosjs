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
- `quantum-flow/aws` - Main application source code AWS Lambda.
- `quantum-flow/core` - Core framework components like Controller and Endpoint.

---

## Defining Controllers

Use the `@Controller` decorator to define controllers with options such as prefix, sub-controllers, middlewares, and interceptors.

```typescript
import {
  Body,
  Catch,
  Controller,
  Headers,
  InjectWS,
  IWebSocketService,
  Params,
  PUT,
  Query,
  Request,
  Response,
  Status,
  USE,
  CORS
} from 'quantum-flow/core';
import {IsString} from  'class-validator'

class UserDto {
  constructor() {}
  @IsString()
  name: string;
}

@Controller({
  prefix: 'user',
  controllers: [UserMetadata, ...],
  interceptor: (data, req, res) => {
    return { data, intercepted: true };
  },
})
@CORS({ origin: '*' })
@Catch((err) => ({ status: 500, err }))
export class User {
  @Status(201)
  @PUT(':id',[(req, res)=>{} , ...middlewares])
  @CORS({ origin: '*' })
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

  @USE([...middlewares])
  async any(@Response() resp: any) {
    ...
  }
}

@Controller(api, [...middlewares])
@Controller({
  prefix: 'api',
  controllers: [UserController, SocketController],
  middelwares: [...middlewares],
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
- Use `@CORS` to configure cors.

## Request decorators

- Use `@Body` to handle request bodies.
- Use `@Headers` to access request headers.
- Use `@Query` to handle query parameters.
- Use `@Params` to access route parameters.
- Use `@Multipart` for handling multipart/form-data requests.
- Use `@Request` to access the original request object.
- Use `@Response` to access the original object.
- Use `@InjectWS` to access the WebsocketService.

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
class RootController {
  async beforeStart(){
    if(!dbConnection){
      connection = await connect()
    }
  }
}
export const handler = LambdaAdapter.createHandler(RootController);
```

# WebSocket Support

Enable WebSocket in the server configuration and register WebSocket controllers.

```typescript
@Controller('socket')
export class Socket {
  @OnConnection()
  onConnection(event: WebSocketEvent) {
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

# Decorators

### Use

Class decorator to add global middlewares to the server.
Should be used only with @Server decorator

```typescript
@Use(middleware)
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
import { IsEmail } from 'class-validator';
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
