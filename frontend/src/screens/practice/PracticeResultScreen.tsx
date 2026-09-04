import type { CompleteResult } from '../../lib/api.js';

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

export default PracticeResultScreen;
