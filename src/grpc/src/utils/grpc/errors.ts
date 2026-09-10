/**
 * Error carrying a numeric gRPC status code. When thrown from a handler the
 * server sends the client a response with this `code` and `message` (see
 * `@grpc/grpc-js` `status` for the code values, e.g. `3` INVALID_ARGUMENT,
 * `5` NOT_FOUND, `7` PERMISSION_DENIED, `13` INTERNAL, `16` UNAUTHENTICATED).
 */
export class GrpcError extends Error {
  /**
   * @param code - Numeric gRPC status code sent to the client.
   * @param message - Human-readable status message.
   * @param metadata - Optional trailing metadata attached to the response.
   */
  constructor(
    public code: number,
    message: string,
    public metadata?: Record<string, any>,
  ) {
    super(message);
    this.name = 'GrpcError';
  }
}

/**
 * A `.proto` file could not be loaded or parsed. Fixed code `13` (INTERNAL).
 *
 * @param protoPath - Path of the proto file that failed to load.
 */
export class GrpcInvalidProtoError extends GrpcError {
  constructor(protoPath: string) {
    super(13, `Invalid proto definition: ${protoPath}`);
    this.name = 'GrpcInvalidProtoError';
  }
}

/**
 * A service name was requested that is not defined in the loaded proto package.
 * Fixed code `5` (NOT_FOUND).
 *
 * @param serviceName - The service name that could not be resolved.
 */
export class GrpcServiceNotFoundError extends GrpcError {
  constructor(serviceName: string) {
    super(5, `Service "${serviceName}" not found`);
    this.name = 'GrpcServiceNotFoundError';
  }
}
