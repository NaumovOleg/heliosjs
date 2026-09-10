import type { ServerCredentials } from '@grpc/grpc-js';
import type { LoggerConfig } from '@heliosjs/core/types';
import type { GrpcBaseOptions } from './common';

export interface GrpcServerOptions extends GrpcBaseOptions {
  url?: string; // '0.0.0.0:50051'
  credentials?: ServerCredentials;
  log?: LoggerConfig | false;
}

export interface ProtoGroup {
  definition: any;
  handlers: Map<string, any>; // fullServicePath → handlers
  protoPath: string;
  package: string;
}
