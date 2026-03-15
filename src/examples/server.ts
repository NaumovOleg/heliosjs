import { HttpServer } from 'quantum-flow/http';
import { App } from './app';

const server = new HttpServer(App);
server.listen().catch(console.error);
