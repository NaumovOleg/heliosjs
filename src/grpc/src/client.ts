import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Observable } from 'rxjs';
import type { ClientGrpc, GrpcClientOptions } from './types/grpc';

/**
 * gRPC client wrapper that exposes service methods as RxJS observables.
 *
 * @example
 * ```ts
 * const client = new GrpcClient({
 *   protoPath: './user.proto',
 *   package: 'user.v1',
 *   url: 'localhost:50051',
 * });
 *
 * const service = client.getService<UserServiceClient>('UserService');
 * service.findById({ id: '42' }).subscribe(console.log);
 * ```
 */
export class GrpcClient implements ClientGrpc {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private protoDefinition: any;
  private readonly options: GrpcClientOptions;

  /**
   * Creates a gRPC client and loads proto definitions immediately.
   *
   * @param options - gRPC client connection and proto loading options.
   */
  constructor(options: GrpcClientOptions) {
    this.options = {
      url: 'localhost:5000',
      ...options,
    };
    this.loadProto();
  }

  private loadProto(): void {
    const { protoPath, loader, packageDefinition } = this.options;

    let definition = packageDefinition;
    if (!definition && protoPath) {
      definition = protoLoader.loadSync(protoPath, {
        keepCase: loader?.keepCase ?? false,
        longs: loader?.longs ?? String,
        enums: loader?.enums ?? String,
        defaults: loader?.defaults ?? true,
        oneofs: loader?.oneofs ?? true,
        includeDirs: loader?.includeDirs,
      });
    }

    if (!definition) {
      throw new Error('Either protoPath or packageDefinition must be provided');
    }

    this.protoDefinition = grpc.loadPackageDefinition(definition);
  }

  /**
   * Returns a typed service client from loaded proto package.
   *
   * Each service method is wrapped to return an `Observable`.
   *
   * @param serviceName - Service name as defined in proto.
   * @returns Service proxy object with observable-returning methods.
   */
  private readonly serviceClients = new Map<string, any>();

  getService<T extends object>(serviceName: string): T {
    if (this.serviceClients.has(serviceName)) {
      return this.serviceClients.get(serviceName) as T;
    }

    const credentials = this.options.credentials || grpc.credentials.createInsecure();

    let current = this.protoDefinition;
    const packageParts = this.options.package.split('.');

    for (const part of packageParts) {
      if (!current[part]) {
        throw new Error(`Package "${this.options.package}" not found`);
      }
      current = current[part];
    }

    const serviceDefinition = current[serviceName];
    if (!serviceDefinition) {
      throw new Error(`Service "${serviceName}" not found`);
    }

    this.client = new serviceDefinition(this.options.url, credentials);

    // Wrap methods to return Observables
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapped: any = {};
    for (const methodName in this.client) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wrapped[methodName] = (...args: any[]) => {
        return new Observable((observer) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.client[methodName](...args, (error: any, response: any) => {
            if (error) {
              observer.error(error);
            } else {
              observer.next(response);
              observer.complete();
            }
          });
        });
      };
    }

    this.serviceClients.set(serviceName, wrapped);
    return wrapped as T;
  }

  /**
   * Closes the active service client channel.
   */
  close(): void {
    for (const client of this.serviceClients.values()) {
      if (client && typeof client.close === 'function') {
        client.close();
      }
    }
    this.serviceClients.clear();
  }
}
