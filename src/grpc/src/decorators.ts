import { GRPC_CLIENT_METADATA, GRPC_METHOD_METADATA, GRPC_SERVICE_METADATA } from './constants';
import type { GrpcClientInjection, GrpcMethodMetadata, ServiceOptions } from './types/grpc';

const defineMethod = (meta: GrpcMethodMetadata, target: object) => {
  const existingMethods: GrpcMethodMetadata[] =
    Reflect.getMetadata(GRPC_METHOD_METADATA, target) || [];

  existingMethods.push(meta);

  Reflect.defineMetadata(GRPC_METHOD_METADATA, existingMethods, target);
};

/**
 * Marks a class as a gRPC service implementation. `GrpcServer.registerService()`
 * reads this metadata to load the proto and bind the class's `@GrpcMethod` /
 * `@GrpcStreamMethod` handlers to the matching RPCs.
 *
 * @param serviceName - Service name **exactly as declared in the `.proto`**
 *   (e.g. `service UserService {...}` → `'UserService'`). Why: this is how the
 *   loaded proto definition is looked up; a mismatch throws at registration.
 * @param options - `ServiceOptions` telling the loader where the contract lives:
 *   - `protoPath` (**required**) — filesystem path to the `.proto` file.
 *   - `package` (**required**) — the proto `package` the service is nested under
 *     (e.g. `'user.v1'`).
 *   - `loader` — `@grpc/proto-loader` options (`keepCase`, `longs`, `enums`,
 *     `defaults`, `oneofs`, `includeDirs`). Why: match the code-gen conventions
 *     your protos expect.
 *
 * @example
 * @GrpcService('UserService', { protoPath: './user.proto', package: 'user.v1' })
 * class UserServiceImpl {
 *   @GrpcMethod()
 *   findById(req: { id: string }) { return this.repo.get(req.id); }
 * }
 */
export function GrpcService(serviceName: string, options?: ServiceOptions): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata(GRPC_SERVICE_METADATA, { options, serviceName }, target);
  };
}

/**
 * Marks a method as the handler for a **unary** RPC. The handler receives
 * `(request, metadata, call)` and may return a value, a `Promise`, or an RxJS
 * `Observable` (its first emission is sent). A thrown error is mapped to a gRPC
 * status via `normalizeError`.
 *
 * @param serviceName - Override the owning service name. Default: the enclosing
 *   `@GrpcService` name. Why: only needed when one class implements RPCs from
 *   more than one service.
 * @param methodName - Override the RPC name to bind to. Default: the decorated
 *   method's name (matched case-insensitively on the first letter). Why: when the
 *   TS method name differs from the proto RPC name.
 *
 * @example
 * @GrpcMethod()
 * getUser(req: GetUserRequest) { return this.users.find(req.id); }
 *
 * @GrpcMethod('UserService', 'DeleteUser')
 * remove(req: { id: string }) { return this.users.delete(req.id); }
 */
export function GrpcMethod(serviceName?: string, methodName?: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    defineMethod(
      {
        serviceName,
        methodName: methodName || String(propertyKey),
        handler: propertyKey as string,
        isStream: false,
      },
      target.constructor
    );

    return descriptor;
  };
}

/**
 * Marks a method as the handler for a **streaming** RPC. Unlike `@GrpcMethod` the
 * handler is passed the raw gRPC `call` object as its request argument (so it can
 * read the client stream and/or `call.write()` to the server stream); returning
 * an `Observable` pipes each emission to `call.write()` and completes with
 * `call.end()`, errors go through `normalizeError` to `call.destroy()`.
 *
 * @param serviceName - Override the owning service name (default: enclosing
 *   `@GrpcService`).
 * @param methodName - Override the RPC name (default: the method name).
 *
 * @example
 * @GrpcStreamMethod()
 * watchPrices(call: ServerWritableStream<Req, Tick>) {
 *   return this.ticks$; // Observable<Tick>
 * }
 */
export function GrpcStreamMethod(serviceName?: string, methodName?: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    defineMethod(
      {
        serviceName,
        methodName: methodName || String(propertyKey),
        handler: propertyKey as string,
        isStream: true,
      },
      target.constructor
    );

    return descriptor;
  };
}

/**
 * Constructor-parameter decorator that injects a named {@link GrpcClient} into a
 * `@GrpcService` class. `GrpcServer` resolves the client from the map it was
 * constructed with (populated by `GrpcModule.forRoot({ clients })`) and passes it
 * at the decorated position when it instantiates the service.
 *
 * @param name - The client's registration name, matching an entry's `name` in
 *   `GrpcModule.forRoot({ clients: [{ name, options }] })`. Why: lets one service
 *   call other services without constructing clients itself; an unknown name
 *   throws at registration.
 *
 * @example
 * @GrpcService('OrderService', { protoPath: './order.proto', package: 'order.v1' })
 * class OrderServiceImpl {
 *   constructor(@InjectGrpcClient('users') private users: GrpcClient) {}
 * }
 */
export function InjectGrpcClient(name: string) {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const existingInjections: GrpcClientInjection[] =
      Reflect.getMetadata(GRPC_CLIENT_METADATA, target) || [];

    existingInjections.push({ name, index: parameterIndex });
    Reflect.defineMetadata(GRPC_CLIENT_METADATA, existingInjections, target);
  };
}
