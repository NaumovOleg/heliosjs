import { PubSub } from 'graphql-subscriptions';

export class PubSubService {
  private static instance: PubSub;
  static isInitialized = false;

  static getInstance(): PubSub {
    if (!PubSubService.instance) {
      PubSubService.instance = new PubSub();
      PubSubService.isInitialized = true;
    }
    return PubSubService.instance;
  }
}
