import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { firebaseAuth, googleProvider } from './lib/firebase.js';
import { loginWithFirebaseToken, getMyProfile, updateSubjects, updateProfile, ApiError } from './lib/api.js';
import type { UserProfile } from './lib/api.js';
import './App.css';

// ─── Danh muc mon hoc ────────────────────────────────────────────────────────

const SUBJECTS = [
  { id: 'TOAN', name: 'Toán',              emoji: '📐' },
  { id: 'VAN',  name: 'Ngữ văn',           emoji: '📖' },
  { id: 'ANH',  name: 'Tiếng Anh',         emoji: '🌐' },
  { id: 'LY',   name: 'Vật lý',            emoji: '⚛️' },
  { id: 'HOA',  name: 'Hóa học',           emoji: '🧪' },
  { id: 'SINH', name: 'Sinh học',          emoji: '🧬' },
  { id: 'SU',   name: 'Lịch sử',           emoji: '🏛️' },
  { id: 'DIA',  name: 'Địa lý',            emoji: '🗺️' },
  { id: 'GDCD', name: 'Giáo dục công dân', emoji: '⚖️' },
];

type Screen = 'loading' | 'login' | 'onboarding' | 'profile';

function getInitials(name: string | null, email: string | null): string {
  const src = name ?? email ?? '?';
  return src.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen]             = useState<Screen>('loading');
  const [_firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [globalError, setGlobalError]   = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setScreen('login');
        setSessionToken('');
        setProfile(null);
        return;
      }
      setScreen('loading');
      try {
        const idToken = await user.getIdToken();
        const result  = await loginWithFirebaseToken(idToken);
        setSessionToken(result.token);
        if (result.isNewUser) {
          setScreen('onboarding');
        } else {
          const me = await getMyProfile(result.token);
          setProfile(me);
          setScreen('profile');
        }
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : 'Lỗi không xác định');
        setScreen('login');
      }
    });
    return unsub;
  }, []);

  function handleApiError(err: unknown) {
    if (err instanceof ApiError && err.status === 401) {
      void signOut(firebaseAuth);
      setGlobalError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
    } else {
      setGlobalError(err instanceof Error ? err.message : 'Lỗi không xác định');
    }
  }

  async function afterOnboarding() {
    try {
      const me = await getMyProfile(sessionToken);
      setProfile(me);
      setScreen('profile');
    } catch (err) { handleApiError(err); }
  }

  return (
    <div className="app-shell">
      {globalError && (
        <div className="global-toast" onClick={() => setGlobalError('')}>
          <span>⚠️ {globalError}</span>
          <span className="toast-close">✕</span>
        </div>
      )}

      {screen === 'loading'    && <LoadingScreen />}
      {screen === 'login'      && <LoginPage onError={(m) => setGlobalError(m)} />}
      {screen === 'onboarding' && (
        <OnboardingPage
          sessionToken={sessionToken}
          onDone={afterOnboarding}
          onError={handleApiError}
        />
      )}
      {screen === 'profile' && profile && (
        <ProfilePage
          profile={profile}
          sessionToken={sessionToken}
          onProfileUpdate={setProfile}
          onChangeSubjects={() => setScreen('onboarding')}
          onError={handleApiError}
          onLogout={() => void signOut(firebaseAuth)}
        />
      )}
    </div>
  );
}

// ─── LoadingScreen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="screen screen-center">
      <div className="loader-ring" />
      <p className="loading-text">Đang kết nối…</p>
    </div>
  );
}

// ─── LoginPage ────────────────────────────────────────────────────────────────

