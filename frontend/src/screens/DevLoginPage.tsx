// ─── DevLoginPage — màn hình đăng nhập dev (CHỈ dùng khi DEV mode + DEV_LOGIN_ENABLED) ──
// Mục đích: S5-ThuNghiem có thể mở 2 tab với 2 tài khoản test khác nhau để kiểm thử
// các tính năng cần nhiều người (Battle, Notification click-to-navigate).
//
// AN TOÀN: Trang này chỉ render khi `import.meta.env.DEV === true`.
// Backend cũng khoá endpoint bởi 2 lớp (NODE_ENV + DEV_LOGIN_ENABLED).

import { useState } from 'react';
import { devLoginApi } from '../lib/api.js';
import type { LoginResult } from '../lib/api.js';
import Spinner from '../components/Spinner.js';

interface Props {
  onSuccess: (result: LoginResult) => void;
  onError: (message: string) => void;
}

export default function DevLoginPage({ onSuccess, onError }: Props) {
  const [email, setEmail]           = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy]             = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const result = await devLoginApi(email.trim(), displayName.trim() || undefined);
      onSuccess(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Dev-login thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen screen-center screen-login">
      <div className="login-card">
        <div className="brand">
          <div className="brand-icon" style={{ background: 'var(--color-warning, #f59e0b)', fontSize: '1.2rem' }}>🛠</div>
          <h1 className="brand-name" style={{ fontSize: '1.6rem' }}>Dev Login</h1>
          <p className="brand-sub">Chỉ dùng khi test — không phải tài khoản thật</p>
        </div>

        <hr className="divider" />

        <p className="login-headline">Đăng nhập tài khoản test 🧪</p>
        <p className="login-hint" style={{ color: 'var(--color-warning, #f59e0b)', fontWeight: 600 }}>
          ⚠️ Chế độ này chỉ hoạt động khi DEV_LOGIN_ENABLED=true ở backend.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
          <div style={{ textAlign: 'left' }}>
            <label htmlFor="dev-email" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>
              Email tài khoản test *
            </label>
            <input
              id="dev-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test1@example.com"
              required
              disabled={busy}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '1rem',
                background: 'var(--bg)',
                color: 'var(--text-h)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label htmlFor="dev-name" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>
              Tên hiển thị (tuỳ chọn)
            </label>
            <input
              id="dev-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Test User 1"
              disabled={busy}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '1rem',
                background: 'var(--bg)',
                color: 'var(--text-h)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-google"
            disabled={busy || !email.trim()}
            style={{ marginTop: '0.5rem' }}
          >
            {busy ? <Spinner /> : <span>🔑</span>}
            <span>{busy ? 'Đang đăng nhập…' : 'Đăng nhập dev'}</span>
          </button>
        </form>

        <p className="login-note" style={{ marginTop: '1rem' }}>
          Tài khoản này được tạo tự động nếu chưa tồn tại (dùng email làm key).
          Dữ liệu tồn tại thật trong DB — không xoá tự động sau khi test.
        </p>
      </div>
    </div>
  );
}
