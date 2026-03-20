import { Context } from 'aws-lambda';
import { IncomingMessage } from 'http';
import { IRequest, IResponse } from '../core';
import { ILambdaAdapter, LambdaEvent } from './lambda';

export interface Hooks {
  beforeRequest?: (req: IncomingMessage) => void | Promise<void>;
  beforeRoute?: (req: IRequest, response: IResponse) => void | Promise<void>;
  afterResponse?: (req: IRequest, res: IResponse) => void | Promise<void>;
}

export type PluginHookKeys = keyof Hooks;

export interface Plugin {
  name: string;
  onInit?(app: ILambdaAdapter, event: LambdaEvent, context: Context): void | Promise<void>;
  hooks?: Hooks;
}
export type PluginKeys = keyof Omit<Plugin, 'name' | 'hooks'>;
