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
  adminCreateExamQuestion, adminUpdateExamQuestion, adminDeleteExamQuestion, adminRestoreExamQuestion, adminImportExamQuestions,
} from './lib/api.js';
import type {
  UserProfile, StartSessionResult, AnswerResult, CompleteResult,
  HistoryItem, SubjectStat, QuestionReportDto, ReportsSummary, ReportStatus,
  StartExamResult, SubmitExamResult, ExamResult, ExamAnswerValue, ExamQuestionType, ExamQuestionPublic,
  ExamPaperSummary, ExamPaperDetail, CreateExamQuestionPayload, ExamImportResultDto,
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

type Screen = 'loading' | 'login' | 'onboarding' | 'profile' | 'practice' | 'exam' | 'admin';

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
  profile, sessionToken, onProfileUpdate, onChangeSubjects, onPractice, onExam, onError, onLogout,
}: {
  profile: UserProfile;
  sessionToken: string;
  onProfileUpdate: (p: UserProfile) => void;
  onChangeSubjects: () => void;
  onPractice: () => void;
  onExam: () => void;
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
      <div style={{ padding: '0 1.25rem .75rem', display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
        <button className="btn-primary btn-lg" onClick={onPractice}>
          Bắt đầu ôn tập 📚
        </button>
        <button className="btn-secondary btn-lg" onClick={onExam}>
          Thi thử 🎯
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
    try {
      const answers = session.data.questions.map((q) => ({
        examQuestionId: q.id,
        selectedAnswer: session.answers.get(q.id) ?? defaultAnswerFor(q.questionType),
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
  session, onAnswerChange, onSubmit, submitting,
}: {
  session: ActiveExamSession;
  onAnswerChange: (qId: string, value: ExamAnswerValue) => void;
  onSubmit: () => void;
  submitting: boolean;
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
                  <p className="exam-wrong-line">
                    <strong>Bạn chọn:</strong> {describeExamAnswer(w.questionType, w.options, w.selectedAnswer)}
                  </p>
                  <p className="exam-wrong-line correct">
                    <strong>Đáp án đúng:</strong> {describeExamAnswer(w.questionType, w.options, w.correctAnswer)}
                  </p>
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

type AdminTab = 'reports' | 'exams';

function AdminPage() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem('adminSecret') ?? '');
  const [tab, setTab] = useState<AdminTab>('reports');

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
        <button className={`admin-tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
          Báo cáo câu hỏi
        </button>
        <button className={`admin-tab ${tab === 'exams' ? 'active' : ''}`} onClick={() => setTab('exams')}>
          Đề thi thử
        </button>
      </div>
      {tab === 'reports'
        ? <AdminReportsPage secret={secret} onLogout={handleLogout} />
        : <AdminExamPage secret={secret} onLogout={handleLogout} />}
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

      <AdminExamQuestionForm secret={secret} paperId={paper.id} onDone={() => void load()} />

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
                        Xoá khỏi đề ↓
                      </button>
                    ) : (
                      <button className="btn-link" style={{ color: 'var(--success)' }} disabled={busy}
                        onClick={() => void handleRestoreQuestion(q.id)}>
                        Khôi phục ↑
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

// ─── AdminExamQuestionForm ──────────────────────────────────────────────────────

function AdminExamQuestionForm({
  secret, paperId, onDone,
}: {
  secret: string;
  paperId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [questionType, setQuestionType] = useState<ExamQuestionType>('MCQ_4');
  const [chapter, setChapter] = useState('');
  const [difficulty, setDifficulty] = useState(1);
  const [points, setPoints] = useState(0.25);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [mcqCorrect, setMcqCorrect] = useState(0);
  const [tfCorrect, setTfCorrect] = useState<boolean[]>([true, true, true, true]);
  const [fillAnswers, setFillAnswers] = useState('');
  const [explanation, setExplanation] = useState('');
  const [examYear, setExamYear] = useState('');
  const [examCode, setExamCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function resetForm() {
    setChapter('');
    setDifficulty(1);
    setPoints(0.25);
    setQuestionText('');
    setOptions(['', '', '', '']);
    setMcqCorrect(0);
    setTfCorrect([true, true, true, true]);
    setFillAnswers('');
    setExplanation('');
    setExamYear('');
    setExamCode('');
  }

  async function handleSubmit() {
    if (busy) return;
    if (!questionText.trim()) {
      setError('Vui lòng nhập nội dung câu hỏi.');
      return;
    }

    let payload: CreateExamQuestionPayload;
    if (questionType === 'MCQ_4') {
      const opts = options.map((o) => o.trim());
      if (opts.some((o) => !o)) {
        setError('Vui lòng nhập đủ 4 lựa chọn.');
        return;
      }
      payload = {
        chapter: chapter.trim() || undefined,
        difficulty, points, questionType,
        questionText: questionText.trim(),
        options: opts,
        correctAnswer: mcqCorrect,
        explanation: explanation.trim() || undefined,
        examYear: examYear ? Number(examYear) : undefined,
        examCode: examCode.trim() || undefined,
      };
    } else if (questionType === 'TRUE_FALSE_4') {
      const opts = options.map((o) => o.trim());
      if (opts.some((o) => !o)) {
        setError('Vui lòng nhập đủ 4 phát biểu.');
        return;
      }
      payload = {
        chapter: chapter.trim() || undefined,
        difficulty, points, questionType,
        questionText: questionText.trim(),
        options: opts,
        correctAnswer: tfCorrect,
        explanation: explanation.trim() || undefined,
        examYear: examYear ? Number(examYear) : undefined,
        examCode: examCode.trim() || undefined,
      };
    } else {
      const answers = fillAnswers.split('|').map((a) => a.trim()).filter(Boolean);
      if (answers.length === 0) {
        setError('Vui lòng nhập ít nhất 1 đáp án (phân tách bởi "|").');
        return;
      }
      payload = {
        chapter: chapter.trim() || undefined,
        difficulty, points, questionType,
        questionText: questionText.trim(),
        correctAnswer: answers,
        explanation: explanation.trim() || undefined,
        examYear: examYear ? Number(examYear) : undefined,
        examCode: examCode.trim() || undefined,
      };
    }

    setError('');
    setBusy(true);
    try {
      await adminCreateExamQuestion(secret, paperId, payload);
      resetForm();
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="admin-msg">
        <button className="btn-secondary" onClick={() => setOpen(true)}>+ Thêm câu hỏi</button>
      </div>
    );
  }

  return (
    <section className="card-section">
      <div className="section-row">
        <h3 className="section-title">Thêm câu hỏi mới</h3>
        <button className="btn-link" onClick={() => setOpen(false)}>Đóng</button>
      </div>

      <div className="edit-form">
        <label className="form-field">
          <span className="field-label">Dạng câu hỏi</span>
          <select className="field-input" value={questionType}
            onChange={(e) => setQuestionType(e.target.value as ExamQuestionType)}>
            <option value="MCQ_4">Trắc nghiệm 4 đáp án</option>
            <option value="TRUE_FALSE_4">Đúng/Sai 4 ý</option>
            <option value="FILL_BLANK">Điền đáp án</option>
          </select>
        </label>

        <label className="form-field">
          <span className="field-label">Nội dung câu hỏi</span>
          <textarea className="report-desc" style={{ minHeight: '4rem' }} value={questionText}
            onChange={(e) => setQuestionText(e.target.value)} />
        </label>

        <div className="admin-exam-row3">
          <label className="form-field">
            <span className="field-label">Chương (tuỳ chọn)</span>
            <input className="field-input" value={chapter} onChange={(e) => setChapter(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="field-label">Độ khó</span>
            <select className="field-input" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
              <option value={1}>Dễ</option>
              <option value={2}>Trung bình</option>
              <option value={3}>Khó</option>
            </select>
          </label>
          <label className="form-field">
            <span className="field-label">Điểm</span>
            <input className="field-input" type="number" step="0.25" min="0.25" value={points}
              onChange={(e) => setPoints(Number(e.target.value))} />
          </label>
        </div>

        {questionType === 'MCQ_4' && (
          <div className="form-field">
            <span className="field-label">4 lựa chọn (chọn radio cho đáp án đúng)</span>
            {options.map((opt, idx) => (
              <div key={idx} className="admin-exam-option-row">
                <input type="radio" name="mcqCorrect" checked={mcqCorrect === idx} onChange={() => setMcqCorrect(idx)} />
                <span className="opt-label">{OPTION_LABELS[idx]}</span>
                <input className="field-input" value={opt}
                  onChange={(e) => setOptions((o) => o.map((v, i) => i === idx ? e.target.value : v))} />
              </div>
            ))}
          </div>
        )}

        {questionType === 'TRUE_FALSE_4' && (
          <div className="form-field">
            <span className="field-label">4 phát biểu (chọn Đúng/Sai cho từng ý)</span>
            {options.map((opt, idx) => (
              <div key={idx} className="admin-exam-option-row">
                <input className="field-input" value={opt} placeholder={`Phát biểu ${OPTION_LABELS[idx]}`}
                  onChange={(e) => setOptions((o) => o.map((v, i) => i === idx ? e.target.value : v))} />
                <div className="exam-tf-toggle">
                  <button type="button" className={`exam-tf-btn ${tfCorrect[idx] ? 'active-true' : ''}`}
                    onClick={() => setTfCorrect((c) => c.map((v, i) => i === idx ? true : v))}>
                    Đúng
                  </button>
                  <button type="button" className={`exam-tf-btn ${!tfCorrect[idx] ? 'active-false' : ''}`}
                    onClick={() => setTfCorrect((c) => c.map((v, i) => i === idx ? false : v))}>
                    Sai
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {questionType === 'FILL_BLANK' && (
          <label className="form-field">
            <span className="field-label">Đáp án chấp nhận (phân tách bởi "|", ví dụ: Hà Nội|Ha Noi)</span>
            <input className="field-input" value={fillAnswers} onChange={(e) => setFillAnswers(e.target.value)} />
          </label>
        )}

        <label className="form-field">
          <span className="field-label">Giải thích (tuỳ chọn)</span>
          <textarea className="report-desc" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </label>

        <div className="admin-exam-row3">
          <label className="form-field">
            <span className="field-label">Năm thi (tuỳ chọn)</span>
            <input className="field-input" type="number" value={examYear} onChange={(e) => setExamYear(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="field-label">Mã đề (tuỳ chọn)</span>
            <input className="field-input" value={examCode} onChange={(e) => setExamCode(e.target.value)} />
          </label>
        </div>

        {error && <p className="report-error">{error}</p>}

        <button className="btn-primary" disabled={busy} onClick={() => void handleSubmit()}>
          {busy && <Spinner />}{busy ? 'Đang lưu…' : 'Thêm câu hỏi'}
        </button>
      </div>
    </section>
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
