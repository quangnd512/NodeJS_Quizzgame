import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AvatarCell from '../AvatarCell.js';

describe('AvatarCell', () => {
  it('hiện <img> khi có avatarUrl', () => {
    const { getByRole } = render(
      <AvatarCell avatarUrl="https://example.com/avatar.jpg" name="Nguyễn A" />,
    );
    const img = getByRole('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.jpg');
  });

  it('hiện initials khi không có avatarUrl', () => {
    const { container } = render(<AvatarCell avatarUrl={null} name="Nguyễn Anh" />);
    // không có img
    expect(container.querySelector('img')).toBeNull();
    // có div chứa initials
    const div = container.querySelector('div');
    expect(div?.textContent).toBe('NA');
  });

  it('hiện "?" khi cả avatarUrl lẫn name đều null', () => {
    const { container } = render(<AvatarCell avatarUrl={null} name={null} />);
    const div = container.querySelector('div');
    expect(div?.textContent).toBe('?');
  });

  it('size mặc định 40', () => {
    const { container } = render(<AvatarCell avatarUrl={null} name="Test" />);
    const div = container.querySelector('div') as HTMLElement;
    expect(div.style.width).toBe('40px');
    expect(div.style.height).toBe('40px');
  });

  it('size có thể override', () => {
    const { container } = render(<AvatarCell avatarUrl={null} name="Test" size={64} />);
    const div = container.querySelector('div') as HTMLElement;
    expect(div.style.width).toBe('64px');
    expect(div.style.height).toBe('64px');
  });
});
