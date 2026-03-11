import { Root } from './app';

import { LambdaAdapter } from 'quantum-flow/aws';

export const handler = LambdaAdapter.createHandler(Root);
