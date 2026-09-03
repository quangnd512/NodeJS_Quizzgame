import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import LoadingScreen from '../LoadingScreen.js';

describe('LoadingScreen', () => {
  it('render text "Đang kết nối…"', () => {
    const { getByText } = render(<LoadingScreen />);
    expect(getByText('Đang kết nối…')).toBeTruthy();
  });

  it('có class loader-ring', () => {
    const { container } = render(<LoadingScreen />);
    expect(container.querySelector('.loader-ring')).toBeTruthy();
  });
});
