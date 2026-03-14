import { PubSub } from 'graphql-subscriptions';
export type GraphQLType =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | DateConstructor
  | ArrayConstructor
  | Function
  | { new (...args: any[]): any };

export interface ArgOptions {
  name?: string;
  type?: GraphQLType;
  required?: boolean;
  description?: string;
  defaultValue?: any;
}

export interface FieldMetadata {
  propertyKey: string;
  type?: GraphQLType | (() => GraphQLType) | { nullable: true };
}

export interface ArgMetadata {
  index: number;
  name: string;
  type: GraphQLType;
  required: boolean;
  description?: string;
  defaultValue?: any;
}

export interface TypeMetadata {
  name: string;
}

export interface QueryMetadata {
  type?: GraphQLType | (() => GraphQLType);
  method: string;
}

export interface MutationMetadata extends QueryMetadata {}
export type GraphQLField<T = any> = T;
export type GraphQLArgs<T = any> = T;
export type GraphQLReturnType<T = any> = T;

export interface ResolverMetadata {
  type: any;
}

export interface FieldResolverMetadata {
  returns?: any;
  method: string;
}

export interface PubSubConfig {
  channel?: string;
  filter?: (payload: any, variables: any) => boolean;
  resolve?: (payload: any) => any;
}

export interface PubSubMetadata {
  index: number;
  config?: PubSubConfig;
  name: string;
  type: Object;
  required: boolean;
}

export interface SubscriptionMetadata {
  type?: GraphQLType | (() => GraphQLType);
  method: string;
  description?: string;
}

export interface TPubSub extends PubSub {
  config: PubSubConfig;
}
