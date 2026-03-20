import fs from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import { StaticOptions } from '../../types/http';

export function staticMiddleware(root: string, options: StaticOptions = {}) {
  const opts = {
    index: 'index.html',
    extensions: ['html', 'htm'],
    maxAge: 0,
    immutable: false,
    dotfiles: 'ignore',
    fallthrough: true,
    ...options,
  };

  const rootPath = path.resolve(root);

  return async (req: IncomingMessage, res: ServerResponse, next: Function) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    const url = req.url?.split('?')[0] || '';
    const safePath = decodeURIComponent(url).replace(/\\/g, '/');
    const fullPath = path.join(rootPath, safePath);
    const normalizedPath = path.normalize(fullPath);

    if (!normalizedPath.startsWith(rootPath)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Forbidden');
      return;
    }

    let filePath = normalizedPath;

    try {
      let stats = await fs.promises.stat(filePath).catch(() => null);

      if (stats?.isDirectory() && opts.index) {
        const indexPath = path.join(
          filePath,
          typeof opts.index === 'string' ? opts.index : 'index.html',
        );

        const indexStats = await fs.promises.stat(indexPath).catch(() => null);
        if (indexStats?.isFile()) {
          filePath = indexPath;
          stats = indexStats;
        } else {
          return next();
        }
      }

      if (!stats && opts.extensions) {
        for (const ext of opts.extensions) {
          const extPath = filePath + '.' + ext;

          const extStats = await fs.promises.stat(extPath).catch(() => null);
          if (extStats?.isFile()) {
            filePath = extPath;
            stats = extStats;

            break;
          }
        }
      }

      if (!stats || !stats.isFile()) {
        return next();
      }

      const filename = path.basename(filePath);
      if (filename.startsWith('.') && opts.dotfiles === 'deny') {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Forbidden');
        return;
      }

      const mimeType = getMimeType(filePath) || 'application/octet-stream';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      res.setHeader('Accept-Ranges', 'bytes');

      if (opts.maxAge) {
        res.setHeader('Cache-Control', `public, max-age=${opts.maxAge}`);
      }
      if (opts.immutable) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }

      if (opts.setHeaders) {
        opts.setHeaders(res, filePath, stats);
      }

      if (req.method === 'HEAD') {
        res.statusCode = 200;
        res.end();
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const stream = fs.createReadStream(filePath);

        const mimeType = getMimeType(filePath);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Last-Modified', stats.mtime.toUTCString());

        if (opts.maxAge) {
          res.setHeader('Cache-Control', `public, max-age=${opts.maxAge}`);
        }

        stream.on('error', (err) => {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end('Internal Server Error');
          }
          reject(err);
        });

        stream.on('end', () => resolve());
        stream.pipe(res);
      });
    } catch (err) {
      console.error('❌ Static middleware error:', err);

      if (opts.fallthrough) {
        next();
      } else {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Internal Server Error');
      }
    }
  };
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimes: Record<string, string> = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain',
    '.pdf': 'application/pdf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.gz': 'application/gzip',
  };
  return mimes[ext] || 'application/octet-stream';
}
