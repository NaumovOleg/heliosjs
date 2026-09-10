import type { ChannelCredentials } from '@grpc/grpc-js';

import type { GrpcBaseOptions } from './common';

/** Options for constructing a {@link GrpcClient}. */
export interface GrpcClientOptions extends GrpcBaseOptions {
  /** `host:port` of the target server. Default `'localhost:5000'`. */
  url?: string;
  /**
   * Channel credentials. Default: `credentials.createInsecure()` (plaintext).
   * Provide a TLS credential for production. Why: gRPC is unencrypted unless you
   * say otherwise.
   */
  credentials?: ChannelCredentials;
}
