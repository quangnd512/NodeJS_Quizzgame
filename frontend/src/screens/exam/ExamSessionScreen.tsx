import { useState, useEffect, useRef } from 'react';
import type { ExamAnswerValue } from '../../lib/api.js';
import Spinner from '../../components/Spinner.js';
import { defaultAnswerFor } from './examUtils.js';
import ExamQuestionCard from './ExamQuestionCard.js';
import type { ActiveExamSession } from './ExamPage.js';

function ExamSessionScreen({
  session, onAnswerChange, onSubmit, onAbandon, submitting, submitError, onClearSubmitError,
}: {
  session: ActiveExamSession;
  onAnswerChange: (qId: string, value: ExamAnswerValue) => void;
  onSubmit: () => void;
  onAbandon: () => void;
  submitting: boolean;
  submitError?: string;
  onClearSubmitError?: () => void;
}) {
  const { data, answers } = session;
  // TASK 6: Trạng thái hộp xác nhận thoát
  const [showExitConfirm, setShowExitConfirm] = useState(false);

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

  // Auto-submit dua tren thoi gian thuc tu server (data.startedAt + durationMinutes),
  // khong phu thuoc vao timeLeft state de tranh race condition khi ExamPage re-render.
  // Dung ref de luon goi onSubmit moi nhat (tranh stale closure).
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => { onSubmitRef.current = onSubmit; }); // cap nhat ref sau moi render
  const autoSubmitted = useRef(false);
  useEffect(() => {
    const expiryMs = new Date(data.startedAt).getTime() + data.durationMinutes * 60_000;
    const msLeft = expiryMs - Date.now();
    if (msLeft <= 0) {
      // Da het gio luc component mount (vi du: resume phien cu)
      if (!autoSubmitted.current) {
        autoSubmitted.current = true;
        onSubmitRef.current();
      }
      return;
    }
    const id = setTimeout(() => {
      if (!autoSubmitted.current) {
        autoSubmitted.current = true;
        onSubmitRef.current();
      }
    }, msLeft);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const timerDanger = timeLeft < 60;

  return (
    <div className="screen practice-session">
      {/* TASK 6: Hộp xác nhận thoát */}
      {showExitConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <h3 className="modal-title">Thoát bài thi?</h3>
            <p className="modal-body">
              Bạn có chắc muốn thoát? Bài thi sẽ bị huỷ và bạn sẽ mất điểm đã đặt cược.
            </p>
            <div className="modal-actions">
              <button
                className="btn-danger"
                disabled={submitting}
                onClick={() => { setShowExitConfirm(false); onAbandon(); }}
              >
                {submitting ? <Spinner /> : 'Huỷ bài thi'}
              </button>
              <button
                className="btn-secondary"
                disabled={submitting}
                onClick={() => setShowExitConfirm(false)}
              >
                Ở lại
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ps-topbar">
        {/* TASK 6: Nút Thoát ở góc trái topbar */}
        <button
          className="btn-icon-exit"
          onClick={() => setShowExitConfirm(true)}
          disabled={submitting}
          title="Thoát bài thi"
        >
          ✕
        </button>
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

export default ExamSessionScreen;
