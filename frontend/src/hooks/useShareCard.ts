import { useRef, useState, useCallback } from 'react';
import type { RefObject } from 'react';

interface UseShareCardReturn {
  /** Ref gắn vào element cần chụp (ShareCard container div) */
  cardRef: RefObject<HTMLDivElement | null>;
  /** true khi đang render/download */
  sharing: boolean;
  /** Lỗi nếu có */
  error: string | null;
  /** Chụp element và tải về PNG */
  shareAsPng: (fileName?: string) => Promise<void>;
}

/**
 * Hook dùng html2canvas để chụp ShareCard thành PNG và tự động tải về.
 *
 * Cách dùng:
 * ```tsx
 * const { cardRef, sharing, shareAsPng } = useShareCard();
 * // gắn cardRef vào container div chứa ShareCard
 * // gọi shareAsPng('ket-qua.png') khi người dùng bấm nút
 * ```
 */
export function useShareCard(): UseShareCardReturn {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const shareAsPng = useCallback(async (fileName = 'quizzgame-result.png') => {
    if (!cardRef.current) return;
    setSharing(true);
    setError(null);
    try {
      // Import động để không ảnh hưởng initial bundle
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2, // retina
        useCORS: true,
        logging: false,
      });
      // Tải về
      const url  = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href     = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Không thể tạo ảnh. Vui lòng thử lại.');
      console.error('[useShareCard] html2canvas error:', err);
    } finally {
      setSharing(false);
    }
  }, []);

  return { cardRef, sharing, error, shareAsPng };
}
