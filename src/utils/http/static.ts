import fs from 'fs';
import { ServerResponse } from 'http';
import path from 'path';
import { Request, Response } from '../../types/core';
import { StaticOptions } from '../../types/http';

export function staticMiddleware(root: string, options: StaticOptions = {}) {
  const opts = {
    index: 'index.html',
    extensions: ['html', 'htm'],
    maxAge: 0,
    immutable: false,
    dotfiles: 'ignore',
    fallthrough: true,
    acceptRanges: true,
    ...options,
  };

  const rootPath = path.resolve(root);

  return async (req: Request, res: Response, next: (...args: unknown[]) => unknown) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    const url = req.url?.split('?')[0] || '';
    const safePath = decodeURIComponent(url).replace(/\\/g, '/');
    const fullPath = path.join(rootPath, safePath);
    const normalizedPath = path.normalize(fullPath);

    if (!normalizedPath.startsWith(rootPath)) {
      res.status = 403;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Forbidden');
      return;
    }

    let filePath = normalizedPath;

    try {
      let stats = await fs.promises.stat(filePath).catch(() => null);

      if (stats?.isDirectory() && opts.index) {
        const indexFile = typeof opts.index === 'string' ? opts.index : 'index.html';
        const indexPath = path.join(filePath, indexFile);
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
        res.status = 403;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Forbidden');
        return;
      }

      const mimeType = getMimeType(filePath) || 'application/octet-stream';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stats.size.toString());
      res.setHeader('Last-Modified', stats.mtime.toUTCString());

      if (opts.acceptRanges) {
        res.setHeader('Accept-Ranges', 'bytes');
      }

      if (opts.immutable) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (opts.maxAge > 0) {
        res.setHeader('Cache-Control', `public, max-age=${opts.maxAge}`);
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }

      if (opts.setHeaders) {
        opts.setHeaders(res, filePath, stats);
      }

      if (req.method === 'HEAD') {
        res.status = 200;
        res.end(undefined);
        return;
      }

      let rangeHeader = req.headers.range;
      rangeHeader = Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader;

      if (rangeHeader && opts.acceptRanges) {
        const range = parseRange(rangeHeader, stats.size);

        if (range) {
          const { start, end } = range;

          res.status = 206; // Partial Content
          res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
          res.setHeader('Content-Length', (end - start + 1).toString());

          await new Promise<void>((resolve, reject) => {
            const stream = fs.createReadStream(filePath, { start, end });

            stream.on('error', (err) => {
              console.error('Stream error:', err);
              if (!res.headersSent) {
                res.status = 500;
                res.end('Internal Server Error');
              }
              reject(err);
            });

            stream.on('end', () => resolve());
            stream.pipe(res.raw as ServerResponse);
          });

          return;
        }
      }

      await new Promise<void>((resolve, reject) => {
        const stream = fs.createReadStream(filePath);

        stream.on('error', (err) => {
          console.error('Stream error:', err);
          if (!res.headersSent) {
            res.status = 500;
            res.end('Internal Server Error');
          }
          reject(err);
        });

        stream.on('end', () => resolve());

        if (res.raw) {
          stream.pipe(res.raw as ServerResponse);
        } else {
          stream.pipe(res as any);
        }
      });
    } catch (err) {
      console.error('Static middleware error:', err);

      if (opts.fallthrough) {
        next();
      } else {
        if (!res.headersSent) {
          res.status = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Internal Server Error');
        }
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

function parseRange(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  const matches = rangeHeader.match(/bytes=(\d+)-(\d*)/);

  if (!matches) return null;

  const start = parseInt(matches[1], 10);
  let end = matches[2] ? parseInt(matches[2], 10) : fileSize - 1;

  if (isNaN(start)) return null;
  if (isNaN(end)) end = fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) return null;

  return { start, end };
}
