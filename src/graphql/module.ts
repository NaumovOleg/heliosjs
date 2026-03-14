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
import { isClass } from '@utils';
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql';
import { PubSubService } from './pubsubService';

interface FieldResolverData {
  fn: Function;
  returns?: any;
}

export class GraphQLModule {
  private schema: GraphQLSchema;
  private typeCache: Map<any, GraphQLObjectType> = new Map();
  private inputTypeCache: Map<any, GraphQLInputObjectType> = new Map();
  private fieldResolvers: Map<string, Map<string, FieldResolverData>> = new Map();
  private resolverInstances: Map<any, any> = new Map();
  private pubsub = PubSubService.getInstance();

  private typeMap: Record<string, any> = {
    String: GraphQLString,
    Number: GraphQLFloat,
    Boolean: GraphQLBoolean,
    Date: GraphQLString,
    string: GraphQLString,
    number: GraphQLFloat,
    boolean: GraphQLBoolean,
    int: GraphQLInt,
    float: GraphQLFloat,
    id: GraphQLID,
    GraphQLString: GraphQLString,
    GraphQLInt: GraphQLInt,
    GraphQLFloat: GraphQLFloat,
    GraphQLBoolean: GraphQLBoolean,
    GraphQLID: GraphQLID,
  };

  constructor(private classes: any[]) {
    this.schema = this.buildSchema();
  }

  private hasQueryOrMutation(cls: any): boolean {
    const prototype = cls.prototype;
    const methods = Object.getOwnPropertyNames(prototype).filter((m) => m !== 'constructor');
    for (const methodName of methods) {
      if (Reflect.hasMetadata(GRAPHQL_QUERY, prototype, methodName)) {
        return true;
      }
      if (Reflect.hasMetadata(GRAPHQL_MUTATION, prototype, methodName)) {
        return true;
      }
    }
    return false;
  }

