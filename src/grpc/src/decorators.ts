import 'reflect-metadata';

import { GRPC_CLIENT_METADATA, GRPC_METHOD_METADATA, GRPC_SERVICE_METADATA } from './constants';
import { GrpcClientInjection, GrpcMethodMetadata, ServiceOptions } from './types/grpc';

const defineMethod = (meta: GrpcMethodMetadata, target: object) => {
  const existingMethods: GrpcMethodMetadata[] =
    Reflect.getMetadata(GRPC_METHOD_METADATA, target) || [];

  existingMethods.push(meta);

  Reflect.defineMetadata(GRPC_METHOD_METADATA, existingMethods, target);
};

/**
 * Decorator to mark a class as a gRPC service
 * @param serviceName - Name of the service (matches .proto definition)
 */
export function GrpcService(serviceName: string, options?: ServiceOptions): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata(GRPC_SERVICE_METADATA, { options, serviceName }, target);
  };
}

/**
 * Decorator to mark a method as a gRPC handler
 * @param serviceName - Optional service name (auto-detected from class if omitted)
 * @param methodName - Optional method name (auto-detected from method name if omitted)
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
      target.constructor,
    );

    return descriptor;
  };
}

/**
 * Decorator for streaming gRPC methods
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
      target.constructor,
    );

    return descriptor;
  };
}

/**
 * Decorator to inject a gRPC client
 * @param name - Injection token for the client package
 */
export function InjectGrpcClient(name: string) {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const existingInjections: GrpcClientInjection[] =
      Reflect.getMetadata(GRPC_CLIENT_METADATA, target) || [];

    existingInjections.push({ name, index: parameterIndex });
    Reflect.defineMetadata(GRPC_CLIENT_METADATA, existingInjections, target);
  };
}
