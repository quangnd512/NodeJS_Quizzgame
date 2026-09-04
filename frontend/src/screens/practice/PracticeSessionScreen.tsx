import { useState, useEffect } from 'react';
import { reportQuestion, ApiError } from '../../lib/api.js';
import Spinner from '../../components/Spinner.js';
import { DIFF_LABEL, SESSION_SECONDS, OPTION_LABELS, REPORT_REASONS } from './practiceConstants.js';
import type { ActiveSession } from './PracticePage.js';

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

  async function sendReport(reason: typeof REPORT_REASONS[number]['value'], confirmResubmit = false) {
    if (!question) return;
    setReportError('');
    try {
      await reportQuestion(sessionToken, question.id, reason, reportDesc.trim() || undefined, confirmResubmit);
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
      if (err instanceof ApiError && err.code === 'REPORT_RESUBMIT_CONFIRM_REQUIRED') {
        // Bao cao truoc do da duoc xu ly xong (FIXED/DISMISSED) - hoi xac nhan
        // truoc khi tao bao cao MOI (khong ghi de bao cao cu).
        if (confirm('Bạn đã báo cáo câu hỏi này rồi (đã được xử lý). Bạn có muốn báo cáo lại không?')) {
          void sendReport(reason, true);
        }
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

export default PracticeSessionScreen;
