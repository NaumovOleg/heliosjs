export interface S3HandlerConfig {
  bucket?: string;
  events?: ('s3:ObjectCreated:*' | 's3:ObjectRemoved:*' | string)[];
  prefix?: string;
  suffix?: string;
}

export interface DynamoDBHandlerConfig {
  streamViewType?: 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES' | 'KEYS_ONLY';
  eventName?: 'INSERT' | 'MODIFY' | 'REMOVE';
  tableName?: string;
}

export interface SQSHandlerConfig {
  queueUrl?: string;
  maxRetries?: number;
  batchSize?: number;
}

export interface SNSHandlerConfig {
  topicArn?: string;
  filterPolicy?: Record<string, any>;
}

export type EventType = 's3' | 'dynamodb' | 'sqs' | 'sns';
