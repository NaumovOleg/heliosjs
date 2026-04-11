import {
  loadPackageDefinition,
  Server,
  ServerCredentials,
  UntypedServiceImplementation,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { firstValueFrom, Observable } from 'rxjs';
import { GrpcClient } from './client';
import { GRPC_CLIENT_METADATA, GRPC_METHOD_METADATA, GRPC_SERVICE_METADATA } from './constants';
import {
  GrpcMethodMetadata,
  GrpcServerOptions,
  ProtoGroup,
  ServiceMeta,
  ServiceOptions,
} from './types/grpc';
import { normalizeError } from './utils/grpc';

export class GrpcServer {
  private readonly server: Server;
  private readonly options: { url: string } & Partial<GrpcServerOptions>;
  private readonly protoGroups: Map<string, ProtoGroup> = new Map();
  private readonly clients: Map<string, GrpcClient> = new Map();

  constructor(options: Partial<GrpcServerOptions>, clients?: Map<string, GrpcClient>) {
    this.server = new Server();
    this.options = { url: '0.0.0.0:5000', ...options };
    if (clients) {
      this.clients = clients;
    }
  }

  registerService(ServiceClass: new (...args: unknown[]) => unknown): void {
    const serviceMeta: ServiceMeta = Reflect.getMetadata(GRPC_SERVICE_METADATA, ServiceClass);
    const methodsMeta: GrpcMethodMetadata[] =
      Reflect.getMetadata(GRPC_METHOD_METADATA, ServiceClass) || [];

    if (!serviceMeta) {
      throw new Error(`${ServiceClass.name} is not decorated with @GrpcService`);
    }

    const instance = this.createInstanceWithInjections(ServiceClass);
    const serviceName = serviceMeta.serviceName;
    const group = this.getOrLoadProtoGroup(serviceMeta.options);
    const serviceDefinition = this.getServiceDefinitionFromGroup(group, serviceName);

    if (!serviceDefinition) {
      throw new Error(
        `Service "${serviceName}" not found in proto file ${serviceMeta.options.protoPath}`,
      );
    }

    const handlers: UntypedServiceImplementation = {};

    for (const methodMeta of methodsMeta) {
      const methodName = this.normalizeMethodName(methodMeta.methodName!);
      const handler = instance[methodMeta.handler].bind(instance);

      handlers[methodName] = (call: unknown, callback: unknown) => {
        this.executeHandler(handler, methodMeta, call, callback);
      };
    }

    group.handlers.set(serviceName, handlers);
    this.server.addService(serviceDefinition, handlers);
  }

  private createInstanceWithInjections(ServiceClass: new (...args: unknown[]) => unknown): any {
    // Получаем метаданные о клиентах для инжекции
    const clientParams: { index: number; name: string }[] =
      Reflect.getMetadata(GRPC_CLIENT_METADATA, ServiceClass) || [];

    if (clientParams.length === 0) {
      // Нет зависимостей - просто создаём экземпляр
      return new ServiceClass();
    }

    // Создаём массив аргументов для конструктора
    const args: any[] = [];
    const maxIndex = Math.max(...clientParams.map(p => p.index), -1);

    for (let i = 0; i <= maxIndex; i++) {
      const param = clientParams.find(p => p.index === i);
      if (param) {
        const client = this.clients.get(param.name);
        if (!client) {
          throw new Error(
            `Client "${param.name}" not found for injection into ${ServiceClass.name}`,
          );
        }
        args[i] = client;
      } else {
        args[i] = undefined;
      }
    }

    return new ServiceClass(...args);
  }

  private getOrLoadProtoGroup(serviceMeta: ServiceOptions): ProtoGroup {
    const key = `${serviceMeta.protoPath}|${serviceMeta.package}`;
    if (this.protoGroups.has(key)) {
      return this.protoGroups.get(key)!;
    }

    const packageDef = loadSync(serviceMeta.protoPath, {
      keepCase: serviceMeta.loader?.keepCase ?? false,
      longs: serviceMeta.loader?.longs ?? String,
      enums: serviceMeta.loader?.enums ?? String,
      defaults: serviceMeta.loader?.defaults ?? true,
      oneofs: serviceMeta.loader?.oneofs ?? true,
      includeDirs: serviceMeta.loader?.includeDirs,
    });

    const definition = loadPackageDefinition(packageDef);

    const group: ProtoGroup = {
      definition,
      handlers: new Map(),
      protoPath: serviceMeta.protoPath,
      package: serviceMeta.package,
    };
    this.protoGroups.set(key, group);
    return group;
  }

  private getServiceDefinitionFromGroup(group: ProtoGroup, serviceName: string): any {
    let current = group.definition;

    const packageParts = group.package.split('.');
    for (const part of packageParts) {
      if (!current[part]) return null;
      current = current[part];
    }

    if (!current[serviceName]) return null;
    return current[serviceName]?.service ?? null;
  }

  async start(): Promise<void> {
    const [host, port] = this.options.url.split(':');
    const credentials = this.options.credentials || ServerCredentials.createInsecure();

    return new Promise((resolve, reject) => {
      this.server.bindAsync(`${host}:${port}`, credentials, (err, boundPort) => {
        if (err) {
          reject(err);
        } else {
          console.log(`🚀 gRPC server running on ${boundPort}`);
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise(resolve => {
      this.server.tryShutdown(() => resolve());
    });
  }

  private normalizeMethodName(name: string): string {
    return name.charAt(0).toLowerCase() + name.slice(1);
  }

  private async executeHandler(
    handler: Function,
    methodMeta: GrpcMethodMetadata,
    call: any,
    callback: any,
  ) {
    try {
      const request = methodMeta.isStream ? call : call.request;
      const result = handler(request, call.metadata, call);

      if (result instanceof Observable) {
        if (methodMeta.isStream) {
          result.subscribe({
            next: value => call.write(value),
            error: err => call.emit('error', err),
            complete: () => call.end(),
          });
          callback(null, null);
        } else {
          const resolved = await firstValueFrom(result);
          callback(null, resolved);
        }
      } else if (result instanceof Promise) {
        const resolved = await result;
        callback(null, resolved);
      } else {
        callback(null, result);
      }
    } catch (error) {
      const normalized = normalizeError(error);
      callback({
        code: normalized.code,
        message: normalized.message,
      });
    }
  }
}
