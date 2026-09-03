import type { ExamQuestionPublic, ExamAnswerValue } from '../../lib/api.js';
import { DIFF_LABEL, OPTION_LABELS } from '../practice/practiceConstants.js';

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

export default ExamQuestionCard;
