/**
 * Single extension → MIME table shared by the static-file server and the
 * multipart parser. Keys are lowercase, without the leading dot.
 */
export const MIME_TYPES: Record<string, string> = {
  // text
  txt: 'text/plain',
  text: 'text/plain',
  log: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  scss: 'text/x-scss',
  sass: 'text/x-sass',
  less: 'text/x-less',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  toml: 'application/toml',

  // code
  ts: 'application/typescript',
  tsx: 'application/typescript',
  js: 'application/javascript',
  jsx: 'application/javascript',
  mjs: 'application/javascript',
  cjs: 'application/javascript',
  json: 'application/json',
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

  // images
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

  // fonts
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',

  // documents
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

  // archives
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  bz2: 'application/x-bzip2',

  // audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  aac: 'audio/aac',

  // video
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

  // binaries
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

/** Look up a MIME type by bare extension (with or without leading dot). */
export const mimeFromExtension = (ext: string): string | undefined =>
  MIME_TYPES[ext.replace(/^\./, '').toLowerCase()];

/** Look up a MIME type from a file path or name by its extension. */
export const mimeFromPath = (pathOrName: string): string | undefined => {
  const dot = pathOrName.lastIndexOf('.');
  return dot === -1 ? undefined : mimeFromExtension(pathOrName.slice(dot + 1));
};
