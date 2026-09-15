import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShareCard } from '../useShareCard.js';

// Mock html2canvas — không cần load thư viện thật trong môi trường test
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,FAKE'),
  }),
}));

describe('useShareCard', () => {
  beforeEach(() => {
    // Dọn sạch state DOM giữa các test
    document.body.innerHTML = '';
  });

  // ─── Happy path ───────────────────────────────────────────────────────────
  it('trả về { cardRef, sharing: false, error: null, shareAsPng } lúc khởi tạo', () => {
    const { result } = renderHook(() => useShareCard());
    expect(result.current.sharing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.shareAsPng).toBe('function');
    expect(result.current.cardRef).toBeDefined();
  });

  it('shareAsPng không làm gì nếu cardRef.current là null', async () => {
    const { result } = renderHook(() => useShareCard());
    // cardRef.current = null theo mặc định
    await act(async () => {
      await result.current.shareAsPng();
    });
    // sharing vẫn false — không throw
    expect(result.current.sharing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ─── Error case ───────────────────────────────────────────────────────────
  it('đặt error khi html2canvas throw exception', async () => {
    const { default: html2canvas } = await import('html2canvas');
    (html2canvas as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('canvas fail'));

    const { result } = renderHook(() => useShareCard());

    // Gắn element giả để cardRef.current không null
    const div = document.createElement('div');
    document.body.appendChild(div);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (result.current.cardRef as any).current = div;

    await act(async () => {
      await result.current.shareAsPng();
    });

    expect(result.current.error).toBe('Không thể tạo ảnh. Vui lòng thử lại.');
    expect(result.current.sharing).toBe(false);
  });
});
