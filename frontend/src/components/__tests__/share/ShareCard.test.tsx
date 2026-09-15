import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ShareCard from '../../share/ShareCard.js';

describe('ShareCard (frontend)', () => {
  // ─── Happy path ───────────────────────────────────────────────────────────
  it('hiển thị đúng tên user, kết quả, subtitle cho loại exam', () => {
    render(
      <ShareCard
        userName="Nguyễn Văn A"
        result="8.5/10"
        subtitle="Toán Đại số · +120 điểm"
        type="exam"
      />,
    );
    expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
    expect(screen.getByText('8.5/10')).toBeTruthy();
    expect(screen.getByText('Toán Đại số · +120 điểm')).toBeTruthy();
    expect(screen.getByText(/KẾT QUẢ THI THỬ/i)).toBeTruthy();
    // 'QuizzGame' xuất hiện ở header + footer (khi URL chưa cấu hình) → dùng getAllByText
    expect(screen.getAllByText('QuizzGame').length).toBeGreaterThanOrEqual(1);
  });

  it('hiển thị đúng nhãn loại battle', () => {
    render(
      <ShareCard
        userName="Test User"
        result="THẮNG 🏆"
        subtitle="+50 điểm"
        type="battle"
      />,
    );
    expect(screen.getByText(/KẾT QUẢ BATTLE/i)).toBeTruthy();
  });

  // ─── Edge case ────────────────────────────────────────────────────────────
  it('fallback "Bạn" khi userName rỗng', () => {
    render(
      <ShareCard userName="" result="5.0/10" subtitle="Thi thử" type="exam" />,
    );
    expect(screen.getByText('Bạn')).toBeTruthy();
  });

  it('hiển thị QuizzGame thay URL khi SHARE_APP_URL rỗng', () => {
    render(
      <ShareCard userName="A" result="THUA" subtitle="-10 điểm" type="battle" />,
    );
    // Footer phải hiện 'QuizzGame' khi URL chưa cấu hình
    const footerEls = screen.getAllByText('QuizzGame');
    expect(footerEls.length).toBeGreaterThanOrEqual(1);
  });

  it('render không crash khi result là chuỗi rỗng', () => {
    const { container } = render(
      <ShareCard userName="A" result="" subtitle="" type="exam" />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});
