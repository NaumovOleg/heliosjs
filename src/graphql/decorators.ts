import {
  GRAPHQL_ARG,
  GRAPHQL_FIELD,
  GRAPHQL_FIELD_RESOLVER,
  GRAPHQL_INJECT_PUBSUB,
  GRAPHQL_INPUT_TYPE,
  GRAPHQL_MUTATION,
  GRAPHQL_PUBSUB,
  GRAPHQL_QUERY,
  GRAPHQL_RESOLVER,
  GRAPHQL_SUBSCRIPTION,
  GRAPHQL_TYPE,
} from '@constants';
import {
  ArgMetadata,
  ArgOptions,
  FieldMetadata,
  FieldResolverMetadata,
  GraphQLType,
  MutationMetadata,
  PubSubConfig,
  PubSubMetadata,
  QueryMetadata,
  ResolverMetadata,
  SubscriptionMetadata,
  TypeMetadata,
} from '@types';
import 'reflect-metadata';

export function ObjectType(name?: string): ClassDecorator {
  return function (target: any) {
    Reflect.defineMetadata(GRAPHQL_TYPE, { name: name || target.name } as TypeMetadata, target);
  };
}

export function InputType(name?: string): ClassDecorator {
  return function (target: any) {
    Reflect.defineMetadata(
      GRAPHQL_INPUT_TYPE,
      { name: name || target.name } as TypeMetadata,
      target,
    );
  };
}

export function Field(
  type?: GraphQLType | (() => GraphQLType) | { nullable: true },
): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const fields: FieldMetadata[] = Reflect.getMetadata(GRAPHQL_FIELD, target) || [];
    fields.push({ propertyKey: propertyKey as string, type });
    Reflect.defineMetadata(GRAPHQL_FIELD, fields, target);
  };
}

export function Arg(name?: string, type?: GraphQLType, options?: ArgOptions): ParameterDecorator {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    if (propertyKey === undefined) {
      throw new Error('❌ @Arg decorator must be used on a method parameter');
    }

    const args: ArgMetadata[] = Reflect.getMetadata(GRAPHQL_ARG, target, propertyKey) || [];
    args.push({
      index: parameterIndex,
      name: name || `arg${parameterIndex}`,
      type: type || String,
      required: options?.required || false,
      description: options?.description,
      defaultValue: options?.defaultValue,
    });

    Reflect.defineMetadata(GRAPHQL_ARG, args, target, propertyKey);
  };
}

export function Root(): ParameterDecorator {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    if (propertyKey === undefined) {
      throw new Error('❌ @Root decorator must be used on a method parameter');
    }

    const args: ArgMetadata[] = Reflect.getMetadata(GRAPHQL_ARG, target, propertyKey) || [];
    args.push({
      index: parameterIndex,
      name: 'root',
      type: Object,
      required: true,
    });

    Reflect.defineMetadata(GRAPHQL_ARG, args, target, propertyKey);
  };
}

export function Context(): ParameterDecorator {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    if (propertyKey === undefined) {
      throw new Error('❌ @Context decorator must be used on a method parameter');
    }

    const args: ArgMetadata[] = Reflect.getMetadata(GRAPHQL_ARG, target, propertyKey) || [];
    args.push({
      index: parameterIndex,
      name: 'context',
      type: Object,
      required: true,
    });

    Reflect.defineMetadata(GRAPHQL_ARG, args, target, propertyKey);
  };
}

export function Query(returnType?: GraphQLType | (() => GraphQLType)): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(
      GRAPHQL_QUERY,
      { type: returnType, method: propertyKey as string } as QueryMetadata,
      target,
      propertyKey,
    );
  };
}

export function Mutation(returnType?: GraphQLType | (() => GraphQLType)): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(
      GRAPHQL_MUTATION,
      { type: returnType, method: propertyKey as string } as MutationMetadata,
      target,
      propertyKey,
    );
  };
}

export function FieldResolver(returns?: any): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(
      GRAPHQL_FIELD_RESOLVER,
      { returns, method: propertyKey as string } as FieldResolverMetadata,
      target,
      propertyKey,
    );
  };
}
export function Resolver(type?: any): ClassDecorator {
  return function (target: any) {
    Reflect.defineMetadata(GRAPHQL_RESOLVER, { type } as ResolverMetadata, target);
  };
}

export function PubSub(config?: PubSubConfig | string): ParameterDecorator {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    if (propertyKey === undefined) {
      throw new Error('❌ @PubSub decorator must be used on a method parameter');
    }

    let normalizedConfig: PubSubConfig = {};

    if (typeof config === 'string') {
      normalizedConfig = { channel: config };
    } else if (config) {
      normalizedConfig = config;
    }

    const metadata: PubSubMetadata = {
      index: parameterIndex,
      config: normalizedConfig,
      name: 'pubsub',
      type: Object,
      required: true,
    };

    Reflect.defineMetadata(GRAPHQL_PUBSUB, metadata, target, propertyKey);
  };
}

export function InjectPubSub(): ParameterDecorator {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    if (propertyKey === undefined) {
      throw new Error('❌ @InjectPubSub decorator must be used on a method parameter');
    }

    const metadata: PubSubMetadata = {
      index: parameterIndex,
      name: 'pubsub',
      type: Object,
      required: true,
    };

    Reflect.defineMetadata(GRAPHQL_INJECT_PUBSUB, metadata, target, propertyKey);
  };
}

export function Subscription(returnType?: GraphQLType | (() => GraphQLType)): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(
      GRAPHQL_SUBSCRIPTION,
      { type: returnType, method: propertyKey as string } as SubscriptionMetadata,
      target,
      propertyKey,
    );
  };
}
