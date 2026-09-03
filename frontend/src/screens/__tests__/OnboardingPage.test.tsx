import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

// Mock updateSubjects vì không cần gọi API thật
vi.mock('../../lib/api.js', () => ({
  updateSubjects: vi.fn().mockResolvedValue(undefined),
}));

import { updateSubjects } from '../../lib/api.js';
import OnboardingPage from '../OnboardingPage.js';

const defaultProps = {
  sessionToken: 'test-token',
  currentSubjects: [],
  onDone: vi.fn(),
  onError: vi.fn(),
};

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('render đủ 9 môn', () => {
    const { getByText } = render(<OnboardingPage {...defaultProps} />);
    expect(getByText('Toán')).toBeTruthy();
    expect(getByText('Ngữ văn')).toBeTruthy();
    expect(getByText('Tiếng Anh')).toBeTruthy();
    expect(getByText('Vật lý')).toBeTruthy();
    expect(getByText('Hóa học')).toBeTruthy();
    expect(getByText('Sinh học')).toBeTruthy();
    expect(getByText('Lịch sử')).toBeTruthy();
    expect(getByText('Địa lý')).toBeTruthy();
    expect(getByText('Giáo dục công dân')).toBeTruthy();
  });

  it('click môn → chọn được (class "on")', () => {
    const { getByText } = render(<OnboardingPage {...defaultProps} />);
    const btn = getByText('Toán').closest('button') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(btn.className).toContain('on');
  });

  it('click môn đã chọn → bỏ chọn (mất class "on")', () => {
    const { getByText } = render(<OnboardingPage {...defaultProps} />);
    const btn = getByText('Toán').closest('button') as HTMLButtonElement;
    fireEvent.click(btn); // chọn
    expect(btn.className).toContain('on');
    fireEvent.click(btn); // bỏ chọn
    expect(btn.className).not.toContain('on');
  });

  it('không chọn quá 7 môn', () => {
    const { getAllByRole } = render(<OnboardingPage {...defaultProps} />);
    const buttons = getAllByRole('button').filter((b) =>
      b.className.includes('subject-card'),
    );
    // Click 9 nút (tất cả môn)
    buttons.forEach((btn) => fireEvent.click(btn));
    // Chỉ 7 nút có class 'on'
    const selected = buttons.filter((b) => b.className.includes('on'));
    expect(selected.length).toBe(7);
  });

  it('submit → updateSubjects được gọi với đúng danh sách', async () => {
    const onDone = vi.fn();
    const { getByText } = render(
      <OnboardingPage {...defaultProps} onDone={onDone} />,
    );
    // Chọn 2 môn
    fireEvent.click(getByText('Toán').closest('button')!);
    fireEvent.click(getByText('Vật lý').closest('button')!);
    // Nhấn submit
    fireEvent.click(getByText('Bắt đầu ôn thi 🚀'));
    await waitFor(() => {
      expect(updateSubjects).toHaveBeenCalledWith(
        'test-token',
        expect.arrayContaining(['TOAN', 'LY']),
      );
      expect(onDone).toHaveBeenCalled();
    });
  });

  it('hiển thị môn đã chọn trước đó (currentSubjects)', () => {
    const { getByText } = render(
      <OnboardingPage {...defaultProps} currentSubjects={['TOAN', 'HOA']} />,
    );
    expect(getByText('Toán').closest('button')?.className).toContain('on');
    expect(getByText('Hóa học').closest('button')?.className).toContain('on');
  });
});
