import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

// Mock firebase/auth — signInWithPopup không cần gọi thật
vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn().mockResolvedValue({}),
  getAuth: vi.fn(),
}));

// Mock lib/firebase vì nó gọi initializeApp (không cần trong test)
vi.mock('../../lib/firebase.js', () => ({
  firebaseAuth: {},
  googleProvider: {},
}));

import { signInWithPopup } from 'firebase/auth';
import LoginPage from '../LoginPage.js';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('render nút "Đăng nhập bằng Google"', () => {
    const { getByText } = render(<LoginPage onError={() => {}} />);
    expect(getByText('Đăng nhập bằng Google')).toBeTruthy();
  });

  it('click nút → signInWithPopup được gọi', async () => {
    const { getByText } = render(<LoginPage onError={() => {}} />);
    const btn = getByText('Đăng nhập bằng Google').closest('button') as HTMLButtonElement;
    fireEvent.click(btn);
    // signInWithPopup là async — chờ microtask queue
    await vi.waitFor(() => {
      expect(signInWithPopup).toHaveBeenCalledTimes(1);
    });
  });

  it('hiện brand QuizzGame', () => {
    const { getByText } = render(<LoginPage onError={() => {}} />);
    expect(getByText('QuizzGame')).toBeTruthy();
  });
});
