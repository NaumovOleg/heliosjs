import type fs from 'node:fs';
import type { Response } from '@heliosjs/core/types';

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
