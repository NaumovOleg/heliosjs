import fs from 'fs';
import { Response } from '../core';

export interface StaticOptions {
  index?: string | boolean;
  extensions?: string[];
  maxAge?: number;
  immutable?: boolean;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  fallthrough?: boolean;
  setHeaders?: (res: Response, path: string, stat: fs.Stats) => void;
}

export interface StaticConfig {
  path: string;
  options?: StaticOptions;
}

export interface StaticOptions {
  index?: string | boolean;
  extensions?: string[];
  maxAge?: number;
  immutable?: boolean;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  fallthrough?: boolean;
  setHeaders?: (res: Response, path: string, stat: fs.Stats) => void;
}
