// utils/MultipartProcessor.ts
import * as multipart from 'parse-multipart-data';
import { MultipartFile, Request } from '../../types/core';

export class MultipartProcessor {
  static parse(request: Pick<Request, 'headers' | 'isBase64Encoded' | 'body'>): {
    fields: Record<string, any>;
    files: Record<string, MultipartFile | MultipartFile[]>;
  } {
    const { body, headers, isBase64Encoded } = request;

    if (!body) {
      return { fields: {}, files: {} };
    }

    let contentType = headers['content-type'] ?? headers['Content-Type'] ?? '';
    if (Array.isArray(contentType)) {
      contentType = contentType[0];
    }

    if (!contentType.startsWith('multipart/form-data')) {
      throw new Error('Not a multipart request');
    }

    const boundaryMatch = multipart.getBoundary(contentType);
    if (!boundaryMatch) {
      throw new Error('Invalid multipart boundary');
    }

    let bodyBuffer: Buffer;
    if (Buffer.isBuffer(body)) {
      bodyBuffer = body;
    } else if (typeof body === 'string') {
      bodyBuffer = isBase64Encoded ? Buffer.from(body, 'base64') : Buffer.from(body, 'binary');
    } else {
      bodyBuffer = Buffer.from(JSON.stringify(body));
    }

    const parts = multipart.parse(bodyBuffer, boundaryMatch);

    const fields: Record<string, any> = {};
    const files: Record<string, MultipartFile | MultipartFile[]> = {};

    parts.forEach((part: any) => {
      if (part.filename) {
        const fieldName = part.name || 'file';
        const contentType = this.getContentType(part);

        const fileData: MultipartFile = {
          fieldname: fieldName,
          filename: part.filename,
          contentType: contentType ?? part.type,
          data: part.data,
          size: part.data.length,
          encoding: part.encoding,
        };

        if (files[fieldName]) {
          if (Array.isArray(files[fieldName])) {
            (files[fieldName] as MultipartFile[]).push(fileData);
          } else {
            files[fieldName] = [files[fieldName] as MultipartFile, fileData];
          }
        } else {
          files[fieldName] = fileData;
        }
      } else if (part.name) {
        const text = part.data.toString('utf-8').trim();

        try {
          fields[part.name] = JSON.parse(text);
        } catch {
          fields[part.name] = text;
        }
      }
    });

    return { fields, files };
  }

  static isMultipart(request: Request): boolean {
    let contentType = request.headers?.['content-type'] || request.headers?.['Content-Type'] || '';
    contentType = Array.isArray(contentType) ? contentType[0] : contentType;
    return contentType.startsWith('multipart/form-data');
  }

  private static getContentType(part: MultipartFile) {
    const filename = part.filename || '';
    const extension = filename.split('.').pop()?.toLowerCase() ?? '';

    const mimeMap: Record<string, string> = {
      txt: 'text/plain',
      text: 'text/plain',
      log: 'text/plain',
      md: 'text/markdown',
      csv: 'text/csv',

      ts: 'application/typescript',
      tsx: 'application/typescript',
      js: 'application/javascript',
      jsx: 'application/javascript',
      mjs: 'application/javascript',
      cjs: 'application/javascript',
      json: 'application/json',
      xml: 'application/xml',
      yaml: 'application/yaml',
      yml: 'application/yaml',
      toml: 'application/toml',
      php: 'application/x-httpd-php',
      py: 'text/x-python',
      rb: 'text/x-ruby',
      java: 'text/x-java',
      c: 'text/x-c',
      cpp: 'text/x-c++',
      h: 'text/x-c',
      hpp: 'text/x-c++',
      go: 'text/x-go',
      rs: 'text/x-rust',
      swift: 'text/x-swift',
      kt: 'text/x-kotlin',
      kts: 'text/x-kotlin',

      html: 'text/html',
      htm: 'text/html',
      css: 'text/css',
      scss: 'text/x-scss',
      sass: 'text/x-sass',
      less: 'text/x-less',

      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
      tif: 'image/tiff',
      avif: 'image/avif',
      heic: 'image/heic',
      heif: 'image/heif',

      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      odt: 'application/vnd.oasis.opendocument.text',
      ods: 'application/vnd.oasis.opendocument.spreadsheet',
      odp: 'application/vnd.oasis.opendocument.presentation',

      zip: 'application/zip',
      rar: 'application/vnd.rar',
      '7z': 'application/x-7z-compressed',
      tar: 'application/x-tar',
      gz: 'application/gzip',
      bz2: 'application/x-bzip2',

      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      flac: 'audio/flac',
      aac: 'audio/aac',

      mp4: 'video/mp4',
      mpg: 'video/mpeg',
      mpeg: 'video/mpeg',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      wmv: 'video/x-ms-wmv',
      flv: 'video/x-flv',
      webm: 'video/webm',
      mkv: 'video/x-matroska',
      m4v: 'video/x-m4v',

      bin: 'application/octet-stream',
      exe: 'application/vnd.microsoft.portable-executable',
      dll: 'application/vnd.microsoft.portable-executable',
      deb: 'application/vnd.debian.binary-package',
      rpm: 'application/x-rpm',
      iso: 'application/x-iso9660-image',
      sh: 'application/x-sh',
      bat: 'application/x-msdos-program',
      ps1: 'application/x-powershell',
    };

    return mimeMap[extension];
  }
}
