import type { ServerCredentials } from '@grpc/grpc-js';
import type { LoggerConfig } from '@heliosjs/core/types';
import type { GrpcBaseOptions } from './common';

/** Options for constructing a {@link GrpcServer}. */
export interface GrpcServerOptions extends GrpcBaseOptions {
  /** `host:port` to bind. Default `'0.0.0.0:5000'`. */
  url?: string;
  /**
   * Server credentials. Default: `ServerCredentials.createInsecure()`. Provide a
   * TLS credential for production.
   */
  credentials?: ServerCredentials;
  /** Logger config, or `false` to silence the server's own logging. */
  log?: LoggerConfig | false;
}

/** Internal: proto definitions + bound handlers grouped by `protoPath|package`. */
export interface ProtoGroup {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  definition: any;
  /** fullServicePath → handlers */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handlers: Map<string, any>;
  protoPath: string;
  package: string;
}
