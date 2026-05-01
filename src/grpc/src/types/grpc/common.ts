import { type Options } from '@grpc/proto-loader';
import { Observable } from 'rxjs';
export interface GrpcLoaderOptions {
  keepCase?: boolean;
  longs?: Function;
  enums?: Function;
  defaults?: boolean;
  oneofs?: boolean;
  includeDirs?: string[];
}

export interface GrpcBaseOptions {
  package: string;
  protoPath: string;
  loader?: GrpcLoaderOptions;
  packageDefinition?: any;
}

export interface GrpcMethodMetadata {
  serviceName?: string;
  methodName?: string;
  isStream?: boolean;
  handler: string;
  isClientStream?: boolean;
  isServerStream?: boolean;
}

export interface GrpcServiceMetadata {
  serviceName: string;
  protoPath: string;
  package: string;
  methods: Map<string, GrpcMethodMetadata>;
}

export interface ClientGrpc {
  getService<T extends object>(name: string): T;
  close(): void;
}

/**
 * Service client proxy interface
 */
export interface GrpcServiceClient {
  [method: string]: (data: any, metadata?: any) => Observable<any> | Promise<any>;
}

export type ServiceOptions = {
  protoPath: string;
  package: string;
  loader?: Options;
};

export type ServiceMeta = {
  serviceName: string;
  options: ServiceOptions;
};

export interface GrpcClientInjection {
  name: string;
  index: number;
}
