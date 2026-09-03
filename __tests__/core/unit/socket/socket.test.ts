import { describe, expect, it, vi } from 'vitest';
import { Socket } from '../../../../src/core/src/utils/socket/socket';
import { WebSocketService } from '../../../../src/core/src/utils/socket/service';

describe('Socket facade', () => {
  it('registerWebSocketControllers warns when wss is not initialized', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const socket = new (class extends Socket {
      constructor() {
        super();
        // wss is not set (undefined)
      }
    })();
    const result = socket.registerWebSocketControllers([]);
    expect(consoleSpy).toHaveBeenCalled();
    expect(result).toBe(socket);
    consoleSpy.mockRestore();
  });

  it('sendToClient delegates to WebSocketService', () => {
    const socket = new Socket();
    const spy = vi.spyOn(WebSocketService.getInstance(), 'sendToClient').mockReturnValue(true);
    const result = socket.sendToClient('c1', { msg: 'hi' });
    expect(spy).toHaveBeenCalledWith('c1', { msg: 'hi' });
    expect(result).toBe(true);
    spy.mockRestore();
  });

  it('publishToTopic delegates to WebSocketService', () => {
    const socket = new Socket();
    const spy = vi.spyOn(WebSocketService.getInstance(), 'publishToTopic').mockImplementation(() => {});
    socket.publishToTopic('news', { headline: 'test' });
    expect(spy).toHaveBeenCalledWith('news', { headline: 'test' });
    spy.mockRestore();
  });

  it('broadcast delegates to WebSocketService', () => {
    const socket = new Socket();
    const spy = vi.spyOn(WebSocketService.getInstance(), 'broadcast').mockImplementation(() => {});
    socket.broadcast({ event: 'test' }, 'exclude-id');
    expect(spy).toHaveBeenCalledWith({ event: 'test' }, 'exclude-id');
    spy.mockRestore();
  });

  it('getWebSocketStats delegates to WebSocketService', () => {
    const socket = new Socket();
    const spy = vi.spyOn(WebSocketService.getInstance(), 'getStats').mockReturnValue({ clients: 0, topics: [] });
    const result = socket.getWebSocketStats();
    expect(spy).toHaveBeenCalled();
    expect(result).toEqual({ clients: 0, topics: [] });
    spy.mockRestore();
  });

  it('isWebSocketAvailable delegates to WebSocketService', () => {
    const socket = new Socket();
    const spy = vi.spyOn(WebSocketService.getInstance(), 'isAvailable').mockReturnValue(false);
    const result = socket.isWebSocketAvailable();
    expect(spy).toHaveBeenCalled();
    expect(result).toBe(false);
    spy.mockRestore();
  });
});
