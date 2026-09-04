import { useState, useEffect, useRef } from 'react';
import {
  startExam, getActiveExamSession, submitExam, abandonExam, getMyProfile, ApiError,
} from '../../lib/api.js';
import type {
  UserProfile, StartExamResult, ExamAnswerValue, SubmitExamResult,
  ActiveExamSession as ActiveExamSessionInfo,
} from '../../lib/api.js';
import { SUBJECTS_MAP } from '../../lib/constants.js';
import Spinner from '../../components/Spinner.js';
import { defaultAnswerFor, toSubmitAnswer, loadDraftAnswers, saveDraftAnswers, clearDraftAnswers } from './examUtils.js';
import ExamSessionScreen from './ExamSessionScreen.js';
import ExamResultScreen from './ExamResultScreen.js';

type ExamSub = 'hub' | 'session' | 'result';

export interface ActiveExamSession {
  data: StartExamResult;
  answers: Map<string, ExamAnswerValue>;
}

function ExamPage({
  profile, sessionToken, onBack, onProfileUpdate, onError, initialResume, onResumeClear,
}: {
  profile: UserProfile;
  sessionToken: string;
  onBack: () => void;
  onProfileUpdate: (p: UserProfile) => void;
  onError: (e: unknown) => void;
  initialResume?: ActiveExamSessionInfo | null;
  onResumeClear?: () => void;
}) {
  const [sub, setSub]           = useState<ExamSub>('hub');
  const [session, setSession]   = useState<ActiveExamSession | null>(null);
  const [result, setResult]     = useState<SubmitExamResult | null>(null);
  const [loadingSubj, setLoadingSubj] = useState('');
  const [hubError, setHubError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [submitting, setSubmitting]   = useState(false);

  // Nếu đã có resumeAlert từ ProfilePage thì dùng ngay, không cần gọi API lại
  const [resumeCandidate, setResumeCandidate] = useState<ActiveExamSessionInfo | null>(initialResume ?? null);
  // Không cần kiểm tra nếu đã có dữ liệu từ App-level
  const [checkingActive, setCheckingActive]   = useState(!initialResume);
  // Ref chống StrictMode double-invoke: đảm bảo handleResume chỉ chạy đúng 1 lần
  const resumeAttempted = useRef(false);

  // Kiểm tra hoặc tự động resume khi mount
  useEffect(() => {
    if (initialResume) {
      // Đã xác nhận từ ProfilePage → auto resume, không hỏi lại
      // Guard chống StrictMode gọi effect 2 lần (dev mode)
      if (resumeAttempted.current) return;
      resumeAttempted.current = true;
      void handleResume(initialResume);
      return;
    }
    // Chưa có info → gọi API kiểm tra (user vào thẳng trang thi)
    let cancelled = false;
    void getActiveExamSession(sessionToken)
      .then(({ session: active }) => {
        if (cancelled) return;
        if (active) setResumeCandidate(active);
      })
      .catch(() => { /* bỏ qua lỗi mạng, không block UI */ })
      .finally(() => { if (!cancelled) setCheckingActive(false); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Người dùng chọn "Tiếp tục" bài thi đang dở. */
  async function handleResume(active: ActiveExamSessionInfo) {
    setCheckingActive(true);
    setHubError('');
    try {
      // Kiểm tra còn giờ không
      const expiryMs = new Date(active.startedAt).getTime() + active.durationMinutes * 60_000;
      const msLeft = expiryMs - Date.now();

      if (msLeft <= 0) {
        // Hết giờ → nộp luôn với đáp án đã lưu
        const savedAnswers = loadDraftAnswers(active.id);
        setSubmitting(true);
        try {
          const answerList = Array.from(savedAnswers.entries()).map(([qId, val]) => ({
            examQuestionId: qId,
            selectedAnswer: val,
          }));
          const res = await submitExam(sessionToken, active.id, answerList);
          clearDraftAnswers(active.id);
          setResult(res);
          void getMyProfile(sessionToken).then(onProfileUpdate).catch(() => {});
          setResumeCandidate(null);
          setSub('result');
        } catch {
          // Backend từ chối (quá grace 30s) → abandon và về hub sạch (không hiện lỗi)
          try { await abandonExam(sessionToken, active.id); } catch { /* bỏ qua */ }
          clearDraftAnswers(active.id);
          setResumeCandidate(null);
          onResumeClear?.();
          // Không set hubError — user đã thấy kết quả (nếu nộp thành công trước đó)
          // hoặc đơn giản hết giờ mà không có gì để nộp → về hub im lặng
        } finally {
          setSubmitting(false);
        }
        return;
      }

      // Còn giờ → cần lấy lại đề thi từ server để build lại session UI
      // Dùng startExam sẽ tạo phiên MỚI nên không dùng được.
      // Thay vào đó: gọi abandon phiên cũ rồi để user tự bấm bắt đầu.
      // Nhưng user đã chọn "Tiếp tục" — ta cần dùng GET /api/exam/:id để lấy lại câu hỏi.
      // Backend chưa có endpoint đó → dùng workaround: lưu StartExamResult vào localStorage.
      // Kiểm tra xem có StartExamResult đã lưu không.
      const savedDataRaw = localStorage.getItem(`exam_session_data_${active.id}`);
      if (!savedDataRaw) {
        // Không có dữ liệu câu hỏi — abandon và bắt đầu bài mới
        try { await abandonExam(sessionToken, active.id); } catch { /* bỏ qua */ }
        clearDraftAnswers(active.id);
        setResumeCandidate(null);
        setHubError('Không thể khôi phục bài thi. Bạn có thể bắt đầu bài mới.');
        return;
      }

      const savedData = JSON.parse(savedDataRaw) as StartExamResult;
      const savedAnswers = loadDraftAnswers(active.id);
      setSession({ data: savedData, answers: savedAnswers });
      setResumeCandidate(null);
      setSub('session');
    } catch (err) {
      onError(err);
    } finally {
      setCheckingActive(false);
    }
  }

  /** Người dùng chọn "Huỷ bài" từ dialog resume → abandon phiên cũ. */
  async function handleAbandonFromResume(active: ActiveExamSessionInfo) {
    setCheckingActive(true);
    try {
      await abandonExam(sessionToken, active.id);
      clearDraftAnswers(active.id);
      localStorage.removeItem(`exam_session_data_${active.id}`);
    } catch { /* bỏ qua lỗi, session có thể đã hết hạn */ }
    setResumeCandidate(null);
    onResumeClear?.(); // Xóa resumeAlert ở App-level
    setCheckingActive(false);
  }

  async function handleStart(subject: string) {
    setLoadingSubj(subject);
    setHubError('');
    try {
      const data = await startExam(sessionToken, subject);
      // TASK 4: Lưu toàn bộ StartExamResult vào localStorage để có thể resume
      try {
        localStorage.setItem(`exam_session_data_${data.sessionId}`, JSON.stringify(data));
      } catch { /* bỏ qua */ }
      setSession({ data, answers: new Map() });
      setSub('session');
      void getMyProfile(sessionToken).then(onProfileUpdate).catch(() => {});
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EXAM_INSUFFICIENT_POINTS') {
        setHubError('Bạn cần tối thiểu 60 điểm tích lũy để vào thi thử.');
      } else if (err instanceof ApiError && err.code === 'EXAM_PAPER_EMPTY') {
        setHubError('Môn học này hiện chưa có đề thi thử. Vui lòng thử lại sau.');
      } else if (err instanceof ApiError && err.code === 'EXAM_SESSION_ALREADY_ACTIVE') {
        // Trường hợp này không nên xảy ra nữa vì ta đã kiểm tra getActiveExamSession trước
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
      // TASK 4: Lưu vào localStorage sau mỗi lần chọn đáp án
      saveDraftAnswers(s.data.sessionId, next);
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
      // Xóa draft sau khi nộp thành công
      clearDraftAnswers(session.data.sessionId);
      localStorage.removeItem(`exam_session_data_${session.data.sessionId}`);
      setResult(res);
      void getMyProfile(sessionToken).then(onProfileUpdate).catch(() => {});
      setSub('result');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EXAM_EXPIRED') {
        clearDraftAnswers(session.data.sessionId);
        localStorage.removeItem(`exam_session_data_${session.data.sessionId}`);
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

  // TASK 6: Xử lý khi user xác nhận thoát khỏi bài thi
  async function handleAbandonFromSession() {
    if (!session || submitting) return;
    setSubmitting(true);
    try {
      await abandonExam(sessionToken, session.data.sessionId);
      clearDraftAnswers(session.data.sessionId);
      localStorage.removeItem(`exam_session_data_${session.data.sessionId}`);
      setSession(null);
      setSub('hub');
      // Làm mới điểm vì đã mất điểm vào thi (không hoàn lại)
      void getMyProfile(sessionToken).then(onProfileUpdate).catch(() => {});
    } catch {
      // Nếu session đã expired/completed thì cũng coi như thoát thành công
      clearDraftAnswers(session.data.sessionId);
      localStorage.removeItem(`exam_session_data_${session.data.sessionId}`);
      setSession(null);
      setSub('hub');
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
        onAbandon={() => void handleAbandonFromSession()}
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
        onRetry={() => { setResult(null); setSession(null); setHubError(''); setSub('hub'); }}
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

      {/* TASK 5: Dialog hỏi tiếp tục bài thi đang dở */}
      {resumeCandidate && (
        <div className="exam-resume-banner" role="alert">
          <p className="exam-resume-msg">
            📋 Bạn có bài thi <strong>{resumeCandidate.title}</strong> đang dở
            {resumeCandidate.remainingSeconds > 0
              ? ` (còn ${Math.ceil(resumeCandidate.remainingSeconds / 60)} phút)`
              : ' (đã hết giờ)'}
            . Tiếp tục không?
          </p>
          <div className="exam-resume-actions">
            <button
              className="btn-primary btn-sm"
              disabled={checkingActive}
              onClick={() => void handleResume(resumeCandidate)}
            >
              {checkingActive ? <Spinner /> : 'Tiếp tục'}
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={checkingActive}
              onClick={() => void handleAbandonFromResume(resumeCandidate)}
            >
              Huỷ bài
            </button>
          </div>
        </div>
      )}

      {hubError && <p className="report-error admin-msg">{hubError}</p>}

      {checkingActive && !resumeCandidate && (
        <div style={{ textAlign: 'center', padding: '1rem' }}><Spinner /></div>
      )}

      <div className="practice-subjects">
        {subjects.map((s) => {
          const info = SUBJECTS_MAP[s.id] ?? { name: s.name, emoji: '📘' };
          const busy = loadingSubj === s.id;
          return (
            <button
              key={s.id}
              className="practice-subject-card"
              onClick={() => void handleStart(s.id)}
              disabled={!!loadingSubj || checkingActive || !!resumeCandidate}
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

export default ExamPage;
