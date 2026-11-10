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
  /** Explicitly allow plaintext connections to a non-loopback target. Default `false`. */
  allowInsecure?: boolean;
  /** Maximum inbound gRPC message size in bytes. Defaults to 4 MiB. */
  maxReceiveMessageLength?: number;
  /** Maximum outbound gRPC message size in bytes. Defaults to 4 MiB. */
  maxSendMessageLength?: number;
}
