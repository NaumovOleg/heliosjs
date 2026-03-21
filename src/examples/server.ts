import { HttpServer } from '@heliosjs/http';
import { App } from './app';

const server = new HttpServer(App);
server.listen().catch(console.error);
