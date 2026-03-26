import { Context } from 'aws-lambda';
import { Request, Response } from '../core';
import { ILambdaAdapter, LambdaEvent } from './lambda';

export interface Hooks {
  beforeRequest?: (req: LambdaEvent, context: Context) => void | Promise<void>;
  beforeRoute?: (req: Request, response: Response) => void | Promise<void>;
  afterResponse?: (req: Request, res: Response) => void | Promise<void>;
}

export type PluginHookKeys = keyof Hooks;

export interface Plugin {
  name: string;
  onInit?(app: ILambdaAdapter, event: LambdaEvent, context: Context): void | Promise<void>;
  hooks?: Hooks;
}
export type PluginKeys = keyof Omit<Plugin, 'name' | 'hooks'>;
