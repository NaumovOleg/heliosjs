import { APIGatewayProxyEvent, Context } from 'aws-lambda';

export interface LambdaRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[]>;
  query: Record<string, string | string[]>;
  body: any;
  params: Record<string, string>;
  cookies: Record<string, string>;
  raw: APIGatewayProxyEvent;
  context: Context;
  isBase64Encoded: boolean;
  requestId: string;
  stage: string;
  sourceIp: string;
  userAgent: string;
  url: URL;
}

export interface LambdaResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
  multiValueHeaders?: Record<string, string[]>;
  cookies?: string[];
}
