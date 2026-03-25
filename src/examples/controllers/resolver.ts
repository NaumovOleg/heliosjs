import { IsEmail, MinLength } from 'class-validator';
import {
  Arg,
  Ctx,
  Field,
  ID,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  Subscription,
} from 'type-graphql';

import { createPubSub } from 'graphql-yoga';

export type PubSubChannels = {
  NOTIFICATIONS: [{ id: string; userId: string; message: string }];
  USER_UPDATED: [{ user: User }];
};

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
  async users(
    @Ctx() ctx: any,
    @Arg('id', () => ID, { nullable: true }) id?: string,
  ): Promise<User[]> {
    // pubSub.publish('USER_UPDATED', {...});
    return [];
  }

  @Mutation(() => User)
  async createUser(@Ctx() ctx: any, @Arg('input') input: CreateUserInput): Promise<User> {
    const user = {
      id: Date.now().toString(),
      ...input,
    };

    return user;
  }

  @Subscription(() => User, {
    topics: 'USER_UPDATED',
    filter: ({ payload, args }) => true,
  })
  newUser(@Root() user: User): User {
    return user;
  }
}
