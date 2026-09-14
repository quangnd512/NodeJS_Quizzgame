import { SHARE_APP_URL } from '../../constants/shareConfig.js';

export type ShareCardType = 'exam' | 'battle';

export interface ShareCardProps {
  /** Tên hiển thị của người dùng */
  userName: string;
  /** Kết quả chính hiển thị to, ví dụ: "8.5/10" hoặc "THẮNG" */
  result: string;
  /** Dòng phụ, ví dụ: "Toán Đại số · +120 điểm" */
  subtitle: string;
  /** Loại card: kết quả thi hay battle */
  type: ShareCardType;
}

/**
 * ShareCard — card ảnh dùng để html2canvas chụp thành PNG chia sẻ.
 * Component này được render off-screen (position: absolute, left: -9999px).
 * Kích thước cố định 400×220px để ảnh PNG nhất quán.
 */
export default function ShareCard({ userName, result, subtitle, type }: ShareCardProps) {
  const gradientStart = type === 'exam' ? '#1e40af' : '#7c3aed';
  const gradientEnd   = type === 'exam' ? '#3b82f6' : '#a855f7';
  const typeLabel     = type === 'exam' ? '📝 KẾT QUẢ THI THỬ' : '⚔️ KẾT QUẢ BATTLE';

  return (
    <div
      style={{
        width: 400,
        height: 220,
        background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
        borderRadius: 16,
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: "'Segoe UI', Arial, sans-serif",
        color: '#fff',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decoration */}
      <div
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -30,
          left: -30,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
        }}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.75, letterSpacing: 1, textTransform: 'uppercase' }}>
            {typeLabel}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
            {userName || 'Bạn'}
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -1, opacity: 0.9 }}>
          QuizzGame
        </div>
      </div>

      {/* Result */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            lineHeight: 1,
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {result}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
          {subtitle}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          fontSize: 11,
          opacity: 0.6,
          textAlign: 'right',
        }}
      >
        {SHARE_APP_URL || 'QuizzGame'}
      </div>
    </div>
  );
}
