import { GrpcClient } from './client';
import { GrpcServer } from './server';
import { GrpcClientOptions, GrpcServerOptions } from './types/grpc';

export interface GrpcModuleConfig {
  server?: GrpcServerOptions;
  clients?: Array<{ name: string; options: GrpcClientOptions }>;
}

export class GrpcModule {
  private static instance: GrpcModule;
  private server: GrpcServer | null = null;
  private readonly clients: Map<string, GrpcClient> = new Map();

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

  getServer(): GrpcServer | null {
    return this.server;
  }

  getClient(name: string): GrpcClient | null {
    return this.clients.get(name) || null;
  }

  async start(): Promise<void> {
    if (this.server) {
      await this.server.start();
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      await this.server.stop();
    }
  }
}
