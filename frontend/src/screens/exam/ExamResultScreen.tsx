import { useState, useEffect } from 'react';
import { getExamResult } from '../../lib/api.js';
import type { SubmitExamResult, ExamResult } from '../../lib/api.js';
import Spinner from '../../components/Spinner.js';
import { describeExamAnswer } from './examUtils.js';

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

export default ExamResultScreen;