  private buildSchema(): GraphQLSchema {
    const queryFields: Record<string, any> = {};
    const mutationFields: Record<string, any> = {};
    const subscriptionFields: Record<string, any> = {};

    let hasQueries = false;
    let hasMutations = false;

    for (const cls of this.classes) {
      const resolverMeta = Reflect.getMetadata(GRAPHQL_RESOLVER, cls);
      if (resolverMeta) {
        console.log(`🔍 Found resolver class: ${cls.name}`);
        this.processResolver(cls, resolverMeta);
      }
    }

    for (const cls of this.classes) {
      if (!cls || typeof cls !== 'function') {
        continue;
      }

      const hasQueryOrMutation = this.hasQueryOrMutation(cls);
      if (!hasQueryOrMutation) {
        continue;
      }

      const instance = new cls();

      const prototype = cls.prototype;
      const methods = Object.getOwnPropertyNames(prototype).filter((m) => m !== 'constructor');

      for (const methodName of methods) {
        const queryMeta = Reflect.getMetadata(GRAPHQL_QUERY, prototype, methodName);
        if (queryMeta) {
          queryFields[methodName] = this.createFieldConfig(
            instance,
            prototype,
            methodName,
            queryMeta,
          );
          hasQueries = true;
        }

        const mutationMeta = Reflect.getMetadata(GRAPHQL_MUTATION, prototype, methodName);
        if (mutationMeta) {
          mutationFields[methodName] = this.createFieldConfig(
            instance,
            prototype,
            methodName,
            mutationMeta,
          );
          hasMutations = true;
        }

        const subMeta = Reflect.getMetadata(GRAPHQL_SUBSCRIPTION, prototype, methodName);
        if (subMeta) {
          subscriptionFields[methodName] = this.createFieldConfig(
            instance,
            prototype,
            methodName,
            subMeta,
            true,
          );
        }
      }
    }

    if (!hasQueries) {
      queryFields['_test'] = {
        type: GraphQLString,
        resolve: () => 'GraphQL is working!',
      };
      hasQueries = true;
    }

    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: queryFields,
      }),
      mutation: hasMutations
        ? new GraphQLObjectType({ name: 'Mutation', fields: mutationFields })
        : undefined,
      subscription:
        Object.keys(subscriptionFields).length > 0
          ? new GraphQLObjectType({ name: 'Subscription', fields: subscriptionFields })
          : undefined,
    });
  }

  private processResolver(cls: any, resolverMeta: any) {
    const targetType = resolverMeta.type;
    if (!targetType) {
      return;
    }

    const typeName = targetType.name;
    const instance = new cls();
    this.resolverInstances.set(cls, instance);

    const prototype = cls.prototype;
    const methods = Object.getOwnPropertyNames(prototype).filter((m) => m !== 'constructor');

    for (const methodName of methods) {
      const fieldResolverMeta = Reflect.getMetadata(GRAPHQL_FIELD_RESOLVER, prototype, methodName);
      if (!fieldResolverMeta) continue;

      if (!this.fieldResolvers.has(typeName)) {
        this.fieldResolvers.set(typeName, new Map());
      }

      this.fieldResolvers.get(typeName)!.set(methodName, {
        fn: instance[methodName].bind(instance),
        returns: fieldResolverMeta.returns,
      });
    }
  }

  private wrapIterator(iterator: any, config: any, args: any) {
    const { filter, resolve } = config;

    return {
      [Symbol.asyncIterator]: () => iterator,
      async next(): Promise<any> {
        const result = await iterator.next();
        if (result.done) return result;
        if (filter && !filter(result.value, args)) {
          return this.next();
        }
        if (resolve) {
          result.value = resolve(result.value);
        }

        return result;
      },
    };
  }

  private createFieldConfig(
    instance: any,
    prototype: any,
    methodName: string,
    meta?: any,
    isSubscription = false,
  ) {
    const argMetas = Reflect.getMetadata(GRAPHQL_ARG, prototype, methodName) || [];
    argMetas.sort((a: any, b: any) => a.index - b.index);

    const pubsubMetas =
      isSubscription && Reflect.getMetadata(GRAPHQL_PUBSUB, prototype, methodName);

    const injectPubSubMetas =
      !isSubscription && Reflect.getMetadata(GRAPHQL_INJECT_PUBSUB, prototype, methodName);

    const allParams = [...argMetas, pubsubMetas, injectPubSubMetas]
      .filter((el) => !!el)
      .sort((a, b) => a.index - b.index);

    const args: Record<string, any> = {};
    for (const arg of argMetas) {
      if (arg.name === 'context' || arg.name === 'root') continue;
      const argType = this.convertToGraphQLType(arg.type);
      args[arg.name] = {
        type: arg.required ? new GraphQLNonNull(argType) : argType,
        description: arg.description,
        defaultValue: arg.defaultValue,
      };
    }

    const returnType = this.convertToGraphQLType(meta.type);

    if (isSubscription) {
      return {
        type: returnType,
        args: args,
        subscribe: async (source: any, args: any, context: any, info: any) => {
          try {
            const methodArgs = [];
            let pubsubConfig = null;

            for (const param of allParams) {
              if (param.name === 'root') {
                methodArgs.push(source);
              } else if (param.name === 'context') {
                methodArgs.push(context);
              } else if (param.name === 'pubsub') {
                pubsubConfig = param.config;
                context.pubsub.config = param.config;
                methodArgs.push(context.pubsub);
              } else {
                methodArgs.push(args[param.name]);
              }
            }

            const iterator = await instance[methodName](...methodArgs);

            if (pubsubConfig?.filter || pubsubConfig?.resolve) {
              return this.wrapIterator(iterator, pubsubConfig, args);
            }

            return iterator;
          } catch (error) {
            console.error(`❌ Error in subscription ${methodName}:`, error);
            throw error;
          }
        },
      };
    }
    return {
      type: returnType,
      args: args,
      resolve: async (source: any, args: any, context: any, info: any) => {
        try {
          const methodArgs = [];

          for (const param of allParams) {
            if (param.name === 'root') {
              methodArgs.push(source);
            } else if (param.name === 'context') {
              methodArgs.push(context);
            } else if (param.name === 'pubsub') {
              methodArgs.push(context.pubsub ?? this.pubsub);
            } else {
              methodArgs.push(args[param.name]);
            }
          }

          return await instance[methodName](...methodArgs);
        } catch (error) {
          console.error(`❌ Error in resolver ${methodName}:`, error);
          throw error;
        }
      },
    };
  }

  private convertToGraphQLType(type: any): any {
    if (!type) return GraphQLString;

    if (Array.isArray(type)) {
      const innerType = this.convertToGraphQLType(type[0]);
      return new GraphQLList(innerType);
    }

    if (typeof type === 'function') {
      if (!isClass(type)) {
        const returnType = type();
        if (returnType) {
          return this.convertToGraphQLType(returnType);
        }
      }

      if (type === String) return GraphQLString;
      if (type === Number) return GraphQLFloat;
      if (type === Boolean) return GraphQLBoolean;
      if (type === Date) return GraphQLString;

      if (Reflect.hasMetadata(GRAPHQL_TYPE, type)) {
        return this.getOrCreateObjectType(type);
      }
      if (Reflect.hasMetadata(GRAPHQL_INPUT_TYPE, type)) {
        return this.getOrCreateInputObjectType(type);
      }
    }

    if (typeof type === 'string' && this.typeMap[type]) {
      return this.typeMap[type];
    }

    return GraphQLString;
  }

  private getOrCreateObjectType(cls: any): GraphQLObjectType {
    if (this.typeCache.has(cls)) {
      return this.typeCache.get(cls)!;
    }

    const typeMeta = Reflect.getMetadata(GRAPHQL_TYPE, cls) || { name: cls.name };
    const fieldsMeta = Reflect.getMetadata(GRAPHQL_FIELD, cls.prototype) || [];

    const fields: Record<string, any> = {};

    for (const field of fieldsMeta) {
      fields[field.propertyKey] = {
        type: this.convertToGraphQLType(field.type),
        resolve: (obj: any) => obj[field.propertyKey],
      };
    }

    const typeName = typeMeta.name;
    if (this.fieldResolvers.has(typeName)) {
      const resolvers = this.fieldResolvers.get(typeName)!;
      for (const [fieldName, resolverData] of resolvers) {
        if (!fields[fieldName]) {
          const returnType = resolverData.returns
            ? this.convertToGraphQLType(resolverData.returns)
            : GraphQLString;

          fields[fieldName] = {
            type: returnType,
            resolve: async (obj: any, args: any, context: any) => {
              try {
                return await resolverData.fn(obj, context);
              } catch (error) {
                console.error(`❌ Error in field resolver ${fieldName}:`, error);
                throw error;
              }
            },
          };
        }
      }
    }

    const objectType = new GraphQLObjectType({
      name: typeMeta.name,
      fields: fields,
    });

    this.typeCache.set(cls, objectType);
    return objectType;
  }

  private getOrCreateInputObjectType(cls: any): GraphQLInputObjectType {
    if (this.inputTypeCache.has(cls)) {
      return this.inputTypeCache.get(cls)!;
    }

    const typeMeta = Reflect.getMetadata(GRAPHQL_INPUT_TYPE, cls) || { name: `${cls.name}Input` };
    const fieldsMeta = Reflect.getMetadata(GRAPHQL_FIELD, cls.prototype) || [];

    const fields: Record<string, any> = {};
    for (const field of fieldsMeta) {
      fields[field.propertyKey] = {
        type: this.convertToGraphQLType(field.type),
      };
    }

    const inputType = new GraphQLInputObjectType({
      name: typeMeta.name,
      fields: fields,
    });

    this.inputTypeCache.set(cls, inputType);
    return inputType;
  }

  public getSchema(): GraphQLSchema {
    return this.schema;
  }
}
