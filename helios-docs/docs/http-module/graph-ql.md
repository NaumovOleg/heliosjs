---
sidebar_position: 10
---

# GraphQL Module in Helios

Helios supports GraphQL integration using `type-graphql` and `graphql-yoga` packages, providing a decorator-based approach to define GraphQL schemas, resolvers, and subscriptions.

## Installation

To use GraphQL in Helios, install the following dependencies:

```bash
yarn add graphql graphql-yoga type-graphql  graphql-scalars
```

Ensure you have `reflect-metadata` imported at the entry point of your application:

```ts
import "reflect-metadata";
```

## Setting Up a GraphQL Server

Helios allows you to create GraphQL resolvers using decorators from `type-graphql`. You can integrate `graphql-yoga`'s PubSub for real-time subscriptions.

## Defining GraphQL Types and Resolvers

Use `@ObjectType()`, `@InputType()`, and `@Field()` decorators to define GraphQL types and inputs.

Example:

```ts
import { IsEmail, MinLength } from "class-validator";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  Subscription,
} from "type-graphql";
import { createPubSub } from "graphql-yoga";

// Define PubSub channels for subscriptions
export type PubSubChannels = {
  NOTIFICATIONS: [{ id: string; userId: string; message: string }];
  USER_UPDATED: [{ user: User }];
};

// Create PubSub instance
export const pubSub = createPubSub<PubSubChannels>();

@ObjectType()
export class User {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;
}

@InputType()
export class CreateUserInput {
  @Field()
  @MinLength(2)
  name: string;

  @Field()
  @IsEmail()
  email: string;
}

@Resolver()
export class UserResolver {
  @Query(() => [User])
  async users(): Promise<User[]> {
    // Return list of users
    return [];
  }

  @Mutation(() => User)
  async createUser(
    @Ctx() ctx: any,
    @Arg("input") input: CreateUserInput,
  ): Promise<User> {
    const user = {
      id: Date.now().toString(),
      ...input,
    };
    // You can publish events here if needed
    // pubSub.publish('USER_UPDATED', { user });
    return user;
  }

  @Subscription(() => User, {
    topics: "USER_UPDATED",
    filter: ({ payload, args }) => true,
  })
  newUser(@Root() user: User): User {
    return user;
  }
}
```

## Usage Example with Decorators

- `@ObjectType()` marks a class as a GraphQL object type.
- `@InputType()` marks a class as an input type for mutations.
- `@Field()` marks a property as a GraphQL field.
- `@Resolver()` marks a class as a GraphQL resolver.
- `@Query()`, `@Mutation()`, and `@Subscription()` define GraphQL operations.
- `@Arg()` extracts arguments from the GraphQL query or mutation.
- `@Ctx()` provides the context object.
- `@Root()` provides the root object for subscriptions.

## PubSub Integration

Helios uses `graphql-yoga`'s `createPubSub` for subscription event handling.

Example:

```ts
import { createPubSub } from "graphql-yoga";

export type PubSubChannels = {
  NOTIFICATIONS: [{ id: string; userId: string; message: string }];
  USER_UPDATED: [{ user: User }];
};

export const pubSub = createPubSub<PubSubChannels>();

// Publishing an event example
// pubSub.publish('USER_UPDATED', { user: updatedUser });
```

## Subscription Support

Subscriptions allow clients to listen to real-time events.

Example subscription resolver:

```ts
@Subscription(() => User, {
  topics: 'USER_UPDATED',
  filter: ({ payload, args }) => true,
})
newUser(@Root() user: User): User {
  return user;
}
```

## Enabling GraphQL in Helios

To enable GraphQL in your Helios application, add the following configuration snippet to your module or application setup:

```ts
@Server({
  graphql: { path: '/graphql', resolvers: [ApiResolver], pubSub },
})
```

This configuration sets the GraphQL endpoint path to `/graphql`, registers the `UserResolver` for handling GraphQL queries, mutations, and subscriptions, and integrates the `pubSub` instance for real-time subscription support.

## Summary

Helios provides a seamless integration with GraphQL using decorators and supports real-time subscriptions with PubSub. Define your schema with classes and decorators, implement resolvers, and use PubSub for event-driven updates.

This approach leverages the power of TypeScript decorators and the flexibility of `graphql-yoga` to build scalable GraphQL APIs in Helios.
