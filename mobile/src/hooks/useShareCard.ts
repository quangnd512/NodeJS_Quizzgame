import { useRef, useState, useCallback } from 'react';
import type { RefObject } from 'react';
import type { View } from 'react-native';

interface UseShareCardReturn {
  /** Ref gắn vào View chứa ShareCard */
  cardRef: RefObject<View | null>;
  /** true khi đang chụp/chia sẻ */
  sharing: boolean;
  /** Lỗi nếu có */
  error: string | null;
  /** Chụp View và mở native share dialog */
  shareAsImage: () => Promise<void>;
}

/**
 * Hook dùng react-native-view-shot để chụp ShareCard và expo-sharing để mở native dialog.
 *
 * Cách dùng:
 * ```tsx
 * const { cardRef, sharing, shareAsImage } = useShareCard();
 * // gắn cardRef vào View chứa ShareCard
 * // gọi shareAsImage() khi người dùng bấm nút
 * ```
 */
export function useShareCard(): UseShareCardReturn {
  const cardRef = useRef<View | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const shareAsImage = useCallback(async () => {
    if (!cardRef.current) return;
    setSharing(true);
    setError(null);
    try {
      // Import động để code-split, không load khi không dùng tính năng share
      const { captureRef } = await import('react-native-view-shot');
      const { shareAsync }  = await import('expo-sharing');

      const uri = await captureRef(cardRef, {
        format:  'png',
        quality: 1,
        result:  'tmpfile',
      });

      await shareAsync(uri, {
        mimeType:   'image/png',
        dialogTitle: 'Chia sẻ kết quả',
        UTI:         'public.png', // iOS
      });
    } catch (err) {
      setError('Không thể chia sẻ ảnh. Vui lòng thử lại.');
      console.error('[useShareCard] share error:', err);
    } finally {
      setSharing(false);
    }
  }, []);

  return { cardRef, sharing, error, shareAsImage };
}
