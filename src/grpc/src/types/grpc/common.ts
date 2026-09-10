import { type Options } from '@grpc/proto-loader';
import type { Observable } from 'rxjs';

/**
 * Subset of `@grpc/proto-loader` options Helios forwards when loading a `.proto`.
 * All optional; defaults shown are what Helios applies when the key is omitted.
 */
export interface GrpcLoaderOptions {
  /** Keep field names as written in the proto instead of camelCasing. Default `false`. */
  keepCase?: boolean;
  /** Constructor to represent 64-bit ints (`String`, `Number`). Default `String`. */
  longs?: Function;
  /** Constructor to represent enums (`String` for names, `Number` for values). Default `String`. */
  enums?: Function;
  /** Populate default values for missing fields. Default `true`. */
  defaults?: boolean;
  /** Expose `oneof` virtual fields. Default `true`. */
  oneofs?: boolean;
  /** Extra directories to resolve `import` statements from. */
  includeDirs?: string[];
}

/** Common "where is the contract" options shared by client and server config. */
export interface GrpcBaseOptions {
  /** Proto `package` the service lives in, e.g. `'user.v1'`. */
  package: string;
  /** Filesystem path to the `.proto` file. */
  protoPath: string;
  /** Proto-loader tuning; see {@link GrpcLoaderOptions}. */
  loader?: GrpcLoaderOptions;
  /** Pre-loaded package definition to use instead of reading `protoPath`. */
  packageDefinition?: any;
}

/** Internal: one entry per `@GrpcMethod` / `@GrpcStreamMethod`, read at registration. */
export interface GrpcMethodMetadata {
  /** Owning service name; falls back to the class's `@GrpcService` name. */
  serviceName?: string;
  /** RPC name to bind to; falls back to the handler method name. */
  methodName?: string;
  /** `true` for `@GrpcStreamMethod`. */
  isStream?: boolean;
  /** Name of the class method that implements the RPC. */
  handler: string;
  /** Reserved: client-streaming RPC. */
  isClientStream?: boolean;
  /** Reserved: server-streaming RPC. */
  isServerStream?: boolean;
}

/** Internal: resolved service description used by the server. */
export interface GrpcServiceMetadata {
  serviceName: string;
  protoPath: string;
  package: string;
  methods: Map<string, GrpcMethodMetadata>;
}

/** Minimal client contract implemented by {@link GrpcClient}. */
export interface ClientGrpc {
  /**
   * Returns a proxy for the named proto service whose methods return
   * `Observable`s.
   * @param name - Service name as declared in the proto.
   */
  getService<T extends object>(name: string): T;
  /** Closes all open channels. */
  close(): void;
}

/**
 * Shape of a service proxy returned by `getService()`: every RPC becomes a
 * `(data, metadata?) => Observable | Promise` function.
 */
export type GrpcServiceClient = Record<string, (data: any, metadata?: any) => Observable<any> | Promise<any>>;

/** Proto-location options for `@GrpcService` (see also {@link GrpcBaseOptions}). */
export interface ServiceOptions {
  /** Filesystem path to the `.proto` file. */
  protoPath: string;
  /** Proto `package` the service is nested under. */
  package: string;
  /** Raw `@grpc/proto-loader` options. */
  loader?: Options;
}

/** Internal: `@GrpcService` metadata (name + loader options). */
export interface ServiceMeta {
  serviceName: string;
  options: ServiceOptions;
}

/** Internal: one `@InjectGrpcClient` on a service constructor. */
export interface GrpcClientInjection {
  /** Registered client name to resolve. */
  name: string;
  /** Constructor parameter index to inject at. */
  index: number;
}
