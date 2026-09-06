// Test cho battleSocket — kiem tra factory createBattleSocket cau hinh dung.
import { createBattleSocket } from '../battleSocket';

// Mock socket.io-client de kiem tra cau hinh ma khong can server that
jest.mock('socket.io-client', () => {
  const mockSocket = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
  };
  const io = jest.fn().mockReturnValue(mockSocket);
  return { io };
});

jest.mock('../../config/env', () => ({ API_BASE_URL: 'http://localhost:4000' }));

describe('createBattleSocket()', () => {
  // Happy path — tao socket voi cau hinh dung
  it('goi io() voi url va namespace /battle dung', () => {
    const { io } = require('socket.io-client') as { io: jest.Mock };
    createBattleSocket('session-token-123');
    expect(io).toHaveBeenCalledWith(
      'http://localhost:4000/battle',
      expect.objectContaining({
        auth: { token: 'session-token-123' },
        autoConnect: false,
      }),
    );
  });

  // Happy path — token duoc truyen dung vao auth handshake
  it('dinh kem session token vao auth handshake', () => {
    const { io } = require('socket.io-client') as { io: jest.Mock };
    io.mockClear();
    createBattleSocket('my-jwt-token');
    const callArgs = io.mock.calls[0][1] as { auth: { token: string } };
    expect(callArgs.auth.token).toBe('my-jwt-token');
  });

  // Edge case — autoConnect: false la bat buoc (caller chu dong goi .connect())
  it('dat autoConnect: false de caller kiem soat vong doi socket', () => {
    const { io } = require('socket.io-client') as { io: jest.Mock };
    io.mockClear();
    createBattleSocket('token');
    const callArgs = io.mock.calls[0][1] as { autoConnect: boolean };
    expect(callArgs.autoConnect).toBe(false);
  });

  // Happy path — transports cho phep ca websocket lan polling de fallback
  it('cau hinh transports ho tro ca websocket lan polling', () => {
    const { io } = require('socket.io-client') as { io: jest.Mock };
    io.mockClear();
    createBattleSocket('token');
    const callArgs = io.mock.calls[0][1] as { transports: string[] };
    expect(callArgs.transports).toContain('websocket');
    expect(callArgs.transports).toContain('polling');
  });

  // Happy path — tra ve doi tuong socket co cac phuong thuc can thiet
  it('tra ve socket object co connect, disconnect, on, emit', () => {
    const socket = createBattleSocket('token');
    expect(socket).toBeDefined();
    expect(typeof socket.connect).toBe('function');
    expect(typeof socket.disconnect).toBe('function');
    expect(typeof socket.on).toBe('function');
    expect(typeof socket.emit).toBe('function');
  });
});
