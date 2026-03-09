import { APIGatewayProxyEvent, Context } from 'aws-lambda';

export interface LambdaRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[]>;
  query: Record<string, string | string[]>;
  body: any;
  params: Record<string, string>;
  cookies: Record<string, string>;
  context: Context;
  isBase64Encoded: boolean;
  requestId: string;
  stage: string;
  sourceIp: string;
  userAgent: string;
  url: URL;
  event: APIGatewayProxyEvent;
}

export interface LambdaResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
  multiValueHeaders?: Record<string, string[]>;
  cookies?: string[];
}

export interface LambdaApp {
  beforeStart?: () => void;
}

export interface Lambda {
  beforeStart?: () => Promise<void>;
  handleRequest(request: any): Promise<any>;
}
