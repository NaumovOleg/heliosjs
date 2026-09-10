# gRPC Module API Reference

This document provides an overview of the API exports from the gRPC module, including classes, decorators, types, and utility functions.

## Module Exports

### Classes

#### GrpcModule

The main module class to configure and manage gRPC server and clients.

- `forRoot(config: GrpcModuleConfig): GrpcModule` - Initializes the module with server and client configurations.
- `getServer(): GrpcServer | null` - Returns the gRPC server instance if configured.
- `getClient(name: string): GrpcClient | null` - Returns a gRPC client instance by name.
- `start(): Promise<void>` - Starts the gRPC server.
- `stop(): Promise<void>` - Stops the gRPC server.

#### GrpcServer

Represents the gRPC server that handles incoming requests.

#### GrpcClient

Represents a gRPC client used to connect and send requests to a gRPC server.

### Decorators

- `@GrpcService` - Decorates a class as a gRPC service.
- `@GrpcMethod` - Decorates a method as a gRPC method.
- `@GrpcStreamMethod` - Decorates a method as a gRPC streaming method.
- `@InjectGrpcClient` - Injects a gRPC client instance by name.

### Types

- `ClientGrpc` - Interface representing a gRPC client.
- `GrpcClientOptions` - Options for configuring a gRPC client.
- `GrpcMethodMetadata` - Metadata for gRPC methods.
- `GrpcServerOptions` - Options for configuring the gRPC server.
- `GrpcServiceClient` - Interface for gRPC service clients.
- `GrpcServiceMetadata` - Metadata for gRPC services.

### Utility Functions and Errors

- `GrpcError` - Base class for gRPC errors.
- `GrpcInvalidProtoError` - Error for invalid proto files.
- `GrpcServiceNotFoundError` - Error when a gRPC service is not found.
- `normalizeError` - Utility to normalize errors.
- `toPromise` - Converts observable to promise.

## Usage Notes

Import the gRPC module and decorators from the package to define services, methods, and clients.

```typescript
import {
  GrpcModule,
  GrpcService,
  GrpcMethod,
  InjectGrpcClient,
  GrpcClient,
} from '@heliosjs/grpc';
```

Configure the module using `GrpcModule.forRoot` with server and client options.

Refer to the [Usage Documentation](./usage.md) and [Examples](./examples.md) for detailed guides and code samples.

---

This API reference is intended for developers integrating the gRPC module into their applications.