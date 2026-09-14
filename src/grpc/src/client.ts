import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { getGlobalLogger } from '@heliosjs/core/utils';
import { Observable } from 'rxjs';
import type { ClientGrpc, GrpcClientOptions } from './types/grpc';

/**
 * gRPC client wrapper that exposes service methods as RxJS observables.
 *
 * @example
 * const client = new GrpcClient({
 *   protoPath: './user.proto',
 *   package: 'user.v1',
 *   url: 'localhost:50051',
 * });
 *
 * const service = client.getService<UserServiceClient>('UserService');
 * service.findById({ id: '42' }).subscribe(console.log);
 */
export class GrpcClient implements ClientGrpc {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private protoDefinition: any;
  // Real grpc-js client instances, keyed by service name — needed so close()
  // can shut down every channel, and so a wrapped method always calls the
  // client it was created for rather than whichever service was loaded most
  // recently.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly realClients = new Map<string, any>();
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly serviceClients = new Map<string, any>();

  getService<T extends object>(serviceName: string): T {
    if (this.serviceClients.has(serviceName)) {
      return this.serviceClients.get(serviceName) as T;
    }

    if (!this.options.credentials) {
      getGlobalLogger().warn(
        'No gRPC credentials provided — connecting with createInsecure() (no TLS).'
      );
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

    const client = new serviceDefinition(this.options.url, credentials);
    this.realClients.set(serviceName, client);

    // Wrap methods to return Observables. grpc-js attaches `requestStream`/
    // `responseStream` directly to each generated method function — read
    // those rather than assuming every RPC is unary (callback-shaped).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapped: any = {};
    for (const methodName in client) {
       
      const methodFn = client[methodName];
      if (typeof methodFn !== 'function') continue;
      const responseStream = !!methodFn.responseStream;
      const requestStream = !!methodFn.requestStream;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wrapped[methodName] = (...args: any[]) => {
        if (requestStream) {
          // Client-streaming/bidi RPCs take a stream of outgoing requests,
          // not a single argument list — getService()'s one-call-in,
          // one-Observable-out shape has nowhere to put that. Erroring here
          // beats silently wrapping a call that would just hang forever.
          return new Observable((observer) => {
            observer.error(
              new Error(
                `${methodName}: client-streaming/bidi RPCs are not supported by getService()`
              )
            );
          });
        }

        return new Observable((observer) => {
          if (responseStream) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const call: any = client[methodName](...args);
            const onData = (value: unknown) => observer.next(value);
            const onError = (error: unknown) => observer.error(error);
            const onEnd = () => observer.complete();
            call.on('data', onData);
            call.on('error', onError);
            call.on('end', onEnd);
            return () => {
              call.off('data', onData);
              call.off('error', onError);
              call.off('end', onEnd);
              if (typeof call.cancel === 'function') call.cancel();
            };
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          client[methodName](...args, (error: any, response: any) => {
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
   * Closes every service client channel opened via `getService()`.
   */
  close(): void {
    for (const client of this.realClients.values()) {
      if (client && typeof client.close === 'function') {
        client.close();
      }
    }
    this.realClients.clear();
    this.serviceClients.clear();
  }
}
