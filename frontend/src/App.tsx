import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseAuth, googleProvider } from './lib/firebase.js';
import {
  loginWithFirebaseToken, getMyProfile, updateSubjects, updateProfile, ApiError,
  startPracticeSession, answerQuestion, completeSession, reportQuestion,
  getPracticeHistory, getPracticeStats,
  startExam, submitExam, getExamResult,
  adminListReports, adminUpdateReportStatus, adminGetReportsSummary,
  adminListExamPapers, adminGetExamPaperDetail, adminCreateExamPaper, adminUpdateExamPaper,
  adminUpdateExamQuestion, adminDeleteExamQuestion, adminRestoreExamQuestion, adminImportExamQuestions,
  adminAutoFillFromBank,
  adminListQuestionBank, adminCreateQuestionBankItem, adminUpdateQuestionBankItem,
  adminGetQuestionBankUsage, adminDeleteQuestionBankItem, adminAddFromBank,
  uploadAvatar, deleteAvatar,
  getLeaderboard, getMyLeaderboardRank,
  getProgressSummary, getExamHistory,
  getWrongAnswers, retryWrongAnswer,
  adminGetDashboard, adminListUsers, adminGetUserDetail,
  adminBlockUser, adminResetPassword, adminSetUserRole, adminDeleteUser,
} from './lib/api.js';
import type {
  UserProfile, StartSessionResult, AnswerResult, CompleteResult,
  HistoryItem, SubjectStat, QuestionReportDto, ReportsSummary, ReportStatus,
  StartExamResult, SubmitExamResult, ExamResult, ExamAnswerValue, ExamQuestionType, ExamQuestionPublic,
  ExamPaperSummary, ExamPaperDetail, ExamImportResultDto,
  QuestionBankItem, QuestionBankUsage,
  LeaderboardEntry, MyRankResponse,
  ProgressSummary, ExamHistoryItem, PaginatedExamHistory,
  WrongAnswerItem, WrongAnswerListResponse, RetryResult,
  DashboardStats, AdminUserListItem, AdminUserDetail,
} from './lib/api.js';
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

type Screen = 'loading' | 'login' | 'onboarding' | 'profile' | 'practice' | 'exam' | 'admin' | 'leaderboard' | 'progress' | 'wrongAnswers';