function LoginPage({ onError }: { onError: (m: string) => void }) {
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

// ─── OnboardingPage ───────────────────────────────────────────────────────────

function OnboardingPage({
  sessionToken, onDone, onError,
}: { sessionToken: string; onDone: () => void; onError: (e: unknown) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 7) next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await updateSubjects(sessionToken, [...selected]);
      onDone();
    } catch (err) { onError(err); setBusy(false); }
  }

  const count = selected.size;

  return (
    <div className="screen screen-onboarding">
      <div className="onboarding-header">
        <h2 className="page-title">Chọn môn học</h2>
        <p className="page-sub">Chọn các môn bạn muốn ôn thi để cá nhân hoá nội dung</p>
        <div className="counter-badge">
          <span className={count >= 7 ? 'full' : ''}>{count}</span>/7 môn đã chọn
        </div>
      </div>

      <div className="subject-grid">
        {SUBJECTS.map((s) => {
          const isOn  = selected.has(s.id);
          const isOff = !isOn && count >= 7;
          return (
            <button
              key={s.id}
              className={`subject-card ${isOn ? 'on' : ''} ${isOff ? 'off' : ''}`}
              onClick={() => !isOff && toggle(s.id)}
            >
              <span className="sub-emoji">{s.emoji}</span>
              <span className="sub-name">{s.name}</span>
              {isOn && <span className="sub-check">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="onboarding-footer">
        <button
          className="btn-primary btn-lg"
          disabled={count === 0 || busy}
          onClick={() => void handleSubmit()}
        >
          {busy && <Spinner />}
          {busy ? 'Đang lưu…' : 'Bắt đầu ôn thi 🚀'}
        </button>
      </div>
    </div>
  );
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────

function ProfilePage({
  profile, sessionToken, onProfileUpdate, onChangeSubjects, onError, onLogout,
}: {
  profile: UserProfile;
  sessionToken: string;
  onProfileUpdate: (p: UserProfile) => void;
  onChangeSubjects: () => void;
  onError: (e: unknown) => void;
  onLogout: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [saved, setSaved]       = useState(false);
  const [form, setForm]         = useState({
    displayName: profile.displayName ?? '',
    phone:       profile.phone       ?? '',
    school:      profile.school      ?? '',
    province:    profile.province    ?? '',
  });

  const prevId = useRef(profile.id);
  useEffect(() => {
    if (profile.id !== prevId.current) {
      prevId.current = profile.id;
      setForm({
        displayName: profile.displayName ?? '',
        phone: profile.phone ?? '',
        school: profile.school ?? '',
        province: profile.province ?? '',
      });
    }
  }, [profile]);

  async function handleSave() {
    setBusy(true);
    try {
      const updated = await updateProfile(sessionToken, {
        displayName: form.displayName.trim() || null,
        phone:       form.phone.trim()       || null,
        school:      form.school.trim()      || null,
        province:    form.province.trim()    || null,
      });
      onProfileUpdate(updated);
      setEditMode(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { onError(err); }
    finally { setBusy(false); }
  }

  return (
    <div className="screen screen-profile">
      {/* Header */}
      <div className="profile-header">
        <div className="avatar">{getInitials(profile.displayName, profile.email)}</div>
        <div className="profile-id">
          <h2 className="profile-name">{profile.displayName ?? '(Chưa đặt tên)'}</h2>
          <p className="profile-email">{profile.email}</p>
        </div>
        <button className="btn-icon" onClick={onLogout} title="Đăng xuất">↩</button>
      </div>

      {/* Points */}
      <div className="points-card">
        <span className="pts-label">Điểm tích lũy</span>
        <span className="pts-num">{profile.points.toLocaleString('vi-VN')}</span>
        <span className="pts-unit">điểm</span>
      </div>

      {/* Subjects */}
      <section className="card-section">
        <div className="section-row">
          <h3 className="section-title">Môn học đang ôn</h3>
          <button className="btn-link" onClick={onChangeSubjects}>Đổi môn</button>
        </div>
        <div className="chips">
          {profile.subjects.length === 0
            ? <span className="empty">Chưa chọn môn nào</span>
            : profile.subjects.map((s) => <span key={s.id} className="chip">{s.name}</span>)}
        </div>
      </section>

      {/* Profile edit */}
      <section className="card-section">
        <div className="section-row">
          <h3 className="section-title">Hồ sơ cá nhân</h3>
          {!editMode && <button className="btn-link" onClick={() => setEditMode(true)}>Chỉnh sửa</button>}
        </div>

        {saved && <div className="save-banner">✓ Đã lưu thành công</div>}

        {editMode ? (
          <div className="edit-form">
            {([
              ['displayName', 'Họ và tên',           'Nguyễn Văn A'],
              ['phone',       'Số điện thoại',        '0901 234 567'],
              ['school',      'Trường THPT',          'THPT Chu Văn An'],
              ['province',    'Tỉnh / Thành phố',     'Hà Nội'],
            ] as const).map(([key, label, ph]) => (
              <label key={key} className="form-field">
                <span className="field-label">{label}</span>
                <input
                  className="field-input"
                  value={form[key]}
                  placeholder={ph}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
            <div className="edit-btns">
              <button className="btn-secondary" onClick={() => setEditMode(false)}>Huỷ</button>
              <button className="btn-primary" disabled={busy} onClick={() => void handleSave()}>
                {busy && <Spinner />}{busy ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        ) : (
          <div className="info-list">
            {[
              ['Số điện thoại', profile.phone],
              ['Trường THPT',   profile.school],
              ['Tỉnh / TP',     profile.province],
              ['Tham gia',      new Date(profile.createdAt).toLocaleDateString('vi-VN')],
              ['Đăng nhập cuối', profile.lastLoginAt
                ? new Date(profile.lastLoginAt).toLocaleString('vi-VN') : null],
            ].map(([label, val]) => (
              <div key={label as string} className="info-row">
                <span className="info-label">{label}</span>
                <span className={`info-val ${!val ? 'muted' : ''}`}>{val ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function Spinner() {
  return <span className="spinner" aria-hidden />;
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
