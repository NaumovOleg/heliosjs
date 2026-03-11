import { Root } from './app';

import { LambdaAdapter } from 'quantum-flow/aws';
import { mockContext } from './mock/context';
import req from './mock/lambda_api_gateway_rest.json';

export const handler = LambdaAdapter.createHandler(Root);

const y = async () => {
  const resp = await handler(req, mockContext, () => {});

  console.log(resp);
};

y();
