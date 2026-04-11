import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Observable } from 'rxjs';
import { ClientGrpc, GrpcClientOptions } from './types/grpc';

export class GrpcClient implements ClientGrpc {
  private client: any;
  private protoDefinition: any;
  private readonly options: GrpcClientOptions;

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
   * Get a service client instance
   * @param serviceName - Name of the service to get
   */
  getService<T extends object>(serviceName: string): T {
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

    this.client = new serviceDefinition(this.options.url!, credentials);

    // Wrap methods to return Observables
    const wrapped: any = {};
    for (const methodName in this.client) {
      wrapped[methodName] = (...args: any[]) => {
        return new Observable(observer => {
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

    return wrapped as T;
  }

  /**
   * Close the client connection
   */
  close(): void {
    if (this.client && this.client.close) {
      this.client.close();
    }
  }
}
