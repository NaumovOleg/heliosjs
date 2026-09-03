import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WebSocketService } from '@heliosjs/core/utils';

describe('WebSocketService', () => {
  let service: WebSocketService;

  beforeEach(() => {
    service = WebSocketService.getInstance();
  });

  it('returns singleton instance', () => {
    const a = WebSocketService.getInstance();
    const b = WebSocketService.getInstance();
    expect(a).toBe(b);
  });

  it('is not available before initialization', () => {
    const fresh = new (WebSocketService as any)();
    expect(fresh.isAvailable()).toBe(false);
  });

  it('getStats returns empty when not initialized', () => {
    const fresh = new (WebSocketService as any)();
    expect(fresh.getStats()).toEqual({ clients: 0, topics: [] });
  });

  it('sendToClient returns false when not initialized', () => {
    const fresh = new (WebSocketService as any)();
    expect(fresh.sendToClient('c1', {})).toBe(false);
  });

  it('publishToTopic does not throw when not initialized', () => {
    const fresh = new (WebSocketService as any)();
    expect(() => fresh.publishToTopic('t', {})).not.toThrow();
  });

  it('broadcast does not throw when not initialized', () => {
    const fresh = new (WebSocketService as any)();
    expect(() => fresh.broadcast({})).not.toThrow();
  });

  it('initialize sets the server and isAvailable becomes true', () => {
    const fresh = new (WebSocketService as any)();
    const mockWss = {
      sendToClient: vi.fn().mockReturnValue(true),
      publishToTopic: vi.fn(),
      broadcast: vi.fn(),
      getStats: vi.fn().mockReturnValue({ clients: 1, topics: [] }),
    };
    fresh.initialize(mockWss);
    expect(fresh.isAvailable()).toBe(true);
  });

  it('delegates sendToClient to wss', () => {
    const fresh = new (WebSocketService as any)();
    const mockWss = { sendToClient: vi.fn().mockReturnValue(true) };
    fresh.initialize(mockWss);
    fresh.sendToClient('c1', { msg: 'hi' });
    expect(mockWss.sendToClient).toHaveBeenCalledWith('c1', { msg: 'hi' });
  });

  it('delegates publishToTopic to wss', () => {
    const fresh = new (WebSocketService as any)();
    const mockWss = { publishToTopic: vi.fn() };
    fresh.initialize(mockWss);
    fresh.publishToTopic('chat', { text: 'hello' }, ['excluded']);
    expect(mockWss.publishToTopic).toHaveBeenCalledWith('chat', { text: 'hello' }, ['excluded']);
  });

  it('delegates broadcast to wss', () => {
    const fresh = new (WebSocketService as any)();
    const mockWss = { broadcast: vi.fn() };
    fresh.initialize(mockWss);
    fresh.broadcast({ alert: true }, 'skip-id');
    expect(mockWss.broadcast).toHaveBeenCalledWith({ alert: true }, 'skip-id');
  });

  it('delegates getStats to wss', () => {
    const fresh = new (WebSocketService as any)();
    const stats = { clients: 5, topics: [{ topic: 'a', subscribers: 3 }] };
    const mockWss = { getStats: vi.fn().mockReturnValue(stats) };
    fresh.initialize(mockWss);
    expect(fresh.getStats()).toEqual(stats);
  });
});
