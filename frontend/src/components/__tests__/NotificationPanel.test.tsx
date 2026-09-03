import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationToast } from '../NotificationPanel.js';
import type { NotificationItem } from '../../lib/api.js';

const makeItem = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: 'notif-1',
  type: 'RANK_UP',
  title: 'Tăng hạng!',
  body: 'Bạn đã lên hạng 3.',
  isRead: false,
  createdAt: new Date().toISOString(),
  targetScreen: null,
  ...overrides,
});

describe('NotificationToast', () => {
  it('hiển thị title', () => {
    render(<NotificationToast item={makeItem()} onClose={vi.fn()} />);
    expect(screen.getByText('Tăng hạng!')).toBeTruthy();
  });

  it('hiển thị body', () => {
    render(<NotificationToast item={makeItem()} onClose={vi.fn()} />);
    expect(screen.getByText('Bạn đã lên hạng 3.')).toBeTruthy();
  });

  it('có role="alert"', () => {
    render(<NotificationToast item={makeItem()} onClose={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('nút Đóng gọi onClose', () => {
    const onClose = vi.fn();
    render(<NotificationToast item={makeItem()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Đóng'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('click vào toast gọi onClose', () => {
    const onClose = vi.fn();
    render(<NotificationToast item={makeItem()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('alert'));
    expect(onClose).toHaveBeenCalled();
  });

  it('loại RANK_UP có class notif-type-rank-up', () => {
    const { container } = render(<NotificationToast item={makeItem({ type: 'RANK_UP' })} onClose={vi.fn()} />);
    expect(container.firstChild).toHaveProperty('className');
    expect((container.firstChild as HTMLElement).className).toContain('notif-type-rank-up');
  });

  it('loại NEW_EXAM_PAPER có class notif-type-exam', () => {
    const { container } = render(
      <NotificationToast item={makeItem({ type: 'NEW_EXAM_PAPER' })} onClose={vi.fn()} />,
    );
    expect((container.firstChild as HTMLElement).className).toContain('notif-type-exam');
  });

  it('hiển thị đúng với nội dung khác nhau', () => {
    render(
      <NotificationToast
        item={makeItem({ title: 'Báo cáo đã xử lý', body: 'Câu hỏi đã được sửa.', type: 'REPORT_RESOLVED' })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Báo cáo đã xử lý')).toBeTruthy();
    expect(screen.getByText('Câu hỏi đã được sửa.')).toBeTruthy();
  });
});
