import { IncomingMessage, Server } from 'http';
import { IRequest, IResponse, MiddlewareCB } from '../core';
import { IHttpServer } from './http';

export interface HttpPluginHooks {
  beforeRequest?: (req: IncomingMessage) => void | Promise<void>;
  beforeRoute?: (req: IRequest, response: IResponse) => void | Promise<void>;
  afterResponse?: (req: IRequest, res: IResponse) => void | Promise<void>;
}

export interface Plugin {
  name: string;

  onInit?(server: IHttpServer): void | Promise<void>;
  onStart?(server: Server): void | Promise<void>;
  onStop?(server: Server): void | Promise<void>;
  middleware?: MiddlewareCB;

  hooks?: HttpPluginHooks;
}

export type PluginHookKeys = keyof HttpPluginHooks;
export type PluginKeys = keyof Omit<Plugin, 'name' | 'hooks'>;
