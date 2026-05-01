import { ChannelCredentials } from '@grpc/grpc-js';

import { GrpcBaseOptions } from './common';

export interface GrpcClientOptions extends GrpcBaseOptions {
  url?: string; // 'localhost:50051'
  credentials?: ChannelCredentials;
}