function getInitials(name: string | null, email: string | null): string {
  const src = name ?? email ?? '?';
  return src.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen]             = useState<Screen>(() =>
    window.location.hash === '#admin' ? 'admin' : 'loading',
  );
  const [sessionToken, setSessionToken] = useState('');
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [globalError, setGlobalError]   = useState('');

  useEffect(() => {
    // Trang Admin chay doc lap, khong can dang nhap Firebase
    if (screen === 'admin') return;
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
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
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

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

      {screen === 'admin'      && <AdminPage />}
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
          onPractice={() => setScreen('practice')}
          onExam={() => setScreen('exam')}
          onLeaderboard={() => setScreen('leaderboard')}
          onProgress={() => setScreen('progress')}
          onWrongAnswers={() => setScreen('wrongAnswers')}
          onError={handleApiError}
          onLogout={() => void signOut(firebaseAuth)}
        />
      )}
      {screen === 'practice' && profile && (
        <PracticePage
          profile={profile}
          sessionToken={sessionToken}
          onBack={() => setScreen('profile')}
          onProfileUpdate={setProfile}
          onError={handleApiError}
        />
      )}
      {screen === 'exam' && profile && (
        <ExamPage
          profile={profile}
          sessionToken={sessionToken}
          onBack={() => setScreen('profile')}
          onProfileUpdate={setProfile}
          onError={handleApiError}
        />
      )}
      {screen === 'leaderboard' && profile && (
        <LeaderboardPage
          profile={profile}
          sessionToken={sessionToken}
          onBack={() => setScreen('profile')}
          onError={handleApiError}
        />
      )}
      {screen === 'progress' && profile && (
        <ProgressPage
          profile={profile}
          sessionToken={sessionToken}
          onBack={() => setScreen('profile')}
          onError={handleApiError}
        />
      )}
      {screen === 'wrongAnswers' && profile && (
        <WrongAnswersPage
          sessionToken={sessionToken}
          onBack={() => setScreen('profile')}
          onError={handleApiError}
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
  profile, sessionToken, onProfileUpdate, onChangeSubjects, onPractice, onExam, onLeaderboard, onProgress, onWrongAnswers, onError, onLogout,
}: {
  profile: UserProfile;
  sessionToken: string;
  onProfileUpdate: (p: UserProfile) => void;
  onChangeSubjects: () => void;
  onPractice: () => void;
  onExam: () => void;
  onLeaderboard: () => void;
  onProgress: () => void;
  onWrongAnswers: () => void;
  onError: (e: unknown) => void;
  onLogout: () => void;
}) {
  const [editMode, setEditMode]         = useState(false);
  const [busy, setBusy]                 = useState(false);
  const [saved, setSaved]               = useState(false);
  const [avatarBusy, setAvatarBusy]     = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile]   = useState<File | null>(null);
  const [avatarErr, setAvatarErr]       = useState('');
  const fileInputRef                    = useRef<HTMLInputElement>(null);
  const [form, setForm]                 = useState({
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarErr('');
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setAvatarErr('Chỉ chấp nhận file JPG hoặc PNG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarErr('Ảnh quá lớn, tối đa 2MB.');
      return;
    }
    setPendingFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    // Reset input để có thể chọn lại cùng file
    e.target.value = '';
  }

  async function handleAvatarSave() {
    if (!pendingFile) return;
    setAvatarBusy(true);
    try {
      const updated = await uploadAvatar(sessionToken, pendingFile);
      onProfileUpdate(updated);
      setPendingFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
    } catch (err) { onError(err); }
    finally { setAvatarBusy(false); }
  }

  function handleAvatarCancel() {
    setPendingFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarErr('');
  }

  async function handleAvatarDelete() {
    if (!confirm('Xoá ảnh đại diện?')) return;
    setAvatarBusy(true);
    try {
      const updated = await deleteAvatar(sessionToken);
      onProfileUpdate(updated);
    } catch (err) { onError(err); }
    finally { setAvatarBusy(false); }
  }

  const displayAvatarUrl = avatarPreview ?? profile.avatarUrl;

  return (
    <div className="screen screen-profile">
      {/* Header */}
      <div className="profile-header">
        {/* Avatar có thể click để upload */}
        <div className="avatar-wrapper">
          <button
            className="avatar-btn"
            onClick={() => !avatarBusy && fileInputRef.current?.click()}
            title="Đổi ảnh đại diện"
            disabled={avatarBusy}
          >
            {displayAvatarUrl ? (
              <img src={displayAvatarUrl} alt="avatar" className="avatar-img" />
            ) : (
              <div className="avatar">{getInitials(profile.displayName, profile.email)}</div>
            )}
            <span className="avatar-overlay">📷</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        <div className="profile-id">
          <h2 className="profile-name">{profile.displayName ?? '(Chưa đặt tên)'}</h2>
          <p className="profile-email">{profile.email}</p>
        </div>
        <button className="btn-icon" onClick={onLogout} title="Đăng xuất">↩</button>
      </div>

      {/* Avatar actions (preview / xóa) */}
      {avatarErr && <p style={{ color: 'var(--color-error, #e53)', padding: '0 1.25rem', fontSize: '.85rem' }}>{avatarErr}</p>}
      {pendingFile && (
        <div className="avatar-preview-bar">
          <span>Preview ảnh mới</span>
          <button className="btn-secondary" onClick={handleAvatarCancel} disabled={avatarBusy}>Huỷ</button>
          <button className="btn-primary" onClick={() => void handleAvatarSave()} disabled={avatarBusy}>
            {avatarBusy ? <><Spinner /> Đang lưu…</> : 'Lưu ảnh'}
          </button>
        </div>
      )}
      {!pendingFile && profile.avatarUrl && (
        <div style={{ padding: '0 1.25rem .5rem' }}>
          <button className="btn-link" style={{ color: '#e53' }} onClick={() => void handleAvatarDelete()} disabled={avatarBusy}>
            {avatarBusy ? 'Đang xoá…' : 'Xoá ảnh đại diện'}
          </button>
        </div>
      )}

      {/* Points */}
      <div className="points-card">
        <span className="pts-label">Điểm tích lũy</span>
        <span className="pts-num">{profile.points.toLocaleString('vi-VN')}</span>
        <span className="pts-unit">điểm</span>
      </div>

      {/* Practice + Exam + Leaderboard CTA */}
      <div style={{ padding: '0 1.25rem .75rem', display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
        <button className="btn-primary btn-lg" onClick={onPractice}>
          Bắt đầu ôn tập 📚
        </button>
        <button className="btn-secondary btn-lg" onClick={onExam}>
          Thi thử 🎯
        </button>
        <button className="btn-secondary btn-lg" onClick={onLeaderboard} style={{ background: 'linear-gradient(135deg,#f6d365,#fda085)', color: '#333', border: 'none' }}>
          🏆 Bảng xếp hạng
        </button>
        <button className="btn-secondary btn-lg" onClick={onProgress} style={{ background: 'linear-gradient(135deg,#a8edea,#fed6e3)', color: '#333', border: 'none' }}>
          📊 Tiến độ của tôi
        </button>
        <button className="btn-secondary btn-lg" onClick={onWrongAnswers} style={{ background: 'linear-gradient(135deg,#f093fb,#f5576c)', color: '#fff', border: 'none' }}>
          ❌ Ôn câu sai
        </button>
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

// ─── PracticePage ─────────────────────────────────────────────────────────────

const SUBJECTS_MAP: Record<string, { name: string; emoji: string }> = {
  TOAN: { name: 'Toán', emoji: '📐' },
  VAN:  { name: 'Ngữ văn', emoji: '📖' },
  ANH:  { name: 'Tiếng Anh', emoji: '🌐' },
  LY:   { name: 'Vật lý', emoji: '⚛️' },
  HOA:  { name: 'Hóa học', emoji: '🧪' },
  SINH: { name: 'Sinh học', emoji: '🧬' },
  SU:   { name: 'Lịch sử', emoji: '🏛️' },
  DIA:  { name: 'Địa lý', emoji: '🗺️' },
  GDCD: { name: 'GDCD', emoji: '⚖️' },
};

const DIFF_LABEL: Record<number, string> = { 1: 'Dễ', 2: 'Trung bình', 3: 'Khó' };
const SESSION_SECONDS = 17 * 60;
const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const REPORT_REASONS = [
  { value: 'WRONG_ANSWER', label: 'Đáp án sai' },
  { value: 'BAD_CONTENT',  label: 'Nội dung không phù hợp' },
  { value: 'TYPO',         label: 'Lỗi chính tả' },
  { value: 'OTHER',        label: 'Lý do khác' },
] as const;

type PracticeSub = 'hub' | 'session' | 'result';

interface ActiveSession {
  data: StartSessionResult;
  startedAt: number;
  currentIndex: number;
  answers: Map<string, AnswerResult & { selected: number }>;
}

function PracticePage({
  profile, sessionToken, onBack, onProfileUpdate, onError,
}: {
  profile: UserProfile;
  sessionToken: string;
  onBack: () => void;
  onProfileUpdate: (p: UserProfile) => void;
  onError: (e: unknown) => void;
}) {
  const [sub, setSub]           = useState<PracticeSub>('hub');
  const [stats, setStats]       = useState<SubjectStat[]>([]);
  const [history, setHistory]   = useState<HistoryItem[]>([]);
  const [session, setSession]   = useState<ActiveSession | null>(null);
  const [result, setResult]     = useState<CompleteResult | null>(null);
  const [loadingSubj, setLoadingSubj] = useState('');
  const [completing, setCompleting]   = useState(false);

  useEffect(() => {
    void getPracticeStats(sessionToken).then(setStats).catch(() => {});
    void getPracticeHistory(sessionToken).then((r) => setHistory(r.items)).catch(() => {});
  }, [sessionToken]);

  async function handleStartSession(subject: string) {
    setLoadingSubj(subject);
    try {
      const data = await startPracticeSession(sessionToken, subject);
      // Date.now() ghi nhan moc thoi gian bat dau session trong event handler
      // (khong phai luc render), can de tinh thoi gian lam bai.
      // eslint-disable-next-line react-hooks/purity
      setSession({ data, startedAt: Date.now(), currentIndex: 0, answers: new Map() });
      setSub('session');
    } catch (err) { onError(err); }
    finally { setLoadingSubj(''); }
  }

  async function handleAnswer(questionId: string, selected: number) {
    if (!session) return;
    try {
      const res = await answerQuestion(sessionToken, session.data.sessionId, questionId, selected);
      setSession((s) => {
        if (!s) return s;
        const next = new Map(s.answers);
        next.set(questionId, { ...res, selected });
        return { ...s, answers: next };
      });
    } catch (err) { onError(err); }
  }

  function handleNextQuestion() {
    setSession((s) => s ? { ...s, currentIndex: s.currentIndex + 1 } : s);
  }

  async function handleComplete() {
    if (!session || completing) return;
    setCompleting(true);
    try {
      const res = await completeSession(sessionToken, session.data.sessionId);
      setResult(res);
      void getPracticeStats(sessionToken).then(setStats).catch(() => {});
      void getPracticeHistory(sessionToken).then((r) => setHistory(r.items)).catch(() => {});
      void getMyProfile(sessionToken).then(onProfileUpdate).catch(() => {});
      setSub('result');
    } catch (err) { onError(err); }
    finally { setCompleting(false); }
  }

  if (sub === 'session' && session) {
    return (
      <PracticeSessionScreen
        session={session}
        sessionToken={sessionToken}
        onAnswer={handleAnswer}
        onNext={handleNextQuestion}
        onComplete={handleComplete}
        completing={completing}
        onError={onError}
      />
    );
  }

  if (sub === 'result' && result) {
    return (
      <PracticeResultScreen
        result={result}
        onAgain={() => { setResult(null); setSub('hub'); }}
        onHome={onBack}
      />
    );
  }

  // Hub
  const subjects = profile.subjects;
  const statsMap = new Map(stats.map((s) => [s.subject, s]));

  return (
    <div className="screen practice-hub">
      <div className="practice-hub-header">
        <button className="btn-icon-back" onClick={onBack}>←</button>
        <h2 className="page-title" style={{ flex: 1 }}>Ôn tập</h2>
      </div>

      <div className="practice-subjects">
        {subjects.map((s) => {
          const info  = SUBJECTS_MAP[s.id] ?? { name: s.name, emoji: '📘' };
          const stat  = statsMap.get(s.id);
          const busy  = loadingSubj === s.id;
          return (
            <button
              key={s.id}
              className="practice-subject-card"
              onClick={() => void handleStartSession(s.id)}
              disabled={!!loadingSubj}
            >
              <span className="ps-emoji">{info.emoji}</span>
              <div className="ps-info">
                <span className="ps-name">{info.name}</span>
                {stat
                  ? <span className="ps-stat">{stat.totalSessions} phiên · Cao nhất {stat.bestScore}/15</span>
                  : <span className="ps-stat ps-new">Chưa ôn lần nào</span>}
              </div>
              {busy ? <Spinner /> : <span className="ps-arrow">▶</span>}
            </button>
          );
        })}
      </div>

      {history.length > 0 && (
        <section className="card-section" style={{ margin: '0 1.25rem .75rem' }}>
          <h3 className="section-title" style={{ marginBottom: '.75rem' }}>Lịch sử gần đây</h3>
          {history.slice(0, 5).map((h) => {
            const info = SUBJECTS_MAP[h.subjectId] ?? { name: h.subjectId, emoji: '📘' };
            return (
              <div key={h.sessionId} className="history-row">
                <span className="hist-emoji">{info.emoji}</span>
                <span className="hist-name">{info.name}</span>
                <span className="hist-score">{h.score}/{h.totalQuestions}</span>
                <span className="hist-pts">+{h.pointsEarned} pts</span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

// ─── PracticeSessionScreen ────────────────────────────────────────────────────

function PracticeSessionScreen({
  session, sessionToken, onAnswer, onNext, onComplete, completing, onError,
}: {
  session: ActiveSession;
  sessionToken: string;
  onAnswer: (qId: string, opt: number) => Promise<void>;
  onNext: () => void;
  onComplete: () => Promise<void>;
  completing: boolean;
  onError: (e: unknown) => void;
}) {
  const { data, startedAt, currentIndex, answers } = session;
  const question = data.questions[currentIndex];
  const answered = question ? answers.get(question.id) : undefined;
  const isLast   = currentIndex >= data.questions.length - 1;
  const total    = data.questions.length;

  const [timeLeft, setTimeLeft] = useState(() => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    return Math.max(0, SESSION_SECONDS - elapsed);
  });
  const [answerBusy, setAnswerBusy] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportMessage, setReportMessage] = useState('Đã gửi báo lỗi');
  const [reportError, setReportError] = useState('');
  const [reportDesc, setReportDesc] = useState('');

  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(id); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Component khong unmount giua cac cau hoi (chi doi currentIndex) nen phai
  // tu reset trang thai bao loi moi khi sang cau khac, tranh hien thi nham
  // thong bao "Da gui bao loi" cua cau truoc cho cau hien tai.
  useEffect(() => {
    // reset 5 state UI cuc bo theo question.id, khong co nguon "external
    // system" nao de dong bo, can chay dong bo de tranh nhap nhay UI giua
    // cac cau.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowReport(false);
    setReportSent(false);
    setReportMessage('Đã gửi báo lỗi');
    setReportError('');
    setReportDesc('');
  }, [question?.id]);

  async function handleOptionClick(idx: number) {
    if (answered || answerBusy || !question) return;
    setAnswerBusy(true);
    await onAnswer(question.id, idx);
    setAnswerBusy(false);
  }

  async function sendReport(reason: typeof REPORT_REASONS[number]['value']) {
    if (!question) return;
    setReportError('');
    try {
      await reportQuestion(sessionToken, question.id, reason, reportDesc.trim() || undefined);
      setReportMessage('Đã gửi báo lỗi');
      setReportSent(true);
      setShowReport(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'REPORT_ALREADY_SUBMITTED') {
        setReportMessage('Bạn đã báo cáo câu này rồi');
        setReportSent(true);
        setShowReport(false);
        return;
      }
      if (err instanceof ApiError && err.code === 'QUESTION_NOT_ATTEMPTED_FOR_REPORT') {
        setReportError('Bạn cần làm câu hỏi này trước khi báo cáo.');
        return;
      }
      onError(err);
    }
  }

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const timerDanger = timeLeft < 120;
  const progress = ((currentIndex + (answered ? 1 : 0)) / total) * 100;

  if (!question) {
    return (
      <div className="screen screen-center">
        <p style={{ marginBottom: '1rem', color: 'var(--muted)' }}>Phiên ôn tập kết thúc.</p>
        <button className="btn-primary" disabled={completing} onClick={() => void onComplete()}>
          {completing ? <Spinner /> : null} Xem kết quả
        </button>
      </div>
    );
  }

  return (
    <div className="screen practice-session">
      {/* Top bar */}
      <div className="ps-topbar">
        <span className="ps-progress-text">Câu {currentIndex + 1}/{total}</span>
        <span className={`ps-timer ${timerDanger ? 'danger' : ''}`}>{mins}:{secs}</span>
      </div>

      {/* Progress bar */}
      <div className="ps-progress-bar">
        <div className="ps-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Difficulty badge */}
      <div style={{ padding: '1rem 1.25rem .5rem' }}>
        <span className={`diff-badge diff-${question.difficulty}`}>
          {DIFF_LABEL[question.difficulty] ?? 'N/A'}
        </span>
      </div>

      {/* Question */}
      <div className="ps-question">{question.question}</div>

      {/* Options */}
      <div className="ps-options">
        {question.options.map((opt, idx) => {
          let cls = 'ps-option';
          if (answered) {
            if (idx === answered.correctAnswer) cls += ' correct';
            else if (idx === answered.selected && !answered.isCorrect) cls += ' wrong';
            else cls += ' dimmed';
          }
          return (
            <button
              key={idx}
              className={cls}
              onClick={() => void handleOptionClick(idx)}
              disabled={!!answered || answerBusy}
            >
              <span className="opt-label">{OPTION_LABELS[idx]}</span>
              <span className="opt-text">{opt}</span>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {answered && (
        <div className={`ps-feedback ${answered.isCorrect ? 'correct' : 'wrong'}`}>
          <span className="fb-icon">{answered.isCorrect ? '✓' : '✗'}</span>
          <span className="fb-msg">{answered.isCorrect ? 'Chính xác!' : 'Chưa đúng'}</span>
          {answered.explanation && (
            <p className="fb-explain">{answered.explanation}</p>
          )}
        </div>
      )}

      {/* Report */}
      {answered && !reportSent && (
        <div style={{ padding: '0 1.25rem .5rem' }}>
          {showReport ? (
            <div className="report-box">
              <p className="report-title">Báo lỗi câu hỏi</p>
              <textarea
                className="report-desc"
                placeholder="Mô tả thêm (không bắt buộc)"
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                maxLength={500}
              />
              {REPORT_REASONS.map((r) => (
                <button key={r.value} className="report-reason" onClick={() => void sendReport(r.value)}>
                  {r.label}
                </button>
              ))}
              {reportError && <p className="report-error">{reportError}</p>}
              <button className="btn-link" onClick={() => setShowReport(false)}>Huỷ</button>
            </div>
          ) : (
            <button className="btn-link" style={{ fontSize: '.78rem', color: 'var(--muted)' }}
              onClick={() => setShowReport(true)}>
              Báo lỗi câu hỏi
            </button>
          )}
        </div>
      )}
      {reportSent && (
        <p style={{ padding: '0 1.25rem .5rem', fontSize: '.78rem', color: 'var(--success)' }}>
          ✓ {reportMessage}
        </p>
      )}

      {/* Footer actions */}
      <div className="ps-footer">
        {answered ? (
          isLast ? (
            <button className="btn-primary btn-lg" disabled={completing} onClick={() => void onComplete()}>
              {completing ? <Spinner /> : null} Kết thúc phiên
            </button>
          ) : (
            <button className="btn-primary btn-lg" onClick={onNext}>
              Câu tiếp theo →
            </button>
          )
        ) : (
          <button className="btn-secondary" style={{ width: '100%' }} disabled={completing}
            onClick={() => void onComplete()}>
            {completing ? <Spinner /> : null} Kết thúc sớm
          </button>
        )}
      </div>
    </div>
  );
}

// ─── PracticeResultScreen ─────────────────────────────────────────────────────

function PracticeResultScreen({
  result, onAgain, onHome,
}: {
  result: CompleteResult;
  onAgain: () => void;
  onHome: () => void;
}) {
  const pct = result.totalQuestions > 0 ? Math.round((result.score / result.totalQuestions) * 100) : 0;

  return (
    <div className="screen screen-center practice-result">
      <div className="result-card">
        <div className="result-icon">{pct >= 70 ? '🎉' : pct >= 40 ? '💪' : '📖'}</div>
        <h2 className="result-title">Kết quả phiên ôn tập</h2>

        <div className="result-score">
          <span className="rs-num">{result.score}</span>
          <span className="rs-denom">/{result.totalQuestions}</span>
        </div>

        <div className="result-pct" style={{ color: pct >= 70 ? 'var(--success)' : pct >= 40 ? '#d97706' : 'var(--danger)' }}>
          {pct}% chính xác
        </div>

        <div className="result-pts">
          +{result.pointsEarned} điểm tích lũy
        </div>

        <div className="result-btns">
          <button className="btn-secondary" onClick={onHome}>Về trang chủ</button>
          <button className="btn-primary" onClick={onAgain}>Ôn tiếp 📚</button>
        </div>
      </div>
    </div>
  );
}

// ─── ExamPage (Thi thử) ─────────────────────────────────────────────────────

function defaultAnswerFor(type: ExamQuestionType): ExamAnswerValue {
  if (type === 'TRUE_FALSE_4') return [];
  if (type === 'FILL_BLANK') return '';
  return -1;
}

/**
 * Chuyển giá trị "chưa trả lời" (mặc định từ defaultAnswerFor) thành
 * sentinel {} trước khi gửi lên server.
 * Backend dùng {} để phát hiện câu bỏ trắng và ẩn đáp án đúng.
 */
function toSubmitAnswer(type: ExamQuestionType, value: ExamAnswerValue): unknown {
  if (type === 'MCQ_4' && value === -1) return {};
  if (type === 'TRUE_FALSE_4' && Array.isArray(value) && value.length === 0) return {};
  if (type === 'FILL_BLANK' && value === '') return {};
  return value;
}

/** Hien thi mot dap an (da chon hoac dung) o man ket qua, theo dang cau hoi. */
function describeExamAnswer(type: ExamQuestionType, options: string[] | null, value: unknown): string {
  if (type === 'MCQ_4') {
    if (typeof value === 'number' && value >= 0 && value <= 3) {
      const text = options?.[value];
      return text ? `${OPTION_LABELS[value]}. ${text}` : OPTION_LABELS[value];
    }
    return 'Chưa trả lời';
  }
  if (type === 'TRUE_FALSE_4') {
    if (Array.isArray(value) && value.length === 4) {
      return value
        .map((v, idx) => `${OPTION_LABELS[idx]}: ${v === true ? 'Đúng' : v === false ? 'Sai' : 'Chưa trả lời'}`)
        .join(', ');
    }
    return 'Chưa trả lời';
  }
  // FILL_BLANK
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value) && value.length > 0) return value.join(' / ');
  return 'Chưa trả lời';
}

type ExamSub = 'hub' | 'session' | 'result';

interface ActiveExamSession {
  data: StartExamResult;
  answers: Map<string, ExamAnswerValue>;
}

function ExamPage({
  profile, sessionToken, onBack, onProfileUpdate, onError,
}: {
  profile: UserProfile;
  sessionToken: string;
  onBack: () => void;
  onProfileUpdate: (p: UserProfile) => void;
  onError: (e: unknown) => void;
}) {
  const [sub, setSub]           = useState<ExamSub>('hub');
  const [session, setSession]   = useState<ActiveExamSession | null>(null);
  const [result, setResult]     = useState<SubmitExamResult | null>(null);
  const [loadingSubj, setLoadingSubj] = useState('');
  const [hubError, setHubError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [submitting, setSubmitting]   = useState(false);

  async function handleStart(subject: string) {
    setLoadingSubj(subject);
    setHubError('');
    try {
      const data = await startExam(sessionToken, subject);
      setSession({ data, answers: new Map() });
      setSub('session');
      void getMyProfile(sessionToken).then(onProfileUpdate).catch(() => {});
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EXAM_INSUFFICIENT_POINTS') {
        setHubError('Bạn cần tối thiểu 60 điểm tích lũy để vào thi thử.');
      } else if (err instanceof ApiError && err.code === 'EXAM_PAPER_EMPTY') {
        setHubError('Môn học này hiện chưa có đề thi thử. Vui lòng thử lại sau.');
      } else if (err instanceof ApiError && err.code === 'EXAM_SESSION_ALREADY_ACTIVE') {
        setHubError('Bạn đang có phiên thi chưa hoàn thành. Hãy hoàn thành hoặc chờ hết giờ.');
      } else {
        onError(err);
      }
    } finally {
      setLoadingSubj('');
    }
  }

  function handleAnswerChange(qId: string, value: ExamAnswerValue) {
    setSession((s) => {
      if (!s) return s;
      const next = new Map(s.answers);
      next.set(qId, value);
      return { ...s, answers: next };
    });
  }

  async function handleSubmit() {
    if (!session || submitting) return;
    setSubmitting(true);
    setSessionError('');
    try {
      const answers = session.data.questions.map((q) => ({
        examQuestionId: q.id,
        selectedAnswer: toSubmitAnswer(
          q.questionType,
          session.answers.get(q.id) ?? defaultAnswerFor(q.questionType),
        ),
      }));
      const res = await submitExam(sessionToken, session.data.sessionId, answers);
      setResult(res);
      void getMyProfile(sessionToken).then(onProfileUpdate).catch(() => {});
      setSub('result');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EXAM_EXPIRED') {
        setResult({ sessionId: session.data.sessionId, score: 0, pointsAwarded: 0 });
        void getMyProfile(sessionToken).then(onProfileUpdate).catch(() => {});
        setSub('result');
        return;
      }
      if (err instanceof ApiError && err.code === 'EXAM_SUBMIT_TOO_EARLY') {
        // Tính thời gian còn thiếu từ phía client (tránh dùng err.message không dấu từ server)
        const elapsedSec = (Date.now() - new Date(session.data.startedAt).getTime()) / 1000;
        const minRequiredSec = session.data.durationMinutes * 60 * 0.3;
        const remainingMin = Math.max(1, Math.ceil((minRequiredSec - elapsedSec) / 60));
        setSessionError(`Bạn cần làm bài thêm ít nhất ${remainingMin} phút nữa mới được nộp.`);
        return;
      }
      onError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (sub === 'session' && session) {
    return (
      <ExamSessionScreen
        session={session}
        onAnswerChange={handleAnswerChange}
        onSubmit={() => void handleSubmit()}
        submitting={submitting}
        submitError={sessionError}
        onClearSubmitError={() => setSessionError('')}
      />
    );
  }

  if (sub === 'result' && result) {
    return (
      <ExamResultScreen
        sessionToken={sessionToken}
        result={result}
        onHome={onBack}
        onRetry={() => { setResult(null); setSession(null); setSub('hub'); }}
      />
    );
  }

  // Hub
  const subjects = profile.subjects;

  return (
    <div className="screen practice-hub">
      <div className="practice-hub-header">
        <button className="btn-icon-back" onClick={onBack}>←</button>
        <h2 className="page-title" style={{ flex: 1 }}>Thi thử</h2>
      </div>

      {hubError && <p className="report-error admin-msg">{hubError}</p>}

      <div className="practice-subjects">
        {subjects.map((s) => {
          const info = SUBJECTS_MAP[s.id] ?? { name: s.name, emoji: '📘' };
          const busy = loadingSubj === s.id;
          return (
            <button
              key={s.id}
              className="practice-subject-card"
              onClick={() => void handleStart(s.id)}
              disabled={!!loadingSubj}
            >
              <span className="ps-emoji">{info.emoji}</span>
              <div className="ps-info">
                <span className="ps-name">{info.name}</span>
                <span className="ps-stat">Đề thi thử có tính thời gian</span>
              </div>
              {busy ? <Spinner /> : <span className="ps-arrow">▶</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── ExamSessionScreen ──────────────────────────────────────────────────────

function ExamSessionScreen({
  session, onAnswerChange, onSubmit, submitting, submitError, onClearSubmitError,
}: {
  session: ActiveExamSession;
  onAnswerChange: (qId: string, value: ExamAnswerValue) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError?: string;
  onClearSubmitError?: () => void;
}) {
  const { data, answers } = session;

  const [timeLeft, setTimeLeft] = useState(() => {
    const startedAt = new Date(data.startedAt).getTime();
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    return Math.max(0, data.durationMinutes * 60 - elapsed);
  });

  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(id); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (timeLeft === 0 && !autoSubmitted.current && !submitting) {
      autoSubmitted.current = true;
      onSubmit();
    }
  }, [timeLeft, submitting, onSubmit]);

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const timerDanger = timeLeft < 60;

  return (
    <div className="screen practice-session">
      <div className="ps-topbar">
        <span className="ps-progress-text">{data.title}</span>
        <span className={`ps-timer ${timerDanger ? 'danger' : ''}`}>{mins}:{secs}</span>
      </div>

      <div className="exam-question-list">
        {data.questions.map((q, idx) => (
          <ExamQuestionCard
            key={q.id}
            index={idx}
            question={q}
            value={answers.get(q.id) ?? defaultAnswerFor(q.questionType)}
            onChange={(value) => onAnswerChange(q.id, value)}
          />
        ))}
      </div>

      <div className="ps-footer">
        {submitError && (
          <div
            className="exam-submit-error"
            role="alert"
            onClick={onClearSubmitError}
            style={{ cursor: 'pointer', marginBottom: '0.5rem', padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.5rem', color: '#b91c1c', fontSize: '0.875rem', textAlign: 'center' }}
          >
            ⏱ {submitError}
          </div>
        )}
        <button className="btn-primary btn-lg" disabled={submitting} onClick={onSubmit}>
          {submitting ? <Spinner /> : null} Nộp bài
        </button>
      </div>
    </div>
  );
}

// ─── ExamQuestionCard ───────────────────────────────────────────────────────

function ExamQuestionCard({
  index, question, value, onChange,
}: {
  index: number;
  question: ExamQuestionPublic;
  value: ExamAnswerValue;
  onChange: (value: ExamAnswerValue) => void;
}) {
  const tfValue = Array.isArray(value) ? value : [];

  function setTrueFalse(idx: number, val: boolean) {
    const next = [0, 1, 2, 3].map((i) => (i === idx ? val : tfValue[i] ?? null));
    onChange(next);
  }

  return (
    <div className="exam-question-card">
      <div className="exam-question-head">
        <span className="exam-question-num">Câu {index + 1}</span>
        <span className={`diff-badge diff-${question.difficulty}`}>
          {DIFF_LABEL[question.difficulty] ?? 'N/A'}
        </span>
        {question.chapter && <span className="exam-chapter-tag">{question.chapter}</span>}
      </div>

      <p className="exam-question-text">{question.questionText}</p>

      {question.questionType === 'MCQ_4' && question.options && (
        <div className="ps-options">
          {question.options.map((opt, idx) => (
            <button
              key={idx}
              className={`ps-option ${value === idx ? 'selected' : ''}`}
              onClick={() => onChange(idx)}
            >
              <span className="opt-label">{OPTION_LABELS[idx]}</span>
              <span className="opt-text">{opt}</span>
            </button>
          ))}
        </div>
      )}

      {question.questionType === 'TRUE_FALSE_4' && question.options && (
        <div className="exam-tf-list">
          {question.options.map((stmt, idx) => {
            const current = tfValue[idx];
            return (
              <div key={idx} className="exam-tf-row">
                <span className="exam-tf-text">{OPTION_LABELS[idx]}. {stmt}</span>
                <div className="exam-tf-toggle">
                  <button
                    className={`exam-tf-btn ${current === true ? 'active-true' : ''}`}
                    onClick={() => setTrueFalse(idx, true)}
                  >
                    Đúng
                  </button>
                  <button
                    className={`exam-tf-btn ${current === false ? 'active-false' : ''}`}
                    onClick={() => setTrueFalse(idx, false)}
                  >
                    Sai
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {question.questionType === 'FILL_BLANK' && (
        <input
          className="field-input"
          value={typeof value === 'string' ? value : ''}
          placeholder="Nhập câu trả lời…"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

// ─── ExamResultScreen ───────────────────────────────────────────────────────

function ExamResultScreen({
  sessionToken, result, onHome, onRetry,
}: {
  sessionToken: string;
  result: SubmitExamResult;
  onHome: () => void;
  onRetry: () => void;
}) {
  const [detail, setDetail]   = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getExamResult(sessionToken, result.sessionId)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionToken, result.sessionId]);

  const icon = result.score >= 8 ? '🎉' : result.score >= 5 ? '💪' : '📖';

  return (
    <div className="screen exam-result">
      <div className="exam-result-header">
        <h2 className="page-title">Kết quả thi thử</h2>
      </div>

      <div className="exam-score-card">
        <div className="result-icon">{icon}</div>
        <div className="result-score">
          <span className="rs-num">{result.score.toFixed(1)}</span>
          <span className="rs-denom">/10</span>
        </div>
        {result.pointsAwarded > 0 && (
          <div className="result-pts">+{result.pointsAwarded} điểm thưởng</div>
        )}
      </div>

      {loading ? (
        <div className="screen-center"><Spinner /></div>
      ) : detail && (
        <>
          {detail.status === 'EXPIRED' && (
            <p className="report-error admin-msg">⏰ Đã hết thời gian làm bài trước khi nộp.</p>
          )}

          {detail.chapterAnalysis.length > 0 && (
            <section className="card-section">
              <h3 className="section-title" style={{ marginBottom: '.75rem' }}>Phân tích theo chương</h3>
              {detail.chapterAnalysis.map((c) => (
                <div key={c.chapter} className="exam-chapter-row">
                  <span className="exam-chapter-name">{c.chapter}</span>
                  <span className="exam-chapter-stat">{c.correctCount}/{c.totalCount} câu đúng</span>
                  <span className="exam-chapter-pts">{c.pointsEarned}/{c.pointsTotal} điểm</span>
                </div>
              ))}
            </section>
          )}

          {detail.wrongAnswers.length > 0 && (
            <section className="card-section">
              <h3 className="section-title" style={{ marginBottom: '.75rem' }}>
                Câu chưa đúng ({detail.wrongAnswers.length})
              </h3>
              {detail.wrongAnswers.map((w) => (
                <div key={w.examQuestionId} className="exam-wrong-card">
                  {w.chapter && <span className="exam-chapter-tag">{w.chapter}</span>}
                  <p className="exam-question-text">{w.questionText}</p>
                  {/* Bug 1b: correctAnswer = null → câu bỏ trắng, không lộ đáp án */}
                  {w.correctAnswer === null ? (
                    <p className="exam-wrong-line" style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                      Bạn chưa trả lời câu này
                    </p>
                  ) : (
                    <>
                      <p className="exam-wrong-line">
                        <strong>Bạn chọn:</strong> {describeExamAnswer(w.questionType, w.options, w.selectedAnswer)}
                      </p>
                      <p className="exam-wrong-line correct">
                        <strong>Đáp án đúng:</strong> {describeExamAnswer(w.questionType, w.options, w.correctAnswer)}
                      </p>
                    </>
                  )}
                  {w.explanation && <p className="fb-explain">{w.explanation}</p>}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      <div className="result-btns" style={{ margin: '0 1.25rem 1rem' }}>
        <button className="btn-secondary" onClick={onHome}>Về trang chủ</button>
        <button className="btn-primary" onClick={onRetry}>Thi tiếp 🎯</button>
      </div>
    </div>
  );
}

// ─── LeaderboardPage ─────────────────────────────────────────────────────────

const TREND_ICON: Record<string, string> = {
  up: '↑', down: '↓', same: '→', new: '—',
};
const TREND_COLOR: Record<string, string> = {
  up: '#22c55e', down: '#ef4444', same: '#94a3b8', new: '#94a3b8',
};

function AvatarCell({ avatarUrl, name, size = 40 }: { avatarUrl: string | null; name: string | null; size?: number }) {
  const initials = (name ?? '?').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  const colors = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444'];
  const color  = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return avatarUrl ? (
    <img src={avatarUrl} alt={name ?? ''} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function LeaderboardPage({
  profile, sessionToken, onBack, onError,
}: {
  profile: UserProfile;
  sessionToken: string;
  onBack: () => void;
  onError: (e: unknown) => void;
}) {
  const [subject, setSubject]       = useState('');
  const [page, setPage]             = useState(1);
  const [entries, setEntries]       = useState<LeaderboardEntry[]>([]);
  const [total, setTotal]           = useState(0);
  const [myRank, setMyRank]         = useState<MyRankResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [loadMore, setLoadMore]     = useState(false);
  const [selected, setSelected]     = useState<LeaderboardEntry | null>(null);
  async function fetchLeaderboard(p: number, subj: string, append: boolean) {
    if (p === 1) setLoading(true); else setLoadMore(true);
    try {
      const [lb, me] = await Promise.all([
        getLeaderboard(sessionToken, p, subj || undefined),
        p === 1 ? getMyLeaderboardRank(sessionToken, subj || undefined) : Promise.resolve(null),
      ]);
      if (append) {
        setEntries((prev) => [...prev, ...lb.data]);
      } else {
        setEntries(lb.data);
      }
      setTotal(lb.total);
      if (me !== null) setMyRank(me);
    } catch (err) { onError(err); }
    finally { setLoading(false); setLoadMore(false); }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    setEntries([]);
    void fetchLeaderboard(1, subject, false);
  }, [subject]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchLeaderboard(nextPage, subject, true);
  }

  const top3    = entries.slice(0, 3);
  const rest    = entries.slice(3);
  const hasMore = entries.length < total;
  // Ẩn thanh ghim khi entry của bản thân đã xuất hiện trong danh sách đã load
  const myEntryLoaded = entries.some((e) => e.userId === profile.id);

  // Podium order: [1] center top, [0] left, [2] right
  const podiumOrder = [top3[1], top3[0], top3[2]] as (LeaderboardEntry | undefined)[];
  const podiumHeight = ['52px', '80px', '36px'];

  return (
    <div className="screen" style={{ background: 'linear-gradient(160deg,#0f0c29,#302b63,#24243e)', minHeight: '100vh', color: '#fff', paddingBottom: '80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '1rem 1.25rem .5rem' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', padding: 0 }}>←</button>
        <h2 style={{ flex: 1, margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>🏆 Bảng Xếp Hạng</h2>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={{ padding: '.35rem .6rem', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', fontSize: '.85rem' }}
        >
          <option value="">Tất cả môn</option>
          {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Spinner /></div>
      ) : entries.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '3rem', opacity: .6 }}>Chưa có dữ liệu xếp hạng</p>
      ) : (
        <>
          {/* ── Podium Top 3 ─────────────────────────────── */}
          {top3.length >= 1 && (
            <div style={{ padding: '1.5rem 1.25rem 1rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '1rem' }}>
              {podiumOrder.map((entry, idx) => {
                if (!entry) return <div key={idx} style={{ flex: 1 }} />;
                const isFirst = entry.rank === 1;
                const medals = ['🥈', '🥇', '🥉'];
                return (
                  <div key={entry.userId} onClick={() => setSelected(entry)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.4rem', cursor: 'pointer' }}>
                    {isFirst && (
                      <div style={{ fontSize: '1.6rem', animation: 'pulse 2s infinite' }}>👑</div>
                    )}
                    <div style={{ position: 'relative' }}>
                      <AvatarCell avatarUrl={entry.avatarUrl} name={entry.displayName} size={isFirst ? 72 : 56} />
                      <span style={{ position: 'absolute', bottom: -6, right: -6, fontSize: isFirst ? '1.4rem' : '1.1rem' }}>{medals[idx]}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '.78rem', fontWeight: 600, textAlign: 'center', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.displayName ?? 'Ẩn danh'}
                    </p>
                    <p style={{ margin: 0, fontSize: '.85rem', fontWeight: 700, color: '#fbbf24' }}>{entry.reputationScore.toFixed(1)}</p>
                    {/* Bục podium */}
                    <div style={{ width: '100%', height: podiumHeight[idx], background: isFirst ? 'linear-gradient(180deg,#f6d365,#fda085)' : 'rgba(255,255,255,.15)', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', color: isFirst ? '#333' : '#fff' }}>
                      {entry.rank}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Danh sách hạng 4+ ───────────────────────── */}
          {rest.length > 0 && (
            <div style={{ margin: '0 1rem', background: 'rgba(255,255,255,.06)', borderRadius: '16px', overflow: 'hidden' }}>
              {rest.map((entry, i) => {
                const isMe = entry.userId === profile.id;
                return (
                  <div key={entry.userId} onClick={() => setSelected(entry)} style={{
                    display: 'flex', alignItems: 'center', gap: '.75rem',
                    padding: '.7rem 1rem',
                    background: isMe ? 'rgba(251,191,36,.15)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.03)',
                    borderBottom: '1px solid rgba(255,255,255,.05)',
                    cursor: 'pointer',
                  }}>
                    <span style={{ width: '28px', textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: '.9rem' }}>{entry.rank}</span>
                    <AvatarCell avatarUrl={entry.avatarUrl} name={entry.displayName} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: isMe ? 700 : 500, fontSize: '.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.displayName ?? 'Ẩn danh'}{isMe && ' (Bạn)'}
                      </p>
                      <p style={{ margin: 0, fontSize: '.75rem', color: '#94a3b8' }}>
                        TB: {entry.avgScore.toFixed(1)} · {entry.examCount} lần thi
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#fbbf24', fontSize: '.95rem' }}>{entry.reputationScore.toFixed(1)}</p>
                      <span style={{ fontSize: '1rem', color: TREND_COLOR[entry.trend] }}>{TREND_ICON[entry.trend] ?? '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Nút xem thêm */}
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                onClick={() => void handleLoadMore()}
                disabled={loadMore}
                style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', padding: '.6rem 1.5rem', borderRadius: '24px', cursor: 'pointer', fontSize: '.9rem' }}
              >
                {loadMore ? <Spinner /> : `Xem thêm (${total - entries.length} người)`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Modal thông tin người dùng ───────────────── */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'linear-gradient(135deg,#302b63,#24243e)', borderRadius: '20px', padding: '1.5rem', width: '100%', maxWidth: '320px', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
              <AvatarCell avatarUrl={selected.avatarUrl} name={selected.displayName} size={56} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>{selected.displayName ?? 'Ẩn danh'}</p>
                <p style={{ margin: 0, fontSize: '.85rem', color: '#fbbf24', fontWeight: 600 }}>Hạng #{selected.rank}</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '1.2rem' }}>
              {[
                { label: 'Điểm Uy Tín', value: selected.reputationScore.toFixed(2) },
                { label: 'Điểm TB', value: selected.avgScore.toFixed(2) },
                { label: 'Số lần thi', value: `${selected.examCount} lần` },
                { label: 'Xu hướng', value: `${TREND_ICON[selected.trend] ?? '—'} ${selected.trend === 'up' ? 'Tăng' : selected.trend === 'down' ? 'Giảm' : selected.trend === 'new' ? 'Mới' : 'Ổn định'}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,.08)', borderRadius: '12px', padding: '.75rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '.72rem', color: '#94a3b8', marginBottom: '.25rem' }}>{label}</p>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>{value}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setSelected(null)} style={{ width: '100%', padding: '.7rem', borderRadius: '12px', border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '.9rem' }}>
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ── Thanh ghim hạng của tôi ───────────────────── */}
      {myRank !== null && !myEntryLoaded && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(90deg,#302b63,#0f0c29)',
          borderTop: '1px solid rgba(255,255,255,.15)',
          padding: '.75rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
        }}>
          <AvatarCell avatarUrl={profile.avatarUrl} name={profile.displayName} size={40} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '.9rem' }}>{profile.displayName ?? 'Bạn'}</p>
            {myRank.rank !== null ? (
              <p style={{ margin: 0, fontSize: '.78rem', color: '#94a3b8' }}>
                Hạng #{myRank.rank} · TB: {myRank.avgScore?.toFixed(1)} · {myRank.examCount} lần thi
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '.78rem', color: '#94a3b8' }}>Chưa có dữ liệu xếp hạng</p>
            )}
          </div>
          {myRank.rank !== null && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#fbbf24' }}>{myRank.reputationScore?.toFixed(1)}</p>
              {myRank.trend && (
                <span style={{ fontSize: '1rem', color: TREND_COLOR[myRank.trend] }}>{TREND_ICON[myRank.trend]}</span>
              )}
            </div>
          )}
        </div>
      )}
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

// ─── Admin: Quan ly bao cao cau hoi ────────────────────────────────────────────

const ADMIN_PAGE_SIZE = 20;
const ADMIN_REPORT_STATUSES: ReportStatus[] = ['PENDING', 'REVIEWED', 'FIXED', 'DISMISSED'];

const REPORT_STATUS_LABEL: Record<string, string> = {
  PENDING:   'Chờ xử lý',
  REVIEWED:  'Đã xem',
  FIXED:     'Đã sửa',
  DISMISSED: 'Đã bỏ qua',
};

const REPORT_REASON_LABEL: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.value, r.label]),
);

type AdminTab = 'dashboard' | 'users' | 'reports' | 'exams' | 'bank';

function AdminPage() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem('adminSecret') ?? '');
  const [tab, setTab] = useState<AdminTab>('dashboard');

  function handleLoginSuccess(value: string) {
    sessionStorage.setItem('adminSecret', value);
    setSecret(value);
  }

  function handleLogout() {
    sessionStorage.removeItem('adminSecret');
    setSecret('');
  }

  if (!secret) {
    return <AdminLoginPage onSuccess={handleLoginSuccess} />;
  }

  return (
    <div>
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          📊 Dashboard
        </button>
        <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          👥 Người dùng
        </button>
        <button className={`admin-tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
          Báo cáo câu hỏi
        </button>
        <button className={`admin-tab ${tab === 'exams' ? 'active' : ''}`} onClick={() => setTab('exams')}>
          Đề thi thử
        </button>
        <button className={`admin-tab ${tab === 'bank' ? 'active' : ''}`} onClick={() => setTab('bank')}>
          Ngân hàng câu hỏi
        </button>
        <button className="btn-link admin-tab-logout" onClick={handleLogout}>
          Đăng xuất
        </button>
      </div>
      {tab === 'dashboard' && <AdminDashboardPage secret={secret} onLogout={handleLogout} />}
      {tab === 'users'     && <AdminUsersPage secret={secret} onLogout={handleLogout} />}
      {tab === 'reports'   && <AdminReportsPage secret={secret} onLogout={handleLogout} />}
      {tab === 'exams'     && <AdminExamPage secret={secret} onLogout={handleLogout} />}
      {tab === 'bank'      && <AdminQuestionBankPage secret={secret} onLogout={handleLogout} />}
    </div>
  );
}

// ─── AdminLoginPage ─────────────────────────────────────────────────────────────

function AdminLoginPage({ onSuccess }: { onSuccess: (secret: string) => void }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    const value = input.trim();
    if (!value || busy) return;
    setBusy(true);
    setError('');
    try {
      await adminGetReportsSummary(value);
      onSuccess(value);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError('Mã bí mật không đúng.');
      } else {
        setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen screen-center screen-login">
      <div className="login-card">
        <div className="brand">
          <div className="brand-icon">A</div>
          <h1 className="brand-name">QuizzGame Admin</h1>
          <p className="brand-sub">Quản lý báo cáo câu hỏi</p>
        </div>

        <hr className="divider" />

        <p className="login-headline">Đăng nhập quản trị</p>
        <label className="form-field">
          <span className="field-label">Mã bí mật (Admin Secret)</span>
          <input
            className="field-input"
            type="password"
            value={input}
            placeholder="Nhập mã bí mật"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
          />
        </label>

        {error && <p className="report-error">{error}</p>}

        <button className="btn-primary btn-lg" disabled={busy || !input.trim()} onClick={() => void handleSubmit()}>
          {busy && <Spinner />}{busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
        </button>
      </div>
    </div>
  );
}

// ─── AdminReportsPage ───────────────────────────────────────────────────────────

function AdminReportsPage({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [items, setItems] = useState<QuestionReportDto[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [s, r] = await Promise.all([
        adminGetReportsSummary(secret),
        adminListReports(secret, { status: statusFilter || undefined, page, limit: ADMIN_PAGE_SIZE }),
      ]);
      setSummary(s);
      setItems(r.items);
      setTotal(r.total);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- load() goi API va setState de dong bo voi statusFilter/page
  useEffect(() => { void load(); }, [statusFilter, page]);

  async function handleStatusChange(reportId: string, status: ReportStatus) {
    setBusyId(reportId);
    setNotice('');
    try {
      const result = await adminUpdateReportStatus(secret, reportId, status);
      if (result.autoHidden) setNotice('Câu hỏi liên quan đã bị tự động ẩn do vượt ngưỡng báo cáo.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusyId('');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <div className="screen screen-admin">
      <div className="admin-header">
        <h2 className="page-title">Quản lý báo cáo câu hỏi</h2>
        <button className="btn-link" onClick={onLogout}>Đăng xuất</button>
      </div>

      {summary && (
        <div className="admin-stats">
          <div className="admin-stat-card">
            <span className="admin-stat-num">{summary.pending}</span>
            <span className="admin-stat-label">Chờ xử lý</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-num">{summary.reviewed}</span>
            <span className="admin-stat-label">Đã xem</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-num">{summary.fixed}</span>
            <span className="admin-stat-label">Đã sửa</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-num">{summary.dismissed}</span>
            <span className="admin-stat-label">Đã bỏ qua</span>
          </div>
        </div>
      )}

      <div className="admin-filter">
        <select
          className="field-input"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tất cả trạng thái</option>
          {ADMIN_REPORT_STATUSES.map((s) => (
            <option key={s} value={s}>{REPORT_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {error && <p className="report-error admin-msg">{error}</p>}
      {notice && <p className="admin-notice admin-msg">{notice}</p>}

      {loading ? (
        <div className="screen-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="empty admin-msg">Không có báo cáo nào.</p>
      ) : (
        <div className="admin-report-list">
          {items.map((r) => (
            <div key={r.id} className="admin-report-row">
              <div className="admin-report-top">
                <span className={`admin-status-badge status-${r.status.toLowerCase()}`}>
                  {REPORT_STATUS_LABEL[r.status] ?? r.status}
                </span>
                <span className="admin-report-reason">{REPORT_REASON_LABEL[r.reason] ?? r.reason}</span>
              </div>
              <p className="admin-report-q">Câu hỏi: <code>{r.questionId}</code></p>
              {r.description && <p className="admin-report-desc">{r.description}</p>}
              <p className="admin-report-time">{new Date(r.createdAt).toLocaleString('vi-VN')}</p>
              <div className="admin-report-actions">
                <button className="btn-secondary" disabled={busyId === r.id || r.status === 'REVIEWED'}
                  onClick={() => void handleStatusChange(r.id, 'REVIEWED')}>Đã xem</button>
                <button className="btn-secondary" disabled={busyId === r.id || r.status === 'FIXED'}
                  onClick={() => void handleStatusChange(r.id, 'FIXED')}>Đã sửa</button>
                <button className="btn-secondary" disabled={busyId === r.id || r.status === 'DISMISSED'}
                  onClick={() => void handleStatusChange(r.id, 'DISMISSED')}>Bỏ qua</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</button>
          <span>Trang {page}/{totalPages}</span>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau →</button>
        </div>
      )}
    </div>
  );
}

// ─── Admin: Quan ly de thi thu ─────────────────────────────────────────────────

const QUESTION_TYPE_LABEL: Record<ExamQuestionType, string> = {
  MCQ_4: 'Trắc nghiệm 4 đáp án',
  TRUE_FALSE_4: 'Đúng/Sai 4 ý',
  FILL_BLANK: 'Điền đáp án',
};

type AdminExamSub = 'list' | 'detail';

function AdminExamPage({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [sub, setSub] = useState<AdminExamSub>('list');
  const [selectedId, setSelectedId] = useState('');

  if (sub === 'detail' && selectedId) {
    return (
      <AdminExamPaperDetailPage
        secret={secret}
        paperId={selectedId}
        onBack={() => { setSub('list'); setSelectedId(''); }}
        onLogout={onLogout}
      />
    );
  }

  return (
    <AdminExamPaperListPage
      secret={secret}
      onSelect={(id) => { setSelectedId(id); setSub('detail'); }}
      onLogout={onLogout}
    />
  );
}

// ─── AdminExamPaperListPage ────────────────────────────────────────────────────

function AdminExamPaperListPage({
  secret, onSelect, onLogout,
}: {
  secret: string;
  onSelect: (id: string) => void;
  onLogout: () => void;
}) {
  const [papers, setPapers] = useState<ExamPaperSummary[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ subject: SUBJECTS[0].id, title: '', durationMinutes: 50 });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await adminListExamPapers(secret, subjectFilter || undefined);
      setPapers(data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- load() goi API va setState de dong bo voi subjectFilter
  useEffect(() => { void load(); }, [subjectFilter]);

  async function handleCreate() {
    if (creating) return;
    if (!form.title.trim()) {
      setCreateError('Vui lòng nhập tên đề thi.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await adminCreateExamPaper(secret, {
        subject: form.subject,
        title: form.title.trim(),
        durationMinutes: form.durationMinutes,
      });
      setForm((f) => ({ ...f, title: '' }));
      setShowCreate(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="screen screen-admin">
      <div className="admin-header">
        <h2 className="page-title">Quản lý đề thi thử</h2>
        <button className="btn-link" onClick={onLogout}>Đăng xuất</button>
      </div>

      <div className="admin-filter">
        <select className="field-input" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="">Tất cả môn học</option>
          {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {error && <p className="report-error admin-msg">{error}</p>}

      <div className="admin-msg">
        <button className="btn-secondary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Đóng' : '+ Tạo đề thi mới'}
        </button>
      </div>

      {showCreate && (
        <section className="card-section">
          <h3 className="section-title" style={{ marginBottom: '.75rem' }}>Tạo đề thi mới</h3>
          <div className="edit-form">
            <label className="form-field">
              <span className="field-label">Môn học</span>
              <select className="field-input" value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}>
                {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">Tên đề thi</span>
              <input className="field-input" value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Đề thi thử THPT QG 2024 - Mã đề 101" />
            </label>
            <label className="form-field">
              <span className="field-label">Thời gian làm bài (phút)</span>
              <input className="field-input" type="number" min={1} value={form.durationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))} />
            </label>
            {createError && <p className="report-error">{createError}</p>}
            <button className="btn-primary" disabled={creating} onClick={() => void handleCreate()}>
              {creating && <Spinner />}{creating ? 'Đang tạo…' : 'Tạo đề thi'}
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <div className="screen-center"><Spinner /></div>
      ) : papers.length === 0 ? (
        <p className="empty admin-msg">Chưa có đề thi nào.</p>
      ) : (
        <div className="admin-report-list">
          {papers.map((p) => (
            <button key={p.id} className="admin-exam-card" onClick={() => onSelect(p.id)}>
              <div className="admin-exam-card-top">
                <span className="admin-exam-subject">{SUBJECTS_MAP[p.subject]?.name ?? p.subject}</span>
                <span className={`admin-status-badge ${p.isActive ? 'status-fixed' : 'status-dismissed'}`}>
                  {p.isActive ? 'Đang hoạt động' : 'Tạm ẩn'}
                </span>
              </div>
              <p className="admin-exam-title">{p.title}</p>
              <p className="admin-exam-meta">{p.questionCount} câu hỏi · {p.durationMinutes} phút</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AdminExamPaperDetailPage ──────────────────────────────────────────────────

function AdminExamPaperDetailPage({
  secret, paperId, onBack, onLogout,
}: {
  secret: string;
  paperId: string;
  onBack: () => void;
  onLogout: () => void;
}) {
  const [paper, setPaper] = useState<ExamPaperDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState({
    points: 0.25, difficulty: 1, chapter: '', questionText: '',
    options: ['', '', '', ''], mcqCorrect: 0,
    tfCorrect: [true, true, true, true] as boolean[],
    fillAnswers: '', explanation: '',
    questionType: 'MCQ_4' as ExamQuestionType,
  });
  const [editError, setEditError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await adminGetExamPaperDetail(secret, paperId);
      setPaper(data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- load() goi API va setState de dong bo voi paperId
  useEffect(() => { void load(); }, [paperId]);

  async function handleToggleActive() {
    if (!paper || busy) return;
    setBusy(true);
    setError('');
    try {
      await adminUpdateExamPaper(secret, paper.id, { isActive: !paper.isActive });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteQuestion(qid: string) {
    if (!paper || busy) return;
    setBusy(true);
    setError('');
    try {
      await adminDeleteExamQuestion(secret, paper.id, qid);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreQuestion(qid: string) {
    if (!paper || busy) return;
    setBusy(true);
    setError('');
    try {
      await adminRestoreExamQuestion(secret, paper.id, qid);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(q: ExamPaperDetail['questions'][number]) {
    const mcqCorrect = q.questionType === 'MCQ_4' && typeof q.correctAnswer === 'number' ? q.correctAnswer : 0;
    const tfCorrect = q.questionType === 'TRUE_FALSE_4' && Array.isArray(q.correctAnswer) && q.correctAnswer.length === 4
      ? (q.correctAnswer as boolean[])
      : [true, true, true, true];
    const fillAnswers = q.questionType === 'FILL_BLANK' && Array.isArray(q.correctAnswer)
      ? (q.correctAnswer as string[]).join(' | ')
      : typeof q.correctAnswer === 'string' ? q.correctAnswer : '';
    setEditingId(q.id);
    setEditForm({
      points: q.points,
      difficulty: q.difficulty,
      chapter: q.chapter ?? '',
      questionText: q.questionText,
      options: (q.options && q.options.length === 4) ? [...q.options] : ['', '', '', ''],
      mcqCorrect,
      tfCorrect,
      fillAnswers,
      explanation: q.explanation ?? '',
      questionType: q.questionType,
    });
    setEditError('');
  }

  async function handleUpdateQuestion() {
    if (!paper || busy || !editingId) return;
    setBusy(true);
    setEditError('');
    try {
      const base = {
        points: editForm.points,
        difficulty: editForm.difficulty,
        chapter: editForm.chapter.trim() || undefined,
        questionText: editForm.questionText.trim(),
        explanation: editForm.explanation.trim() || undefined,
      };
      let correctAnswer: number | boolean[] | string[];
      let options: string[] | undefined;
      if (editForm.questionType === 'MCQ_4') {
        options = editForm.options.map((o) => o.trim());
        correctAnswer = editForm.mcqCorrect;
      } else if (editForm.questionType === 'TRUE_FALSE_4') {
        options = editForm.options.map((o) => o.trim());
        correctAnswer = editForm.tfCorrect;
      } else {
        correctAnswer = editForm.fillAnswers.split('|').map((a) => a.trim()).filter(Boolean);
      }
      await adminUpdateExamQuestion(secret, paper.id, editingId, { ...base, options, correctAnswer });
      setEditingId('');
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="screen screen-center"><Spinner /></div>;
  }

  if (!paper) {
    return (
      <div className="screen screen-admin">
        <div className="admin-header">
          <button className="btn-link" onClick={onBack}>← Quay lại</button>
          <button className="btn-link" onClick={onLogout}>Đăng xuất</button>
        </div>
        {error && <p className="report-error admin-msg">{error}</p>}
      </div>
    );
  }

  return (
    <div className="screen screen-admin">
      <div className="admin-header">
        <button className="btn-link" onClick={onBack}>← Quay lại</button>
        <button className="btn-link" onClick={onLogout}>Đăng xuất</button>
      </div>

      <section className="card-section">
        <h2 className="page-title" style={{ marginBottom: '.25rem' }}>{paper.title}</h2>
        <p className="admin-exam-meta">
          {SUBJECTS_MAP[paper.subject]?.name ?? paper.subject} · {paper.durationMinutes} phút · {paper.questions.filter((q) => q.isActive).length} câu hỏi active ({paper.questions.length} tổng)
        </p>
        <div className="admin-exam-toggle">
          <span>Trạng thái: {paper.isActive ? 'Đang hoạt động' : 'Tạm ẩn'}</span>
          <button className="btn-secondary" disabled={busy} onClick={() => void handleToggleActive()}>
            {paper.isActive ? 'Tạm ẩn' : 'Kích hoạt'}
          </button>
        </div>
      </section>

      {error && <p className="report-error admin-msg">{error}</p>}

      <AdminExamImportBox secret={secret} paperId={paper.id} onDone={() => void load()} />

      <AdminFromBankModal
        secret={secret}
        paperId={paper.id}
        paperSubject={paper.subject}
        onDone={() => void load()}
      />

      <AdminAutoFillBox secret={secret} paperId={paper.id} onDone={() => void load()} />

      <section className="card-section">
        <h3 className="section-title" style={{ marginBottom: '.75rem' }}>
          Danh sách câu hỏi ({paper.questions.filter((q) => q.isActive).length} active · {paper.questions.length} tổng)
        </h3>
        {paper.questions.length === 0 ? (
          <p className="empty">Chưa có câu hỏi nào.</p>
        ) : (
          <div className="admin-exam-question-list">
            {paper.questions.map((q, idx) => (
              <div key={q.id} className="admin-exam-question-row" style={!q.isActive ? { opacity: 0.5, background: 'var(--cream)' } : {}}>
                <div className="admin-exam-question-head">
                  <span className="exam-question-num">Câu {idx + 1}</span>
                  <span className={`diff-badge diff-${q.difficulty}`}>{DIFF_LABEL[q.difficulty] ?? 'N/A'}</span>
                  <span className="admin-exam-qtype">{QUESTION_TYPE_LABEL[q.questionType]}</span>
                  {!q.isActive && (
                    <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#fff', background: '#718096', borderRadius: '100px', padding: '.15rem .625rem' }}>
                      ẨN
                    </span>
                  )}
                </div>
                <p className="exam-question-text">{q.questionText}</p>
                {editingId === q.id ? (
                  <div className="edit-form" style={{ marginTop: '.75rem' }}>
                    <label className="form-field">
                      <span className="field-label">Nội dung câu hỏi</span>
                      <textarea className="report-desc" style={{ minHeight: '3rem' }}
                        value={editForm.questionText}
                        onChange={(e) => setEditForm((f) => ({ ...f, questionText: e.target.value }))} />
                    </label>

                    {(editForm.questionType === 'MCQ_4' || editForm.questionType === 'TRUE_FALSE_4') && (
                      <div className="form-field">
                        <span className="field-label">
                          {editForm.questionType === 'MCQ_4' ? '4 lựa chọn' : '4 phát biểu'}
                        </span>
                        {editForm.options.map((opt, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.4rem' }}>
                            {editForm.questionType === 'MCQ_4' ? (
                              <input type="radio" name={`mcq-edit-${editingId}`} checked={editForm.mcqCorrect === idx}
                                onChange={() => setEditForm((f) => ({ ...f, mcqCorrect: idx }))} />
                            ) : (
                              <select className="field-input" style={{ width: '90px', flexShrink: 0 }}
                                value={editForm.tfCorrect[idx] ? 'true' : 'false'}
                                onChange={(e) => setEditForm((f) => {
                                  const next = [...f.tfCorrect];
                                  next[idx] = e.target.value === 'true';
                                  return { ...f, tfCorrect: next };
                                })}>
                                <option value="true">Đúng</option>
                                <option value="false">Sai</option>
                              </select>
                            )}
                            <span style={{ fontWeight: 600, minWidth: '1.2rem' }}>{OPTION_LABELS[idx]}.</span>
                            <input className="field-input" value={opt}
                              onChange={(e) => setEditForm((f) => {
                                const next = [...f.options];
                                next[idx] = e.target.value;
                                return { ...f, options: next };
                              })} />
                          </div>
                        ))}
                        {editForm.questionType === 'MCQ_4' && (
                          <p style={{ fontSize: '.78rem', color: 'var(--muted)' }}>
                            Chọn radio bên trái để đặt đáp án đúng.
                          </p>
                        )}
                      </div>
                    )}

                    {editForm.questionType === 'FILL_BLANK' && (
                      <label className="form-field">
                        <span className="field-label">Đáp án chấp nhận (phân cách bởi "|")</span>
                        <input className="field-input" value={editForm.fillAnswers}
                          placeholder="Hà Nội | Ha Noi"
                          onChange={(e) => setEditForm((f) => ({ ...f, fillAnswers: e.target.value }))} />
                      </label>
                    )}

                    <label className="form-field">
                      <span className="field-label">Giải thích (tuỳ chọn)</span>
                      <textarea className="report-desc" style={{ minHeight: '2.5rem' }}
                        value={editForm.explanation}
                        onChange={(e) => setEditForm((f) => ({ ...f, explanation: e.target.value }))} />
                    </label>

                    <div className="admin-exam-row3">
                      <label className="form-field">
                        <span className="field-label">Chương</span>
                        <input className="field-input" value={editForm.chapter}
                          onChange={(e) => setEditForm((f) => ({ ...f, chapter: e.target.value }))} />
                      </label>
                      <label className="form-field">
                        <span className="field-label">Độ khó</span>
                        <select className="field-input" value={editForm.difficulty}
                          onChange={(e) => setEditForm((f) => ({ ...f, difficulty: Number(e.target.value) }))}>
                          <option value={1}>Dễ</option>
                          <option value={2}>Trung bình</option>
                          <option value={3}>Khó</option>
                        </select>
                      </label>
                      <label className="form-field">
                        <span className="field-label">Điểm</span>
                        <input className="field-input" type="number" step="0.25" min="0.25"
                          value={editForm.points}
                          onChange={(e) => setEditForm((f) => ({ ...f, points: Number(e.target.value) }))} />
                      </label>
                    </div>
                    {editError && <p className="report-error">{editError}</p>}
                    <div style={{ display: 'flex', gap: '.75rem' }}>
                      <button className="btn-primary" disabled={busy} onClick={() => void handleUpdateQuestion()}>
                        {busy ? <Spinner /> : null} Lưu
                      </button>
                      <button className="btn-secondary" onClick={() => setEditingId('')}>Huỷ</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '.75rem' }}>
                    <button className="btn-link" disabled={busy} onClick={() => startEdit(q)}>
                      Sửa ✏️
                    </button>
                    {q.isActive ? (
                      <button className="btn-link" style={{ color: 'var(--danger)' }} disabled={busy}
                        onClick={() => void handleDeleteQuestion(q.id)}>
                        Xoá khỏi đề 🗑️
                      </button>
                    ) : (
                      <button className="btn-link" style={{ color: 'var(--success, #38a169)' }} disabled={busy}
                        onClick={() => void handleRestoreQuestion(q.id)}>
                        Khôi phục ↩️
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── AdminAutoFillBox ───────────────────────────────────────────────────────────

function AdminAutoFillBox({
  secret, paperId, onDone,
}: {
  secret: string;
  paperId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(40);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ added: number; shortage: number } | null>(null);

  async function handleAutoFill() {
    if (busy || count < 1) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await adminAutoFillFromBank(secret, paperId, count);
      setResult({ added: res.added, shortage: res.shortage });
      if (res.added > 0) onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="admin-msg">
        <button className="btn-secondary" onClick={() => { setOpen(true); setResult(null); setError(''); }}>
          Lấy câu tự động
        </button>
      </div>
    );
  }

  return (
    <section className="card-section">
      <div className="section-row">
        <h3 className="section-title">Lấy câu tự động từ ngân hàng</h3>
        <button className="btn-link" onClick={() => setOpen(false)}>Đóng</button>
      </div>
      <p className="admin-exam-meta" style={{ marginBottom: '.75rem' }}>
        Hệ thống chọn ngẫu nhiên từ ngân hàng câu hỏi (cùng môn) theo tỷ lệ:
        <strong> 50% dễ / 30% trung bình / 20% khó</strong>.
        Câu đã có trong đề sẽ không bị thêm lại.
      </p>
      <div className="edit-form">
        <label className="form-field">
          <span className="field-label">Số câu hỏi cần lấy</span>
          <input
            className="field-input"
            type="number"
            min={1}
            max={200}
            value={count}
            style={{ maxWidth: '120px' }}
            onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value))))}
          />
        </label>
        {result && (
          <div>
            {result.added > 0 && (
              <p className="admin-notice">✓ Đã thêm {result.added} câu hỏi vào đề thi.</p>
            )}
            {result.shortage > 0 && (
              <p className="report-error" style={{ marginTop: '.25rem' }}>
                Ngân hàng không đủ câu: thiếu {result.shortage} câu theo tỷ lệ đã chọn.
              </p>
            )}
            {result.added === 0 && result.shortage === 0 && (
              <p className="admin-notice">Không có câu hỏi mới nào được thêm (đã đủ hoặc kho trống).</p>
            )}
          </div>
        )}
        {error && <p className="report-error">{error}</p>}
        <button className="btn-primary" disabled={busy || count < 1} onClick={() => void handleAutoFill()}>
          {busy && <Spinner />}{busy ? 'Đang lấy câu…' : `Lấy ${count} câu tự động`}
        </button>
      </div>
    </section>
  );
}

// ─── AdminQuestionBankPage ──────────────────────────────────────────────────────

const QB_PAGE_SIZE = 20;

function AdminQuestionBankPage({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterSubject, setFilterSubject] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<QuestionBankItem | null>(null);
  const [formError, setFormError] = useState('');
  const [formBusy, setFormBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<QuestionBankItem | null>(null);
  const [usage, setUsage] = useState<QuestionBankUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageFailed, setUsageFailed] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [form, setForm] = useState({
    subject: SUBJECTS[0]!.id,
    chapter: '',
    difficulty: 1,
    questionType: 'MCQ_4' as ExamQuestionType,
    points: 0.25,
    questionText: '',
    options: ['', '', '', ''] as string[],
    mcqCorrect: 0,
    tfCorrect: [true, true, true, true] as boolean[],
    fillAnswers: '',
    explanation: '',
    examYear: '',
    examCode: '',
  });

  async function load(pg = page) {
    setLoading(true);
    setError('');
    try {
      const res = await adminListQuestionBank(secret, {
        subject: filterSubject || undefined,
        difficulty: filterDifficulty ? Number(filterDifficulty) : undefined,
        search: filterSearch || undefined,
        page: pg,
        pageSize: QB_PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { onLogout(); return; }
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { void load(1); setPage(1); }, [filterSubject, filterDifficulty, filterSearch]);
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { void load(page); }, [page]);

  function resetForm(item?: QuestionBankItem) {
    if (item) {
      const mcqCorrect = item.questionType === 'MCQ_4' && typeof item.correctAnswer === 'number' ? item.correctAnswer : 0;
      const tfCorrect = item.questionType === 'TRUE_FALSE_4' && Array.isArray(item.correctAnswer) && item.correctAnswer.length === 4
        ? (item.correctAnswer as boolean[]) : [true, true, true, true];
      const fillAnswers = item.questionType === 'FILL_BLANK' && Array.isArray(item.correctAnswer)
        ? (item.correctAnswer as string[]).join(' | ') : '';
      setForm({
        subject: item.subject,
        chapter: item.chapter ?? '',
        difficulty: item.difficulty,
        questionType: item.questionType,
        points: item.points,
        questionText: item.questionText,
        options: (item.options && item.options.length === 4) ? [...item.options] : ['', '', '', ''],
        mcqCorrect,
        tfCorrect: tfCorrect as boolean[],
        fillAnswers,
        explanation: item.explanation ?? '',
        examYear: item.examYear ? String(item.examYear) : '',
        examCode: item.examCode ?? '',
      });
    } else {
      setForm({
        subject: SUBJECTS[0]!.id,
        chapter: '',
        difficulty: 1,
        questionType: 'MCQ_4',
        points: 0.25,
        questionText: '',
        options: ['', '', '', ''],
        mcqCorrect: 0,
        tfCorrect: [true, true, true, true],
        fillAnswers: '',
        explanation: '',
        examYear: '',
        examCode: '',
      });
    }
    setFormError('');
  }

  function openCreate() {
    setEditingItem(null);
    resetForm();
    setShowForm(true);
  }

  function openEdit(item: QuestionBankItem) {
    setEditingItem(item);
    resetForm(item);
    setShowForm(true);
  }

  async function handleSubmitForm() {
    if (formBusy) return;
    if (!form.questionText.trim()) { setFormError('Vui lòng nhập nội dung câu hỏi.'); return; }

    let correctAnswer: unknown;
    let options: string[] | undefined;
    if (form.questionType === 'MCQ_4') {
      const opts = form.options.map((o) => o.trim());
      if (opts.some((o) => !o)) { setFormError('Vui lòng nhập đủ 4 lựa chọn.'); return; }
      options = opts;
      correctAnswer = form.mcqCorrect;
    } else if (form.questionType === 'TRUE_FALSE_4') {
      const opts = form.options.map((o) => o.trim());
      if (opts.some((o) => !o)) { setFormError('Vui lòng nhập đủ 4 phát biểu.'); return; }
      options = opts;
      correctAnswer = form.tfCorrect;
    } else {
      const answers = form.fillAnswers.split('|').map((a) => a.trim()).filter(Boolean);
      if (answers.length === 0) { setFormError('Vui lòng nhập ít nhất 1 đáp án.'); return; }
      correctAnswer = answers;
    }

    const payload = {
      subject: form.subject,
      chapter: form.chapter.trim() || undefined,
      difficulty: form.difficulty,
      questionType: form.questionType,
      points: form.points,
      questionText: form.questionText.trim(),
      options,
      correctAnswer,
      explanation: form.explanation.trim() || undefined,
      examYear: form.examYear ? Number(form.examYear) : undefined,
      examCode: form.examCode.trim() || undefined,
    };

    setFormError('');
    setFormBusy(true);
    try {
      if (editingItem) {
        await adminUpdateQuestionBankItem(secret, editingItem.id, payload);
      } else {
        await adminCreateQuestionBankItem(secret, payload);
      }
      setShowForm(false);
      setEditingItem(null);
      await load(1);
      setPage(1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setFormBusy(false);
    }
  }

  async function openDeleteDialog(item: QuestionBankItem) {
    setDeleteTarget(item);
    setDeleteError('');
    setUsage(null);
    setUsageFailed(false);
    setUsageLoading(true);
    try {
      const u = await adminGetQuestionBankUsage(secret, item.id);
      setUsage(u);
    } catch {
      setUsageFailed(true);
      setDeleteError('Không thể kiểm tra thông tin sử dụng. Vui lòng đóng và thử lại.');
    } finally {
      setUsageLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    if (usage?.hasActiveSession) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await adminDeleteQuestionBankItem(secret, deleteTarget.id);
      setDeleteTarget(null);
      setUsage(null);
      await load(1);
      setPage(1);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setDeleteBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / QB_PAGE_SIZE));

  return (
    <div className="screen screen-admin">
      <div className="admin-header">
        <h2 className="page-title">Ngân hàng câu hỏi</h2>
        <button className="btn-link" onClick={onLogout}>Đăng xuất</button>
      </div>

      {/* Filter */}
      <div className="admin-filter" style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        <select className="field-input" style={{ flex: '1 1 130px' }}
          value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
          <option value="">Tất cả môn</option>
          {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="field-input" style={{ flex: '1 1 120px' }}
          value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
          <option value="">Tất cả độ khó</option>
          <option value="1">Dễ</option>
          <option value="2">Trung bình</option>
          <option value="3">Khó</option>
        </select>
        <input className="field-input" style={{ flex: '2 1 180px' }}
          placeholder="Tìm kiếm nội dung câu hỏi…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setFilterSearch(searchInput); }}
        />
        <button className="btn-secondary" onClick={() => setFilterSearch(searchInput)}>Tìm</button>
      </div>

      {error && <p className="report-error admin-msg">{error}</p>}

      <div className="admin-msg">
        <button className="btn-secondary" onClick={openCreate}>+ Thêm câu hỏi vào kho</button>
        <span style={{ marginLeft: '.75rem', fontSize: '.84rem', color: 'var(--muted)' }}>
          Tổng: {total} câu
        </span>
      </div>

      {/* Form thêm/sửa */}
      {showForm && (
        <section className="card-section">
          <div className="section-row">
            <h3 className="section-title">{editingItem ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới'}</h3>
            <button className="btn-link" onClick={() => { setShowForm(false); setEditingItem(null); }}>Đóng</button>
          </div>
          <div className="edit-form">
            <div className="admin-exam-row3">
              <label className="form-field">
                <span className="field-label">Môn học</span>
                <select className="field-input" value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}>
                  {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Dạng câu hỏi</span>
                <select className="field-input" value={form.questionType}
                  onChange={(e) => setForm((f) => ({ ...f, questionType: e.target.value as ExamQuestionType }))}>
                  <option value="MCQ_4">Trắc nghiệm 4 đáp án</option>
                  <option value="TRUE_FALSE_4">Đúng/Sai 4 ý</option>
                  <option value="FILL_BLANK">Điền đáp án</option>
                </select>
              </label>
            </div>

            <label className="form-field">
              <span className="field-label">Nội dung câu hỏi</span>
              <textarea className="report-desc" style={{ minHeight: '4rem' }}
                value={form.questionText}
                onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))} />
            </label>

            <div className="admin-exam-row3">
              <label className="form-field">
                <span className="field-label">Chương (tuỳ chọn)</span>
                <input className="field-input" value={form.chapter}
                  onChange={(e) => setForm((f) => ({ ...f, chapter: e.target.value }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Độ khó</span>
                <select className="field-input" value={form.difficulty}
                  onChange={(e) => setForm((f) => ({ ...f, difficulty: Number(e.target.value) }))}>
                  <option value={1}>Dễ</option>
                  <option value={2}>Trung bình</option>
                  <option value={3}>Khó</option>
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Điểm</span>
                <input className="field-input" type="number" step="0.25" min="0.25"
                  value={form.points}
                  onChange={(e) => setForm((f) => ({ ...f, points: Number(e.target.value) }))} />
              </label>
            </div>

            {(form.questionType === 'MCQ_4' || form.questionType === 'TRUE_FALSE_4') && (
              <div className="form-field">
                <span className="field-label">
                  {form.questionType === 'MCQ_4' ? '4 lựa chọn (radio = đáp án đúng)' : '4 phát biểu'}
                </span>
                {form.options.map((opt, idx) => (
                  <div key={idx} className="admin-exam-option-row">
                    {form.questionType === 'MCQ_4' ? (
                      <input type="radio" name="qb-mcq" checked={form.mcqCorrect === idx}
                        onChange={() => setForm((f) => ({ ...f, mcqCorrect: idx }))} />
                    ) : (
                      <div className="exam-tf-toggle">
                        <button type="button"
                          className={`exam-tf-btn ${form.tfCorrect[idx] ? 'active-true' : ''}`}
                          onClick={() => setForm((f) => { const t = [...f.tfCorrect]; t[idx] = true; return { ...f, tfCorrect: t }; })}>
                          Đúng
                        </button>
                        <button type="button"
                          className={`exam-tf-btn ${!form.tfCorrect[idx] ? 'active-false' : ''}`}
                          onClick={() => setForm((f) => { const t = [...f.tfCorrect]; t[idx] = false; return { ...f, tfCorrect: t }; })}>
                          Sai
                        </button>
                      </div>
                    )}
                    <span className="opt-label">{OPTION_LABELS[idx]}</span>
                    <input className="field-input" value={opt}
                      onChange={(e) => setForm((f) => {
                        const opts = [...f.options];
                        opts[idx] = e.target.value;
                        return { ...f, options: opts };
                      })} />
                  </div>
                ))}
              </div>
            )}

            {form.questionType === 'FILL_BLANK' && (
              <label className="form-field">
                <span className="field-label">Đáp án chấp nhận (phân tách bởi "|")</span>
                <input className="field-input" value={form.fillAnswers}
                  placeholder="Hà Nội | Ha Noi"
                  onChange={(e) => setForm((f) => ({ ...f, fillAnswers: e.target.value }))} />
              </label>
            )}

            <label className="form-field">
              <span className="field-label">Giải thích (tuỳ chọn)</span>
              <textarea className="report-desc" value={form.explanation}
                onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))} />
            </label>

            <div className="admin-exam-row3">
              <label className="form-field">
                <span className="field-label">Năm thi</span>
                <input className="field-input" type="number" value={form.examYear}
                  onChange={(e) => setForm((f) => ({ ...f, examYear: e.target.value }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Mã đề</span>
                <input className="field-input" value={form.examCode}
                  onChange={(e) => setForm((f) => ({ ...f, examCode: e.target.value }))} />
              </label>
            </div>

            {formError && <p className="report-error">{formError}</p>}

            <button className="btn-primary" disabled={formBusy} onClick={() => void handleSubmitForm()}>
              {formBusy && <Spinner />}{formBusy ? 'Đang lưu…' : (editingItem ? 'Cập nhật câu hỏi' : 'Thêm câu hỏi')}
            </button>
          </div>
        </section>
      )}

      {/* Danh sách câu hỏi */}
      {loading ? (
        <div className="screen-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="empty admin-msg">Không có câu hỏi nào trong kho.</p>
      ) : (
        <div className="admin-exam-question-list" style={{ margin: '0 1rem' }}>
          {items.map((q) => (
            <div key={q.id} className="admin-exam-question-row">
              <div className="admin-exam-question-head">
                <span className="admin-exam-subject">{SUBJECTS_MAP[q.subject]?.name ?? q.subject}</span>
                <span className={`diff-badge diff-${q.difficulty}`}>{DIFF_LABEL[q.difficulty] ?? 'N/A'}</span>
                <span className="admin-exam-qtype">{QUESTION_TYPE_LABEL[q.questionType]}</span>
                {q.chapter && <span className="exam-chapter-tag">{q.chapter}</span>}
              </div>
              <p className="exam-question-text">{q.questionText}</p>
              <div style={{ display: 'flex', gap: '.75rem', marginTop: '.5rem' }}>
                <button className="btn-link" onClick={() => openEdit(q)}>Sửa ✏️</button>
                <button className="btn-link" style={{ color: 'var(--danger)' }}
                  onClick={() => void openDeleteDialog(q)}>
                  Xoá khỏi kho 🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</button>
          <span>Trang {page}/{totalPages}</span>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau →</button>
        </div>
      )}

      {/* Dialog xác nhận xoá */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => { if (!deleteBusy) { setDeleteTarget(null); setUsage(null); } }}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title" style={{ marginBottom: '.75rem' }}>Xác nhận xoá câu hỏi khỏi kho</h3>
            <p style={{ fontSize: '.9rem', marginBottom: '.75rem' }}>
              <strong>"{deleteTarget.questionText.slice(0, 100)}{deleteTarget.questionText.length > 100 ? '…' : ''}"</strong>
            </p>

            {usageLoading ? (
              <div style={{ textAlign: 'center', padding: '.75rem' }}><Spinner /></div>
            ) : usage !== null ? (
              <div>
                {usage.totalExamPapers === 0 ? (
                  <p className="admin-notice" style={{ marginBottom: '.75rem' }}>
                    Câu hỏi này chưa được dùng trong đề thi nào. Có thể xoá an toàn.
                  </p>
                ) : (
                  <div style={{ marginBottom: '.75rem' }}>
                    <p style={{ fontSize: '.88rem', marginBottom: '.5rem' }}>
                      Câu hỏi đang được dùng trong <strong>{usage.totalExamPapers}</strong> đề thi:
                    </p>
                    <ul style={{ fontSize: '.84rem', paddingLeft: '1.25rem', margin: '0 0 .5rem' }}>
                      {usage.examPapers.map((p) => (
                        <li key={p.paperId} style={{ marginBottom: '.25rem' }}>
                          {p.paperTitle}
                          {p.hasActiveSession && (
                            <span style={{ color: 'var(--danger)', marginLeft: '.4rem', fontWeight: 700 }}>
                              [Đang có phiên thi đang diễn ra]
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {usage.hasActiveSession ? (
                      <p className="report-error" style={{ marginBottom: 0 }}>
                        Không thể xoá: còn phiên thi đang diễn ra tham chiếu câu hỏi này. Vui lòng chờ phiên kết thúc.
                      </p>
                    ) : (
                      <p className="admin-notice" style={{ marginBottom: 0 }}>
                        Khi xoá, câu hỏi sẽ bị xoá khỏi kho nhưng vẫn tồn tại trong các đề thi đã dùng (dạng câu hỏi tự do).
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {deleteError && <p className="report-error">{deleteError}</p>}

            <div style={{ display: 'flex', gap: '.75rem', marginTop: '.75rem' }}>
              <button className="btn-secondary" disabled={deleteBusy}
                onClick={() => { setDeleteTarget(null); setUsage(null); setUsageFailed(false); setDeleteError(''); }}>
                Huỷ
              </button>
              <button
                className="btn-primary"
                style={{ background: 'var(--danger)' }}
                disabled={deleteBusy || usageLoading || usageFailed || (usage?.hasActiveSession ?? false)}
                onClick={() => void handleConfirmDelete()}
              >
                {deleteBusy ? <Spinner /> : null}
                {deleteBusy ? 'Đang xoá…' : 'Xác nhận xoá'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AdminExamImportBox ─────────────────────────────────────────────────────────

function AdminExamImportBox({
  secret, paperId, onDone,
}: {
  secret: string;
  paperId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ExamImportResultDto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await adminImportExamQuestions(secret, paperId, file);
      setResult(res);
      if (res.inserted > 0) onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <section className="card-section">
      <h3 className="section-title" style={{ marginBottom: '.75rem' }}>Nhập câu hỏi từ Excel</h3>
      <p className="admin-exam-meta" style={{ marginBottom: '.625rem' }}>
        Dùng file mẫu <code>docs/templates/mau-import-cau-hoi-thi-thu.xlsx</code>, điền dữ liệu rồi chọn file để nhập.
        Các dòng hợp lệ được lưu ngay, dòng lỗi sẽ được báo cụ thể theo số dòng.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        disabled={busy}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {busy && <p className="admin-exam-meta" style={{ marginTop: '.5rem' }}><Spinner /> Đang xử lý…</p>}
      {error && <p className="report-error" style={{ marginTop: '.5rem' }}>{error}</p>}
      {result && (
        <div className="admin-import-result">
          <p className="admin-import-ok">✓ Đã thêm {result.inserted} câu hỏi.</p>
          {result.errors.length > 0 && (
            <div className="admin-import-errors">
              <p className="admin-import-err-title">Có {result.errors.length} dòng lỗi:</p>
              {result.errors.map((e) => (
                <p key={e.row} className="admin-import-err-row">Dòng {e.row}: {e.message}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── AdminFromBankModal ─────────────────────────────────────────────────────────

function AdminFromBankModal({
  secret, paperId, paperSubject, onDone,
}: {
  secret: string;
  paperId: string;
  paperSubject: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Mon hoc bi khoa theo de thi — chi hien cau cung mon, khong cho doi mon.
  const filterSubject = paperSubject;
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  const PAGE_SIZE = 20;

  async function loadBank(pg = 1) {
    setLoading(true);
    setError('');
    try {
      const res = await adminListQuestionBank(secret, {
        subject: filterSubject,
        difficulty: filterDifficulty ? Number(filterDifficulty) : undefined,
        search: filterSearch || undefined,
        isActive: true,
        page: pg,
        pageSize: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    setSelected(new Set());
    setResult(null);
    setPage(1);
    void loadBank(1);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (open) { setPage(1); void loadBank(1); } }, [filterDifficulty, filterSearch]);
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (open) { void loadBank(page); } }, [page]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddSelected() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await adminAddFromBank(secret, paperId, [...selected]);
      setResult(res);
      setSelected(new Set());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!open) {
    return (
      <div className="admin-msg">
        <button className="btn-secondary" onClick={handleOpen}>
          Lấy câu từ ngân hàng
        </button>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={() => { if (!busy) setOpen(false); }}>
      <div className="modal-box modal-box-wide" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Lấy câu từ ngân hàng</h3>
          <button className="btn-link" onClick={() => setOpen(false)}>Đóng ✕</button>
        </div>

        {/* Filter — môn học bị khoá theo đề thi, chỉ lọc độ khó và tìm kiếm */}
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.75rem' }}>
          <select className="field-input" style={{ flex: '1 1 110px' }}
            value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
            <option value="">Tất cả độ khó</option>
            <option value="1">Dễ</option>
            <option value="2">Trung bình</option>
            <option value="3">Khó</option>
          </select>
          <input className="field-input" style={{ flex: '2 1 160px' }}
            placeholder="Tìm kiếm câu hỏi…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setFilterSearch(searchInput); }}
          />
          <button className="btn-secondary" onClick={() => setFilterSearch(searchInput)}>Tìm</button>
        </div>

        {selected.size > 0 && (
          <div style={{ marginBottom: '.5rem', padding: '.5rem .75rem', background: 'var(--cream)', borderRadius: '8px', fontSize: '.88rem' }}>
            Đã chọn <strong>{selected.size}</strong> câu hỏi.
          </div>
        )}

        {error && <p className="report-error" style={{ marginBottom: '.5rem' }}>{error}</p>}
        {result && (
          <p className="admin-notice" style={{ marginBottom: '.5rem' }}>
            ✓ Đã thêm {result.added} câu vào đề.{result.skipped > 0 ? ` (${result.skipped} câu đã tồn tại, bỏ qua)` : ''}
          </p>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="empty" style={{ textAlign: 'center', padding: '.75rem' }}>Không có câu hỏi nào phù hợp.</p>
        ) : (
          <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            {items.map((q) => {
              const isChecked = selected.has(q.id);
              return (
                <div
                  key={q.id}
                  className="admin-exam-question-row"
                  style={{ cursor: 'pointer', background: isChecked ? 'rgba(59,130,246,.08)' : undefined }}
                  onClick={() => toggleSelect(q.id)}
                >
                  <div style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(q.id)}
                      onClick={(e) => e.stopPropagation()} style={{ marginTop: '.2rem', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="admin-exam-question-head">
                        <span className="admin-exam-subject">{SUBJECTS_MAP[q.subject]?.name ?? q.subject}</span>
                        <span className={`diff-badge diff-${q.difficulty}`}>{DIFF_LABEL[q.difficulty] ?? 'N/A'}</span>
                        <span className="admin-exam-qtype">{QUESTION_TYPE_LABEL[q.questionType]}</span>
                        {q.chapter && <span className="exam-chapter-tag">{q.chapter}</span>}
                        <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{q.points}đ</span>
                      </div>
                      <p className="exam-question-text" style={{ margin: '.25rem 0 0' }}>{q.questionText}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="admin-pagination" style={{ marginTop: '.5rem' }}>
            <button className="btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>← Trước</button>
            <span>Trang {page}/{totalPages}</span>
            <button className="btn-secondary" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Sau →</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '.75rem', marginTop: '1rem' }}>
          <button className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Đóng</button>
          <button className="btn-primary" disabled={selected.size === 0 || busy} onClick={() => void handleAddSelected()}>
            {busy && <Spinner />}
            {busy ? 'Đang thêm…' : `Thêm ${selected.size > 0 ? selected.size : ''} câu vào đề`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ProgressPage (Tien do hoc tap) ──────────────────────────────────────────

const EXAM_PAGE_SIZE = 6;

/** Sparkline SVG don gian tu mang diem so. */
function ScoreSparkline({ points }: { points: { score: number }[] }) {
  if (points.length < 2) return <span className="progress-no-data">Chưa đủ dữ liệu</span>;
  const W = 280;
  const H = 60;
  const scores = points.map((p) => p.score);
  const maxS = Math.max(...scores, 1);
  const minS = Math.min(...scores);
  const range = maxS - minS || 1;
  const step = W / (scores.length - 1);
  const toY = (s: number) => H - 4 - ((s - minS) / range) * (H - 8);
  const d = scores
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${toY(s).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sparkline-svg" aria-hidden="true">
      <polyline points={scores.map((s, i) => `${(i * step).toFixed(1)},${toY(s).toFixed(1)}`).join(' ')}
        fill="none" stroke="var(--accent,#4f8ef7)" strokeWidth="2" strokeLinejoin="round" />
      <path d={`${d} L${W},${H} L0,${H} Z`} fill="var(--accent,#4f8ef7)" fillOpacity="0.12" />
      {scores.map((s, i) => (
        <circle key={i} cx={(i * step).toFixed(1)} cy={toY(s).toFixed(1)} r="3"
          fill="var(--accent,#4f8ef7)" />
      ))}
    </svg>
  );
}

function ProgressPage({
  profile,
  sessionToken,
  onBack,
  onError,
}: {
  profile: UserProfile;
  sessionToken: string;
  onBack: () => void;
  onError: (e: unknown) => void;
}) {
  const [summary, setSummary]       = useState<ProgressSummary | null>(null);
  const [examHistory, setExamHistory] = useState<PaginatedExamHistory | null>(null);
  const [examPage, setExamPage]     = useState(0); // offset / EXAM_PAGE_SIZE
  const [loading, setLoading]       = useState(true);
  const [examLoading, setExamLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void getProgressSummary(sessionToken)
      .then((data) => { setSummary(data); setLoading(false); })
      .catch((err) => { onError(err); setLoading(false); });
  }, [sessionToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExamLoading(true);
    void getExamHistory(sessionToken, EXAM_PAGE_SIZE, examPage * EXAM_PAGE_SIZE)
      .then((data) => { setExamHistory(data); setExamLoading(false); })
      .catch((err) => { onError(err); setExamLoading(false); });
  }, [sessionToken, examPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalExamPages = examHistory ? Math.ceil(examHistory.total / EXAM_PAGE_SIZE) : 0;

  return (
    <div className="screen screen-progress">
      {/* Header */}
      <div className="page-header">
        <button className="btn-back" onClick={onBack}>← Quay lại</button>
        <h2 className="page-title">📊 Tiến độ — {profile.displayName ?? 'của tôi'}</h2>
      </div>

      {loading ? (
        <div className="progress-loading"><Spinner /> Đang tải…</div>
      ) : !summary ? null : (
        <>
          {/* 4 ô tổng quan */}
          <section className="progress-overview-grid">
            <div className="progress-stat-card">
              <span className="pstat-label">Phiên ôn tập</span>
              <span className="pstat-value">{summary.overview.totalPracticeSessions}</span>
            </div>
            <div className="progress-stat-card">
              <span className="pstat-label">Lần thi thử</span>
              <span className="pstat-value">{summary.overview.totalExamSessions}</span>
            </div>
            <div className="progress-stat-card">
              <span className="pstat-label">Điểm tích lũy</span>
              <span className="pstat-value">{summary.overview.currentPoints.toLocaleString('vi-VN')}</span>
            </div>
            <div className="progress-stat-card progress-streak">
              <span className="pstat-label">Số ngày giữ chuỗi</span>
              <span className="pstat-value">
                {summary.overview.currentStreak}
                <span className="pstat-unit"> ngày 🐝</span>
              </span>
              <span className="pstat-sub">Tốt nhất: {summary.bestStreak} ngày</span>
            </div>
          </section>

          {/* So sánh tháng */}
          <section className="card-section">
            <h3 className="section-title">So sánh tháng này vs tháng trước</h3>
            <div className="month-compare-grid">
              <div className="month-col">
                <span className="month-label">Tháng này</span>
                <div className="month-row">
                  <span>Phiên ôn tập</span>
                  <strong>{summary.monthComparison.thisMonth.practiceSessions}</strong>
                </div>
                <div className="month-row">
                  <span>Điểm thi TB</span>
                  <strong>
                    {summary.monthComparison.thisMonth.examAvgScore !== null
                      ? summary.monthComparison.thisMonth.examAvgScore.toFixed(1)
                      : '—'}
                  </strong>
                </div>
              </div>
              <div className="month-divider" />
              <div className="month-col">
                <span className="month-label">Tháng trước</span>
                <div className="month-row">
                  <span>Phiên ôn tập</span>
                  <strong>{summary.monthComparison.lastMonth.practiceSessions}</strong>
                </div>
                <div className="month-row">
                  <span>Điểm thi TB</span>
                  <strong>
                    {summary.monthComparison.lastMonth.examAvgScore !== null
                      ? summary.monthComparison.lastMonth.examAvgScore.toFixed(1)
                      : '—'}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          {/* Thống kê theo môn */}
          <section className="card-section">
            <h3 className="section-title">Thống kê theo môn</h3>
            {summary.practiceStatsBySubject.length === 0 ? (
              <p className="empty">Chưa có dữ liệu ôn tập.</p>
            ) : (
              <div className="progress-table-wrap">
                <table className="progress-table">
                  <thead>
                    <tr>
                      <th>Môn</th>
                      <th>Phiên</th>
                      <th>TB</th>
                      <th>Tốt nhất</th>
                      <th>Dễ</th>
                      <th>TB</th>
                      <th>Khó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.practiceStatsBySubject.map((s) => (
                      <tr key={s.subject}>
                        <td>{SUBJECTS_MAP[s.subject]?.name ?? s.subject}</td>
                        <td>{s.totalSessions}</td>
                        <td>{s.avgScore.toFixed(1)}</td>
                        <td>{s.bestScore}</td>
                        <td>{Math.round((s.accuracyByDifficulty[1] ?? 0) * 100)}%</td>
                        <td>{Math.round((s.accuracyByDifficulty[2] ?? 0) * 100)}%</td>
                        <td>{Math.round((s.accuracyByDifficulty[3] ?? 0) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Biểu đồ xu hướng điểm */}
          <section className="card-section">
            <h3 className="section-title">Xu hướng điểm (30 phiên gần nhất)</h3>
            {summary.scoreTrend.length === 0 ? (
              <p className="empty">Chưa có dữ liệu.</p>
            ) : (
              <div className="sparkline-wrap">
                <ScoreSparkline points={summary.scoreTrend} />
                <div className="sparkline-meta">
                  <span>Điểm thấp nhất: <strong>{Math.min(...summary.scoreTrend.map((p) => p.score))}</strong></span>
                  <span>Điểm cao nhất: <strong>{Math.max(...summary.scoreTrend.map((p) => p.score))}</strong></span>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Lịch sử thi thử */}
      <section className="card-section">
        <h3 className="section-title">Lịch sử thi thử</h3>
        {examLoading ? (
          <div className="progress-loading"><Spinner /></div>
        ) : !examHistory || examHistory.items.length === 0 ? (
          <p className="empty">Chưa có lần thi nào.</p>
        ) : (
          <>
            <div className="progress-table-wrap">
              <table className="progress-table">
                <thead>
                  <tr>
                    <th>Môn</th>
                    <th>Đề thi</th>
                    <th>Điểm</th>
                    <th>Thưởng</th>
                    <th>Ngày thi</th>
                  </tr>
                </thead>
                <tbody>
                  {examHistory.items.map((item: ExamHistoryItem) => (
                    <tr key={item.id}>
                      <td>{SUBJECTS_MAP[item.subject]?.name ?? item.subject}</td>
                      <td className="exam-history-title">{item.title}</td>
                      <td>
                        <span className={`exam-score-badge ${item.score !== null && item.score >= 7 ? 'score-high' : 'score-low'}`}>
                          {item.score !== null ? item.score.toFixed(1) : '—'}/10
                        </span>
                      </td>
                      <td>+{item.pointsAwarded}</td>
                      <td className="exam-history-date">
                        {new Date(item.completedAt).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalExamPages > 1 && (
              <div className="admin-pagination">
                <button className="btn-secondary" disabled={examPage <= 0 || examLoading}
                  onClick={() => setExamPage((p) => p - 1)}>← Trước</button>
                <span>Trang {examPage + 1}/{totalExamPages}</span>
                <button className="btn-secondary" disabled={examPage >= totalExamPages - 1 || examLoading}
                  onClick={() => setExamPage((p) => p + 1)}>Sau →</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ─── WrongAnswersPage (Ôn câu sai) ────────────────────────────────────────────

const OPTION_ALPHA = ['A', 'B', 'C', 'D'];

function subjectName(id: string): string {
  return SUBJECTS.find((s) => s.id === id)?.name ?? id;
}

function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
}

// Mini quiz inline cho từng câu sai
function WrongAnswerRetry({
  item,
  sessionToken,
  onError,
  onCorrect,
}: {
  item: WrongAnswerItem;
  sessionToken: string;
  onError: (e: unknown) => void;
  onCorrect: () => void;
}) {
  const [selected, setSelected] = useState<unknown>(null);
  const [result, setResult]     = useState<RetryResult | null>(null);
  const [busy, setBusy]         = useState(false);

  const q = item.question;
  const opts = Array.isArray(q.options) ? (q.options as string[]) : [];

  async function handleSubmit() {
    if (selected === null) return;
    setBusy(true);
    try {
      const res = await retryWrongAnswer(sessionToken, item.id, selected);
      setResult(res);
      if (res.isCorrect) onCorrect();
    } catch (err) { onError(err); }
    finally { setBusy(false); }
  }

  function handleReset() {
    setSelected(null);
    setResult(null);
  }

  if (result) {
    const correctDisplay = (() => {
      if (q.type === 'MCQ_4' && typeof result.correctAnswer === 'number') {
        return `${OPTION_ALPHA[result.correctAnswer]}. ${opts[result.correctAnswer] ?? ''}`;
      }
      if (q.type === 'TRUE_FALSE_4' && Array.isArray(result.correctAnswer)) {
        return (result.correctAnswer as boolean[]).map((v, i) => `${OPTION_ALPHA[i]}: ${v ? 'Đúng' : 'Sai'}`).join(' | ');
      }
      if (q.type === 'FILL_BLANK' && Array.isArray(result.correctAnswer)) {
        return (result.correctAnswer as string[]).join(' hoặc ');
      }
      return String(result.correctAnswer);
    })();

    return (
      <div style={{ marginTop: '.75rem', padding: '.75rem', background: result.isCorrect ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)', borderRadius: '10px', border: `1px solid ${result.isCorrect ? '#22c55e' : '#ef4444'}` }}>
        <p style={{ margin: '0 0 .4rem', fontWeight: 700, color: result.isCorrect ? '#15803d' : '#dc2626' }}>
          {result.isCorrect ? '✅ Đúng rồi!' : '❌ Chưa đúng'}
        </p>
        <p style={{ margin: '0 0 .25rem', fontSize: '.85rem' }}><strong>Đáp án đúng:</strong> {correctDisplay}</p>
        {result.explanation && (
          <p style={{ margin: '0 0 .5rem', fontSize: '.82rem', color: '#555' }}>{result.explanation}</p>
        )}
        <button className="btn-link" style={{ fontSize: '.82rem' }} onClick={handleReset}>Thử lại</button>
      </div>
    );
  }

  // Render input theo loại câu
  if (q.type === 'MCQ_4') {
    return (
      <div style={{ marginTop: '.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {opts.map((opt, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              style={{
                padding: '.5rem .75rem', borderRadius: '8px', textAlign: 'left', fontSize: '.88rem',
                border: selected === i ? '2px solid #6366f1' : '1px solid #ddd',
                background: selected === i ? '#eef2ff' : '#fafafa',
                cursor: 'pointer',
              }}
            >
              {OPTION_ALPHA[i]}. {opt}
            </button>
          ))}
        </div>
        <button
          className="btn-primary"
          style={{ marginTop: '.6rem', fontSize: '.88rem', padding: '.45rem 1rem' }}
          disabled={selected === null || busy}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'Đang kiểm tra…' : 'Kiểm tra'}
        </button>
      </div>
    );
  }

  if (q.type === 'TRUE_FALSE_4') {
    const sel = Array.isArray(selected) ? (selected as (boolean | null)[]) : [null, null, null, null];
    return (
      <div style={{ marginTop: '.75rem' }}>
        {opts.map((stmt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.4rem' }}>
            <span style={{ flex: 1, fontSize: '.88rem' }}>{OPTION_ALPHA[i]}. {stmt}</span>
            <button
              onClick={() => { const next = [...sel]; next[i] = true; setSelected(next); }}
              style={{ padding: '.25rem .6rem', borderRadius: '6px', border: sel[i] === true ? '2px solid #22c55e' : '1px solid #ddd', background: sel[i] === true ? '#dcfce7' : '#fafafa', cursor: 'pointer', fontSize: '.82rem' }}
            >Đúng</button>
            <button
              onClick={() => { const next = [...sel]; next[i] = false; setSelected(next); }}
              style={{ padding: '.25rem .6rem', borderRadius: '6px', border: sel[i] === false ? '2px solid #ef4444' : '1px solid #ddd', background: sel[i] === false ? '#fee2e2' : '#fafafa', cursor: 'pointer', fontSize: '.82rem' }}
            >Sai</button>
          </div>
        ))}
        <button
          className="btn-primary"
          style={{ marginTop: '.5rem', fontSize: '.88rem', padding: '.45rem 1rem' }}
          disabled={sel.some((v) => v === null) || busy}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'Đang kiểm tra…' : 'Kiểm tra'}
        </button>
      </div>
    );
  }

  // FILL_BLANK
  return (
    <div style={{ marginTop: '.75rem' }}>
      <input
        type="text"
        placeholder="Nhập đáp án…"
        style={{ width: '100%', padding: '.5rem .75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '.88rem', boxSizing: 'border-box' }}
        value={typeof selected === 'string' ? selected : ''}
        onChange={(e) => setSelected(e.target.value)}
      />
      <button
        className="btn-primary"
        style={{ marginTop: '.5rem', fontSize: '.88rem', padding: '.45rem 1rem' }}
        disabled={!selected || busy}
        onClick={() => void handleSubmit()}
      >
        {busy ? 'Đang kiểm tra…' : 'Kiểm tra'}
      </button>
    </div>
  );
}

function WrongAnswerCard({
  item,
  sessionToken,
  onError,
  isRetriedCorrectly,
  onRetryCorrect,
}: {
  item: WrongAnswerItem;
  sessionToken: string;
  onError: (e: unknown) => void;
  isRetriedCorrectly: boolean;
  onRetryCorrect: () => void;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [showRetry,  setShowRetry]  = useState(false);
  const q = item.question;

  const correctDisplay = (() => {
    if (q.type === 'MCQ_4') {
      const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
      const idx = typeof q.correctAnswer === 'number' ? q.correctAnswer : -1;
      return idx >= 0 ? `${OPTION_ALPHA[idx]}. ${opts[idx] ?? ''}` : String(q.correctAnswer);
    }
    if (q.type === 'TRUE_FALSE_4' && Array.isArray(q.correctAnswer)) {
      return (q.correctAnswer as boolean[]).map((v, i) => `${OPTION_ALPHA[i]}: ${v ? 'Đúng' : 'Sai'}`).join(' | ');
    }
    if (q.type === 'FILL_BLANK' && Array.isArray(q.correctAnswer)) {
      return (q.correctAnswer as string[]).join(' hoặc ');
    }
    return String(q.correctAnswer);
  })();

  return (
    <div style={{
      background: isRetriedCorrectly ? '#f0fdf4' : '#fff',
      borderRadius: '12px', padding: '1rem',
      boxShadow: '0 1px 4px rgba(0,0,0,.08)', marginBottom: '.75rem',
      border: isRetriedCorrectly ? '1.5px solid #86efac' : '1.5px solid transparent',
      opacity: isRetriedCorrectly ? 0.8 : 1,
    }}>
      {/* Badge môn + số lần sai + hết hạn */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.6rem' }}>
        <span style={{ background: '#eef2ff', color: '#4338ca', borderRadius: '6px', padding: '.15rem .55rem', fontSize: '.78rem', fontWeight: 600 }}>
          {subjectName(q.subjectId)}
        </span>
        <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '6px', padding: '.15rem .55rem', fontSize: '.78rem', fontWeight: 600 }}>
          Sai {item.wrongCount} lần
        </span>
        {isRetriedCorrectly && (
          <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: '6px', padding: '.15rem .55rem', fontSize: '.78rem', fontWeight: 600 }}>
            ✅ Đã làm đúng
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '.76rem' }}>
          Hết hạn sau {daysLeft(item.expiresAt)} ngày
        </span>
      </div>

      {/* Nội dung câu hỏi */}
      <p style={{ margin: '0 0 .75rem', fontSize: '.92rem', lineHeight: 1.5 }}>{q.content}</p>

      {/* Options (với MCQ_4 / TRUE_FALSE_4) */}
      {q.type !== 'FILL_BLANK' && Array.isArray(q.options) && (
        <div style={{ marginBottom: '.6rem' }}>
          {(q.options as string[]).map((opt, i) => (
            <div key={i} style={{ fontSize: '.85rem', color: '#555', marginBottom: '.2rem' }}>
              {OPTION_ALPHA[i]}. {opt}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        <button
          className="btn-secondary"
          style={{ fontSize: '.82rem', padding: '.35rem .75rem' }}
          onClick={() => { setShowAnswer((v) => !v); setShowRetry(false); }}
        >
          {showAnswer ? 'Ẩn đáp án' : 'Xem đáp án'}
        </button>
        <button
          className="btn-secondary"
          style={{ fontSize: '.82rem', padding: '.35rem .75rem', background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
          onClick={() => { setShowRetry((v) => !v); setShowAnswer(false); }}
        >
          {showRetry ? 'Ẩn làm lại' : 'Làm lại'}
        </button>
      </div>

      {/* Đáp án */}
      {showAnswer && (
        <div style={{ marginTop: '.6rem', padding: '.6rem .75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: 0, fontSize: '.85rem' }}><strong>Đáp án đúng:</strong> {correctDisplay}</p>
          {q.explanation && (
            <p style={{ margin: '.35rem 0 0', fontSize: '.82rem', color: '#555' }}>{q.explanation}</p>
          )}
        </div>
      )}

      {/* Mini quiz inline */}
      {showRetry && (
        <WrongAnswerRetry item={item} sessionToken={sessionToken} onError={onError} onCorrect={onRetryCorrect} />
      )}
    </div>
  );
}

function WrongAnswersPage({
  sessionToken, onBack, onError,
}: {
  sessionToken: string;
  onBack: () => void;
  onError: (e: unknown) => void;
}) {
  const [subject,           setSubject]           = useState('');
  const [page,              setPage]              = useState(1);
  const [data,              setData]              = useState<WrongAnswerItem[]>([]);
  const [total,             setTotal]             = useState(0);
  const [loading,           setLoading]           = useState(true);
  const [retriedCorrectIds, setRetriedCorrectIds] = useState<Set<number>>(new Set());
  const PAGE_SIZE = 20;

  async function fetchData(p: number, subj: string) {
    setLoading(true);
    try {
const res: WrongAnswerListResponse = await getWrongAnswers(sessionToken, subj || undefined, p, PAGE_SIZE);
      setData(res.data);
      setTotal(res.total);
    } catch (err) { onError(err); }
    finally { setLoading(false); }
  }

  // Load dữ liệu lần đầu khi mount
  useEffect(() => {
    void fetchData(1, ''); // eslint-disable-line react-hooks/set-state-in-effect
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / PAGE_SIZE);

  async function handlePageChange(next: number) {
    setPage(next);
    await fetchData(next, subject);
  }

  function handleSubjectChange(newSubject: string) {
    setSubject(newSubject);
    setPage(1);
    void fetchData(1, newSubject);
  }

  function handleRetryCorrect(id: number) {
    setRetriedCorrectIds((prev) => new Set(prev).add(id));
  }

  return (
    <div className="screen" style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '1rem 1.25rem .75rem', background: 'linear-gradient(135deg,#f093fb,#f5576c)', color: '#fff' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', padding: 0 }}>←</button>
        <h2 style={{ flex: 1, margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>❌ Ôn Câu Sai</h2>
        <span style={{ fontSize: '.82rem', opacity: .85 }}>{total} câu</span>
      </div>

      {/* Filter môn */}
      <div style={{ padding: '.75rem 1.25rem', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <select
          value={subject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          style={{ width: '100%', padding: '.5rem .75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '.9rem', background: '#fafafa' }}
        >
          <option value="">Tất cả môn học</option>
          {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
        </select>
      </div>

      {/* Nội dung */}
      <div style={{ padding: '1rem 1.25rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Spinner />
            <p style={{ margin: '.75rem 0 0', color: '#94a3b8', fontSize: '.88rem' }}>Đang tải danh sách câu sai…</p>
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <p style={{ fontSize: '2rem', margin: '0 0 .75rem' }}>🎉</p>
            <p style={{ margin: 0, fontWeight: 600 }}>Không có câu sai nào</p>
            <p style={{ margin: '.35rem 0 0', fontSize: '.88rem' }}>
              {subject ? 'Thử chọn môn khác hoặc học tốt lắm!' : 'Bạn chưa có câu sai nào còn hạn. Tiếp tục cố gắng!'}
            </p>
          </div>
        ) : (
          <>
            {data.map((item) => (
              <WrongAnswerCard
                key={item.id}
                item={item}
                sessionToken={sessionToken}
                onError={onError}
                isRetriedCorrectly={retriedCorrectIds.has(item.id)}
                onRetryCorrect={() => handleRetryCorrect(item.id)}
              />
            ))}

            {/* Phân trang */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '.75rem', marginTop: '1rem' }}>
                <button
                  className="btn-secondary"
                  disabled={page <= 1 || loading}
                  onClick={() => void handlePageChange(page - 1)}
                >← Trước</button>
                <span style={{ fontSize: '.88rem', color: '#64748b' }}>Trang {page}/{totalPages}</span>
                <button
                  className="btn-secondary"
                  disabled={page >= totalPages || loading}
                  onClick={() => void handlePageChange(page + 1)}
                >Sau →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── AdminDashboardPage ──────────────────────────────────────────────────────

function AdminDashboardPage({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await adminGetDashboard(secret);
      setStats(data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="admin-loading">Đang tải...</div>;
  if (error) return <div className="admin-error">{error} <button onClick={() => void load()}>Thử lại</button></div>;
  if (!stats) return null;

  const cards = [
    { label: 'Tổng học sinh', value: stats.totalUsers.toLocaleString(), icon: '👥' },
    { label: 'Mới trong tuần', value: stats.newUsersThisWeek.toLocaleString(), icon: '📅' },
    { label: 'Mới trong tháng', value: stats.newUsersThisMonth.toLocaleString(), icon: '📆' },
    { label: 'Tổng lượt thi', value: stats.totalExamSessions.toLocaleString(), icon: '📝' },
    { label: 'Tỉ lệ đạt (≥7)', value: `${stats.examPassRate}%`, icon: '✅' },
    { label: 'Đang online', value: stats.onlineNow.toLocaleString(), icon: '🟢' },
  ];

  return (
    <div className="admin-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>📊 Tổng quan hệ thống</h2>
        <button className="btn-secondary" onClick={() => void load()}>🔄 Làm mới</button>
      </div>
      <div className="dashboard-cards">
        {cards.map((c) => (
          <div key={c.label} className="dashboard-card">
            <div className="dashboard-card-icon">{c.icon}</div>
            <div className="dashboard-card-value">{c.value}</div>
            <div className="dashboard-card-label">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AdminUsersPage ──────────────────────────────────────────────────────────

const USERS_PAGE_SIZE = 10;

function AdminUsersPage({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [blockedFilter, setBlockedFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function load(p = page) {
    setLoading(true);
    setError('');
    try {
      const isBlocked =
        blockedFilter === 'true' ? true : blockedFilter === 'false' ? false : undefined;
      const result = await adminListUsers(secret, {
        search: search || undefined,
        role: roleFilter || undefined,
        isBlocked,
        page: p,
        limit: USERS_PAGE_SIZE,
      });
      setUsers(result.users);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setPage(p);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(userId: string) {
    setDetailLoading(true);
    setSelectedUser(null);
    try {
      const detail = await adminGetUserDetail(secret, userId);
      setSelectedUser(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải chi tiết');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleBlock(userId: string, isBlocked: boolean) {
    setActionBusy(true);
    try {
      await adminBlockUser(secret, userId, isBlocked);
      setNotice(isBlocked ? 'Đã khoá tài khoản.' : 'Đã mở khoá tài khoản.');
      setSelectedUser(null);
      void load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi thao tác');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleResetPassword(userId: string) {
    setActionBusy(true);
    try {
      const { resetLink } = await adminResetPassword(secret, userId);
      // Hien thi link trong prompt de admin copy.
      window.prompt('Link đặt lại mật khẩu (copy và gửi cho học sinh):', resetLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tạo link reset');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSetRole(userId: string, role: string) {
    setActionBusy(true);
    try {
      await adminSetUserRole(secret, userId, role);
      setNotice(`Đã đổi quyền thành ${role}.`);
      setSelectedUser(null);
      void load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi đổi quyền');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDelete(userId: string, displayName: string | null) {
    const confirmed = window.confirm(
      `Bạn chắc chắn muốn XOÁ tài khoản "${displayName ?? userId}"?\n\nThao tác này KHÔNG THỂ hoàn tác — tài khoản sẽ bị xoá khỏi hệ thống và Firebase.`,
    );
    if (!confirmed) return;
    setActionBusy(true);
    try {
      await adminDeleteUser(secret, userId);
      setNotice('Đã xoá tài khoản.');
      setSelectedUser(null);
      void load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xoá tài khoản');
    } finally {
      setActionBusy(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(1); }, [search, roleFilter, blockedFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="admin-users-page">
      <h2>👥 Quản lý người dùng</h2>

      {/* Bộ lọc */}
      <div className="admin-users-filters">
        <input
          type="text"
          placeholder="Tìm theo tên hoặc email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-search-input"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="admin-select">
          <option value="">Tất cả quyền</option>
          <option value="STUDENT">Học sinh</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select value={blockedFilter} onChange={(e) => setBlockedFilter(e.target.value)} className="admin-select">
          <option value="">Tất cả trạng thái</option>
          <option value="false">Đang hoạt động</option>
          <option value="true">Đã khoá</option>
        </select>
      </div>

      {notice && (
        <div className="admin-notice" onClick={() => setNotice('')}>{notice} ✕</div>
      )}
      {error && (
        <div className="admin-error">{error} <button onClick={() => setError('')}>✕</button></div>
      )}

      {/* Bảng danh sách */}
      {loading ? (
        <div className="admin-loading">Đang tải...</div>
      ) : (
        <>
          <div style={{ marginBottom: '.5rem', color: '#64748b', fontSize: '.88rem' }}>
            {total} người dùng
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Email</th>
                <th>Quyền</th>
                <th>Trạng thái</th>
                <th>Đăng ký</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName ?? '(chưa đặt)'}</td>
                  <td>{u.email ?? '—'}</td>
                  <td>
                    <span className={`role-badge ${u.role === 'ADMIN' ? 'role-admin' : 'role-student'}`}>
                      {u.role === 'ADMIN' ? '👑 Admin' : '🎓 Học sinh'}
                    </span>
                  </td>
                  <td>
                    {u.isBlocked
                      ? <span className="status-blocked">🔒 Bị khoá</span>
                      : <span className="status-active">✅ Hoạt động</span>}
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
                  <td>
                    <button
                      className="btn-secondary"
                      onClick={() => void openDetail(u.id)}
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Phân trang */}
          {totalPages > 1 && (
            <div className="admin-pagination">
              <button
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => void load(page - 1)}
              >← Trước</button>
              <span style={{ fontSize: '.88rem', color: '#64748b' }}>
                Trang {page}/{totalPages}
              </span>
              <button
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => void load(page + 1)}
              >Tiếp →</button>
            </div>
          )}
        </>
      )}

      {/* Modal chi tiết */}
      {(detailLoading || selectedUser) && (
        <div className="modal-overlay" onClick={() => { if (!actionBusy) setSelectedUser(null); }}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="admin-loading">Đang tải chi tiết...</div>
            ) : selectedUser ? (
              <>
                <div className="modal-header">
                  <h3>{selectedUser.user.displayName ?? '(chưa đặt tên)'}</h3>
                  <button className="modal-close" onClick={() => setSelectedUser(null)}>✕</button>
                </div>

                {/* Thông tin cá nhân */}
                <div className="user-detail-section">
                  <p><strong>Email:</strong> {selectedUser.user.email ?? '—'}</p>
                  <p><strong>Điện thoại:</strong> {selectedUser.user.phone ?? '—'}</p>
                  <p><strong>Trường:</strong> {selectedUser.user.school ?? '—'}</p>
                  <p><strong>Tỉnh:</strong> {selectedUser.user.province ?? '—'}</p>
                  <p><strong>Quyền:</strong> {selectedUser.user.role === 'ADMIN' ? '👑 Admin' : '🎓 Học sinh'}</p>
                  <p><strong>Trạng thái:</strong> {selectedUser.user.isBlocked ? '🔒 Bị khoá' : '✅ Hoạt động'}</p>
                  <p><strong>Đăng ký:</strong> {new Date(selectedUser.user.createdAt).toLocaleDateString('vi-VN')}</p>
                  <p><strong>Đăng nhập gần nhất:</strong> {selectedUser.user.lastLoginAt ? new Date(selectedUser.user.lastLoginAt).toLocaleString('vi-VN') : '—'}</p>
                </div>

                {/* Thống kê */}
                <div className="user-detail-section">
                  <h4>📊 Thống kê</h4>
                  <p><strong>Phiên ôn tập:</strong> {selectedUser.stats.totalPracticeSessions}</p>
                  <p><strong>Lần thi thử:</strong> {selectedUser.stats.totalExamSessions}</p>
                  <p><strong>Điểm thi TB:</strong> {selectedUser.stats.avgExamScore !== null ? selectedUser.stats.avgExamScore.toFixed(1) : '—'}</p>
                </div>

                {/* Lịch sử thi gần nhất */}
                {selectedUser.recentExams.length > 0 && (
                  <div className="user-detail-section">
                    <h4>📝 Lịch sử thi gần nhất</h4>
                    <table className="admin-table" style={{ fontSize: '.85rem' }}>
                      <thead>
                        <tr><th>Đề thi</th><th>Điểm</th><th>Trạng thái</th><th>Ngày</th></tr>
                      </thead>
                      <tbody>
                        {selectedUser.recentExams.map((e) => (
                          <tr key={e.id}>
                            <td>{e.examPaperTitle}</td>
                            <td>{e.score !== null ? e.score.toFixed(1) : '—'}</td>
                            <td>{e.status === 'COMPLETED' ? '✅' : e.status === 'EXPIRED' ? '⏰' : '🔄'} {e.status}</td>
                            <td>{e.completedAt ? new Date(e.completedAt).toLocaleDateString('vi-VN') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Actions */}
                <div className="user-detail-actions">
                  <button
                    className={selectedUser.user.isBlocked ? 'btn-primary' : 'btn-warning'}
                    disabled={actionBusy}
                    onClick={() => void handleBlock(selectedUser.user.id, !selectedUser.user.isBlocked)}
                  >
                    {selectedUser.user.isBlocked ? '🔓 Mở khoá' : '🔒 Khoá tài khoản'}
                  </button>

                  <button
                    className="btn-secondary"
                    disabled={actionBusy || !selectedUser.user.email}
                    title={!selectedUser.user.email ? 'Tài khoản này không có email' : ''}
                    onClick={() => void handleResetPassword(selectedUser.user.id)}
                  >
                    🔑 Reset mật khẩu
                  </button>

                  <button
                    className="btn-secondary"
                    disabled={actionBusy}
                    onClick={() => void handleSetRole(
                      selectedUser.user.id,
                      selectedUser.user.role === 'ADMIN' ? 'STUDENT' : 'ADMIN',
                    )}
                  >
                    {selectedUser.user.role === 'ADMIN' ? '👇 Hạ xuống Học sinh' : '👑 Nâng lên Admin'}
                  </button>

                  <button
                    className="btn-danger"
                    disabled={actionBusy}
                    onClick={() => void handleDelete(selectedUser.user.id, selectedUser.user.displayName)}
                  >
                    🗑️ Xoá tài khoản
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
