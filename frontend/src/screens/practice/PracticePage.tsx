import { useState, useEffect } from 'react';
import {
  getPracticeStats, getPracticeHistory, startPracticeSession,
  answerQuestion, completeSession, getMyProfile,
} from '../../lib/api.js';
import type {
  UserProfile, StartSessionResult, AnswerResult, SubjectStat, HistoryItem, CompleteResult,
} from '../../lib/api.js';
import { SUBJECTS_MAP } from '../../lib/constants.js';
import Spinner from '../../components/Spinner.js';
import PracticeSessionScreen from './PracticeSessionScreen.js';
import PracticeResultScreen from './PracticeResultScreen.js';

type PracticeSub = 'hub' | 'session' | 'result';

export interface ActiveSession {
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

export default PracticePage;
