export class GrpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public metadata?: Record<string, any>,
  ) {
    super(message);
    this.name = 'GrpcError';
  }
}

export class GrpcInvalidProtoError extends GrpcError {
  constructor(protoPath: string) {
    super(3, `Invalid proto definition: ${protoPath}`);
    this.name = 'GrpcInvalidProtoError';
  }
}

export class GrpcServiceNotFoundError extends GrpcError {
  constructor(serviceName: string) {
    super(5, `Service "${serviceName}" not found`);
    this.name = 'GrpcServiceNotFoundError';
  }
}
