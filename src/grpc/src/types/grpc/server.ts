import { ServerCredentials } from '@grpc/grpc-js';
import { GrpcBaseOptions } from './common';

export interface GrpcServerOptions extends GrpcBaseOptions {
  url?: string; // '0.0.0.0:50051'
  credentials?: ServerCredentials;
}

export interface ProtoGroup {
  definition: any;
  handlers: Map<string, any>; // fullServicePath → handlers
  protoPath: string;
  package: string;
}
