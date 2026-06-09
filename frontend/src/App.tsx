import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { firebaseAuth, googleProvider } from './lib/firebase.js';
import {
  loginWithFirebaseToken, getMyProfile, updateSubjects, updateProfile, ApiError,
  startPracticeSession, answerQuestion, completeSession, reportQuestion,
  getPracticeHistory, getPracticeStats,
} from './lib/api.js';
import type {
  UserProfile, PracticeQuestion, StartSessionResult, AnswerResult, CompleteResult,
  HistoryItem, SubjectStat,
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

type Screen = 'loading' | 'login' | 'onboarding' | 'profile' | 'practice';

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
          onPractice={() => setScreen('practice')}
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
  profile, sessionToken, onProfileUpdate, onChangeSubjects, onPractice, onError, onLogout,
}: {
  profile: UserProfile;
  sessionToken: string;
  onProfileUpdate: (p: UserProfile) => void;
  onChangeSubjects: () => void;
  onPractice: () => void;
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

      {/* Practice CTA */}
      <div style={{ padding: '0 1.25rem .75rem' }}>
        <button className="btn-primary btn-lg" onClick={onPractice}>
          Bắt đầu ôn tập 📚
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

  async function handleOptionClick(idx: number) {
    if (answered || answerBusy || !question) return;
    setAnswerBusy(true);
    await onAnswer(question.id, idx);
    setAnswerBusy(false);
  }

  async function sendReport(reason: typeof REPORT_REASONS[number]['value']) {
    if (!question) return;
    try {
      await reportQuestion(sessionToken, question.id, reason, data.sessionId);
      setReportSent(true);
      setShowReport(false);
    } catch (err) { onError(err); }
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
              {REPORT_REASONS.map((r) => (
                <button key={r.value} className="report-reason" onClick={() => void sendReport(r.value)}>
                  {r.label}
                </button>
              ))}
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
          ✓ Đã gửi báo lỗi
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
