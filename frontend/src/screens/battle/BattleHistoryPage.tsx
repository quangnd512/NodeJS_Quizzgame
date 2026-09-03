import { useState, useEffect } from 'react';
import { getBattleHistory } from '../../lib/api.js';
import type { BattleHistoryItem, PaginatedBattleHistory, BattleResult } from '../../lib/api.js';
import { SUBJECTS_MAP } from '../../lib/constants.js';
import Spinner from '../../components/Spinner.js';
import { BATTLE_HISTORY_PAGE_SIZE, BATTLE_HISTORY_RESULT_LABEL } from './battleConstants.js';

function BattleHistoryPage({
  sessionToken, onBack, onError,
}: {
  sessionToken: string;
  onBack: () => void;
  onError: (e: unknown) => void;
}) {
  const [history, setHistory] = useState<PaginatedBattleHistory | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadHistory(): Promise<void> {
    setLoading(true);
    try {
      const data = await getBattleHistory(sessionToken, BATTLE_HISTORY_PAGE_SIZE, page * BATTLE_HISTORY_PAGE_SIZE);
      setHistory(data);
    } catch (err) {
      onError(err);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- loadHistory() goi API va setState de dong bo voi page (cung pattern voi AdminSubmissionsPage.load())
  useEffect(() => { void loadHistory(); }, [sessionToken, page]);

  const totalPages = history ? Math.ceil(history.total / BATTLE_HISTORY_PAGE_SIZE) : 0;

  return (
    <div className="screen screen-progress">
      <div className="page-header">
        <button className="btn-back" onClick={onBack}>← Quay lại</button>
        <h2 className="page-title">⚔️ Lịch sử thi đấu</h2>
      </div>

      <section className="card-section">
        {loading ? (
          <div className="progress-loading"><Spinner /> Đang tải…</div>
        ) : !history || history.items.length === 0 ? (
          <p className="empty">Chưa có trận đấu nào.</p>
        ) : (
          <>
            <div className="progress-table-wrap">
              <table className="progress-table">
                <thead>
                  <tr>
                    <th>Môn</th>
                    <th>Đối thủ</th>
                    <th>Tỉ số</th>
                    <th>Kết quả</th>
                    <th>Điểm</th>
                    <th>Ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {history.items.map((item: BattleHistoryItem) => {
                    const resultLabel = BATTLE_HISTORY_RESULT_LABEL[item.result as BattleResult];
                    return (
                      <tr key={item.id}>
                        <td>{SUBJECTS_MAP[item.subject]?.name ?? item.subject}</td>
                        {/* An hoan toan danh tinh bot khoi nguoi choi (quyet dinh san pham) -
                            KHONG con phan biet theo item.isBotMatch, luon hien opponentName
                            (backend da tra ve ten gia GIONG NGUOI THAT cho tran voi bot). */}
                        <td>{item.opponentName ?? 'Người chơi'}</td>
                        <td>{item.myScore} - {item.opponentScore}</td>
                        <td>
                          <span className={`exam-score-badge ${resultLabel.cls}`}>
                            {resultLabel.text}
                          </span>
                        </td>
                        <td style={{ color: item.pointsChange >= 0 ? 'var(--success,#22a06b)' : 'var(--color-error,#e53)' }}>
                          {item.pointsChange >= 0 ? '+' : ''}{item.pointsChange.toLocaleString('vi-VN')}
                        </td>
                        <td className="exam-history-date">{new Date(item.completedAt).toLocaleDateString('vi-VN')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="admin-pagination">
                <button className="btn-secondary" disabled={page <= 0 || loading} onClick={() => setPage((p) => p - 1)}>← Trước</button>
                <span>Trang {page + 1}/{totalPages}</span>
                <button className="btn-secondary" disabled={page >= totalPages - 1 || loading} onClick={() => setPage((p) => p + 1)}>Sau →</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default BattleHistoryPage;
