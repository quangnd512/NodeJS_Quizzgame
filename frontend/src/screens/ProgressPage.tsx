import { useState, useEffect } from 'react';
import { getProgressSummary, getExamHistory } from '../lib/api.js';
import type { UserProfile, ProgressSummary, PaginatedExamHistory, ExamHistoryItem } from '../lib/api.js';
import { SUBJECTS_MAP } from '../lib/constants.js';
import Spinner from '../components/Spinner.js';
import ScoreSparkline from '../components/ScoreSparkline.js';

const EXAM_PAGE_SIZE = 6;

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
    // Feature 015 (Free/Premium): Free bị khoá hoàn toàn "Lịch sử thi thử" —
    // không gọi API (backend cũng chặn 403 EXAM_HISTORY_PREMIUM_ONLY), tránh gọi vô ích.
    if (!profile.isPremium) {
      setExamLoading(false); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    setExamLoading(true);
    void getExamHistory(sessionToken, EXAM_PAGE_SIZE, examPage * EXAM_PAGE_SIZE)
      .then((data) => { setExamHistory(data); setExamLoading(false); })
      .catch((err) => { onError(err); setExamLoading(false); });
  }, [sessionToken, examPage, profile.isPremium]); // eslint-disable-line react-hooks/exhaustive-deps

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
              {/* Feature 015 (Free/Premium): CHỈ hiện cho Premium */}
              {summary.isPremium && (
                <>
                  <span className="pstat-sub">
                    🛡️ Thẻ bảo hiểm chuỗi: {summary.streakFreeze.remaining}/{summary.streakFreeze.granted}
                  </span>
                  {summary.premiumExpiresAt && (
                    <span className="pstat-sub">
                      ⭐ Premium đến {new Date(summary.premiumExpiresAt).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </>
              )}
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
            {!summary.isPremium ? (
              /* Feature 015 (Free/Premium): bổ sung theo yêu cầu người dùng — khoá
               * hoàn toàn cho Free, giống hệt pattern "Lịch sử thi thử". */
              <div className="premium-locked-banner">
                <p className="premium-locked-icon">⭐</p>
                <p className="premium-locked-title">Thống kê theo môn là quyền lợi Premium</p>
                <p className="premium-locked-sub">Nâng cấp Premium để xem thống kê chi tiết theo từng môn học.</p>
              </div>
            ) : summary.practiceStatsBySubject.length === 0 ? (
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
            {!summary.isPremium ? (
              /* Feature 015 (Free/Premium): bổ sung theo yêu cầu người dùng — khoá
               * hoàn toàn cho Free, giống hệt pattern "Lịch sử thi thử". */
              <div className="premium-locked-banner">
                <p className="premium-locked-icon">⭐</p>
                <p className="premium-locked-title">Xu hướng điểm là quyền lợi Premium</p>
                <p className="premium-locked-sub">Nâng cấp Premium để xem biểu đồ xu hướng điểm số theo thời gian.</p>
              </div>
            ) : summary.scoreTrend.length === 0 ? (
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
        {!profile.isPremium ? (
          /* Feature 015 (Free/Premium): ẩn hoàn toàn bảng, thay bằng banner nâng cấp */
          <div className="premium-locked-banner">
            <p className="premium-locked-icon">⭐</p>
            <p className="premium-locked-title">Lịch sử thi thử là quyền lợi Premium</p>
            <p className="premium-locked-sub">Nâng cấp Premium để xem lại toàn bộ lịch sử các lần thi thử của bạn.</p>
          </div>
        ) : examLoading ? (
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

export default ProgressPage;
export { EXAM_PAGE_SIZE };
