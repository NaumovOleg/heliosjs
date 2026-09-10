import { GrpcClient } from './client';
import { GrpcServer } from './server';
import type { GrpcClientOptions, GrpcServerOptions } from './types/grpc';

/** Configuration for {@link GrpcModule.forRoot}. */
export interface GrpcModuleConfig {
  /** Options for the module's gRPC server. Omit to run clients only. */
  server?: GrpcServerOptions;
  /**
   * Named gRPC clients to create and make injectable via `@InjectGrpcClient(name)`.
   * Why: register once here, inject anywhere.
   */
  clients?: { name: string; options: GrpcClientOptions }[];
}

/**
 * Singleton module that groups gRPC server and named gRPC clients.
 *
 * @example
 * const grpc = GrpcModule.forRoot({
 *   server: { url: '0.0.0.0:50051', protoPath: './app.proto', package: 'app.v1' },
 *   clients: [{ name: 'users', options: { protoPath: './user.proto', package: 'user.v1' } }],
 * });
 *
 * await grpc.start();
 */
export class GrpcModule {
  private static instance: GrpcModule;
  private server: GrpcServer | null = null;
  private readonly clients = new Map<string, GrpcClient>();

  /**
   * Initializes module singleton with server and optional named clients.
   *
   * Subsequent calls return the same instance.
   *
   * @param config - Module configuration.
   * @returns Module singleton.
   */
  static forRoot(config: GrpcModuleConfig): GrpcModule {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new GrpcModule();

    if (config.clients) {
      for (const { name, options } of config.clients) {
        this.instance.clients.set(name, new GrpcClient(options));
      }
    }

    if (config.server) {
      this.instance.server = new GrpcServer(config.server, this.instance.clients);
    }

    return this.instance;
  }

  /**
   * Returns configured gRPC server instance.
   *
   * @returns Server instance or `null` when server config is omitted.
   */
  getServer(): GrpcServer | null {
    return this.server;
  }

  /**
   * Returns a named gRPC client.
   *
   * @param name - Client registration name from `forRoot`.
   * @returns Matching client instance or `null` if not found.
   */
  getClient(name: string): GrpcClient | null {
    return this.clients.get(name) || null;
  }

  /**
   * Starts gRPC server if configured.
   */
  async start(): Promise<void> {
    if (this.server) {
      await this.server.start();
    }
  }

  /**
   * Stops gRPC server if configured.
   */
  async stop(): Promise<void> {
    if (this.server) {
      await this.server.stop();
    }
  }
}
