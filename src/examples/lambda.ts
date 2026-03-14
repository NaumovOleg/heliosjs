import { LambdaAdapter } from 'quantum-flow/aws';
import { ANY, Controller, GET, Response } from 'quantum-flow/core';
import { Plugin } from 'quantum-flow/plugins/aws';
import { Root } from './app';

import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

@Controller({ prefix: 'metric' })
export class MetricsController2 {
  @GET('/')
  async any(@Response() resp: any) {
    return 'metric';
  }
}

@Controller({ prefix: 'metric', controllers: [MetricsController2] })
export class MetricsController {
  @ANY()
  async any(@Response() resp: any) {
    return register.metrics();
  }
}

export const metricsPlugin: Plugin = {
  name: 'metric',
  onInit: (server) => {
    server.controllers.push(MetricsController);
  },
  hooks: {
    beforeRoute: (req, res) => {
      httpRequestsTotal.labels(req.method, req.requestUrl.pathname, res.statusCode + '').inc();
    },
  },
};

const lambdaAdapter = new LambdaAdapter(Root);
lambdaAdapter.usePlugin(metricsPlugin);

export const handler = lambdaAdapter.handler;
