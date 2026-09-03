// ─── LoginPage — màn hình đăng nhập bằng Google ──────────────────────────────

import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { firebaseAuth, googleProvider } from '../lib/firebase.js';
import Spinner from '../components/Spinner.js';
import GoogleIcon from '../components/GoogleIcon.js';

export default function LoginPage({ onError }: { onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);

  async function handleGoogle() {
    setBusy(true);
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
      setBusy(false);
    }
  }

  return (
    <div className="screen screen-center screen-login">
      <div className="login-card">
        <div className="brand">
          <div className="brand-icon">Q</div>
          <h1 className="brand-name">QuizzGame</h1>
          <p className="brand-sub">Ôn thi THPT Quốc gia</p>
        </div>

        <hr className="divider" />

        <p className="login-headline">Chào mừng trở lại 👋</p>
        <p className="login-hint">
          Đăng nhập để bắt đầu ôn thi cùng hàng ngàn học sinh khác
        </p>

        <button className="btn-google" onClick={() => void handleGoogle()} disabled={busy}>
          {busy ? <Spinner /> : <GoogleIcon />}
          <span>{busy ? 'Đang đăng nhập…' : 'Đăng nhập bằng Google'}</span>
        </button>

        <p className="login-note">
          Bằng cách đăng nhập, bạn đồng ý với điều khoản sử dụng của QuizzGame.
        </p>
      </div>
    </div>
  );
}
