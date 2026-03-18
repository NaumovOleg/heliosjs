import { NormalizedEvent } from '@types';

export const getEventType = (event: any): 'rest' | 'http' | 'url' => {
  if (event.httpMethod && event.resource) {
    return 'rest';
  }
  if (event.version === '2.0' || event.requestContext?.http) {
    return 'http';
  }
  if (event.version && event.rawPath && !event.requestContext?.http) {
    return 'url';
  }
  return 'rest';
};

export const getSourceIp = (event: NormalizedEvent): string => {
  const forwardedFor = event.headers['x-forwarded-for'];
  if (forwardedFor) {
    if (Array.isArray(forwardedFor)) {
      return forwardedFor[0].split(',')[0].trim();
    }
    return forwardedFor.split(',')[0].trim();
  }

  if (event.requestContext?.identity?.sourceIp) {
    return event.requestContext.identity.sourceIp;
  }

  if (event.requestContext?.http?.sourceIp) {
    return event.requestContext.http.sourceIp;
  }

  return '0.0.0.0';
};
