// Test mau cho ha tang test cua frontend.
// Muc dich: chung minh vitest + jsdom chay duoc, va cover ApiError —
// lop loi duoc dung o moi cuoc goi API.
import { describe, it, expect } from 'vitest';
import { ApiError } from './api';

describe('ApiError', () => {
  // Happy path — tao loi voi day du thong tin
  it('giu nguyen code, message va status khi khoi tao', () => {
    const err = new ApiError('UNAUTHORIZED', 'Chua dang nhap', 401);

    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Chua dang nhap');
    expect(err.status).toBe(401);
    expect(err.name).toBe('ApiError');
  });

  // Edge case — van la Error that, bat duoc bang try/catch thong thuong
  it('la mot instance cua Error nen bat duoc bang catch', () => {
    const err = new ApiError('NOT_FOUND', 'Khong tim thay', 404);

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });

  // Error case — status 5xx van tao duoc binh thuong
  it('chap nhan loi phia server (5xx)', () => {
    const err = new ApiError('INTERNAL_ERROR', 'Loi may chu', 500);

    expect(err.status).toBe(500);
  });
});
