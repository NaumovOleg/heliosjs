import { Context } from 'aws-lambda';
import { IncomingMessage, Server, ServerResponse } from 'http';
import { AppRequest, MiddlewareCB } from './common';
import { IHttpServer } from './http';
import { ILambdaAdapter, LambdaEvent, LambdaRequest, LambdaResponse } from './lambda';

export interface HttpPluginHooks {
  beforeRequest?: (req: IncomingMessage) => void | Promise<void>;
  beforeRoute?: (req: AppRequest, response: ServerResponse) => void | Promise<void>;
  afterResponse?: (req: AppRequest, res: ServerResponse) => void | Promise<void>;
}

export interface HttpPlugin {
  name: string;

  onInit?(server: IHttpServer): void | Promise<void>;
  onStart?(server: Server): void | Promise<void>;
  onStop?(server: Server): void | Promise<void>;
  middleware?: MiddlewareCB;

  hooks?: HttpPluginHooks;
}

export type PluginHookKeys = keyof HttpPluginHooks;
export type PluginKeys = keyof Omit<HttpPlugin, 'name' | 'hooks'>;

export interface LambdaPluginHooks {
  beforeRequest?: (event: LambdaEvent, context: Context) => void | Promise<void>;
  beforeRoute?: (req: LambdaRequest) => void | Promise<void>;
  afterResponse?: (req: LambdaRequest, res: LambdaResponse) => void | Promise<void>;
}

export interface LambdaPlugin {
  name: string;
  onInit?(app: ILambdaAdapter, event: LambdaEvent, context: Context): void | Promise<void>;
  hooks?: HttpPluginHooks;
}
