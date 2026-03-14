import {
  Arg,
  Field,
  InjectPubSub,
  InputType,
  Mutation,
  ObjectType,
  PubSub,
  Query,
  Resolver,
  Subscription,
  TPubSub,
} from 'quantum-flow/graphql';

@ObjectType('User')
export class User {
  @Field()
  id: string;
  @Field()
  name: string;
  @Field()
  email: string;
  @Field({ nullable: true })
  bio?: string;
  @Field(() => [String])
  roles: string[];
}

@InputType('CreateUserInput')
export class CreateUserInput {
  @Field()
  name: string;
  @Field()
  email: string;
  @Field({ nullable: true })
  bio?: string;
  @Field(() => [String])
  roles?: string[];
}

@Resolver()
export class UserResolver {
  @Query(() => User)
  async getUser(@Arg('id', String, { required: true }) id: string) {
    return {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      bio: 'Product Manager',
      roles: ['user'],
    };
  }

  @Mutation(() => User)
  async createUser(@Arg('input', CreateUserInput, { required: true }) input: CreateUserInput) {
    return {
      id: 'id',
      name: input.name,
      email: input.email,
      bio: input.bio,
      roles: input.roles || ['user'],
    };
  }
}

@ObjectType()
export class Message {
  @Field()
  id: string;
  @Field()
  content: string;
  @Field()
  userId: string;
  @Field()
  createdAt: Date;
}

@InputType()
export class CreateMessageInput {
  @Field()
  content: string;

  @Field()
  userId: string;
}

@Resolver()
export class MessageResolver {
  @Query(() => [Message])
  async messages(): Promise<Message[]> {
    return [];
  }

  @Mutation(() => Message)
  async createMessage(
    @Arg('input') input: CreateMessageInput,
    @InjectPubSub() pubsub: TPubSub,
  ): Promise<Message> {
    const message: Message = {
      id: Date.now().toString(),
      content: input.content,
      userId: input.userId,
      createdAt: new Date(),
    };

    await pubsub.publish('NEW_MESSAGE', message);
    return message;
  }

  @Subscription(() => Message)
  async newMessage(
    @PubSub({
      filter: (payload, variables) => payload.userId === variables.userId,
    })
    pubsub: TPubSub,
    @Arg('userId') userId: string,
  ) {
    return pubsub.asyncIterator('NEW_MESSAGE');
  }
}
