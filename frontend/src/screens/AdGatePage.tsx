import { useState, useEffect, useCallback } from 'react';
import { adUnlockSubjects } from '../lib/api.js';
import Spinner from '../components/Spinner.js';

const AD_COUNTDOWN_SECONDS = 5;

function AdGatePage({
  sessionToken, onUnlocked, onCancel, onError,
}: {
  sessionToken: string;
  onUnlocked: () => void;
  onCancel: () => void;
  onError: (e: unknown) => void;
}) {
  const [counting, setCounting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(AD_COUNTDOWN_SECONDS);
  const [busy, setBusy] = useState(false);

  const finishAd = useCallback(async () => {
    setBusy(true);
    try {
      await adUnlockSubjects(sessionToken);
      onUnlocked();
    } catch (err) {
      onError(err);
      setCounting(false);
      setBusy(false);
    }
  }, [sessionToken, onUnlocked, onError]);

  useEffect(() => {
    if (!counting || busy) return;
    if (secondsLeft <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void finishAd();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [counting, secondsLeft, busy, finishAd]);

  function startAd() {
    setSecondsLeft(AD_COUNTDOWN_SECONDS);
    setCounting(true);
  }

  return (
    <div className="screen screen-center">
      <div className="ad-gate-card">
        <p className="ad-gate-icon">🔒</p>
        <h2 className="page-title">Đổi môn học là quyền lợi Premium</h2>
        <p className="page-sub">
          Tài khoản miễn phí cần xem 1 quảng cáo ngắn để mở khoá 1 lượt đổi môn.
          Nâng cấp Premium để đổi môn thoải mái, không giới hạn!
        </p>

        {!counting ? (
          <div className="ad-gate-actions">
            <button className="btn-primary btn-lg" onClick={startAd}>
              🎬 Xem quảng cáo để đổi môn
            </button>
            <button className="btn-link" onClick={onCancel}>Huỷ, quay lại</button>
          </div>
        ) : (
          <div className="ad-gate-countdown">
            {busy ? (
              <><Spinner /> Đang mở khoá…</>
            ) : (
              <>⏳ Quảng cáo đang chạy… còn {secondsLeft}s</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdGatePage;
export { AD_COUNTDOWN_SECONDS };
