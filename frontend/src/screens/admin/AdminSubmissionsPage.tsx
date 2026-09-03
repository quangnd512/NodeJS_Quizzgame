import { useState, useEffect } from 'react';
import {
  adminListSubmissions, adminApproveSubmission, adminRejectSubmission, ApiError,
} from '../../lib/api.js';
import type {
  AdminSubmissionListItem, ExamQuestionType, SubmissionCorrectAnswer,
} from '../../lib/api.js';
import { SUBJECTS } from '../../lib/constants.js';
import Spinner from '../../components/Spinner.js';
import { OPTION_LABELS } from '../practice/practiceConstants.js';
import { ADMIN_PAGE_SIZE, ADMIN_SUBMISSION_STATUSES, QUESTION_TYPE_LABEL } from './adminConstants.js';
import { SUBMISSION_STATUS_LABEL } from '../submissionsConstants.js';
import AdminReportsPage from './AdminReportsPage.js';

// ─── AdminQuestionManagementPage — gộp "Bài học sinh gửi" + "Báo cáo lỗi" ────────

type AdminQuestionSub = 'submissions' | 'reports';

export function AdminQuestionManagementPage({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [sub, setSub] = useState<AdminQuestionSub>('submissions');

  return (
    <div className="screen screen-admin">
      <div className="admin-header">
        <h2 className="page-title">Quản lý câu hỏi</h2>
        <button className="btn-link" onClick={onLogout}>Đăng xuất</button>
      </div>

      <div className="admin-tabs" style={{ marginBottom: '1rem' }}>
        <button className={`admin-tab ${sub === 'submissions' ? 'active' : ''}`} onClick={() => setSub('submissions')}>
          Bài học sinh gửi
        </button>
        <button className={`admin-tab ${sub === 'reports' ? 'active' : ''}`} onClick={() => setSub('reports')}>
          Báo cáo lỗi
        </button>
      </div>

      {sub === 'submissions' && <AdminSubmissionsPage secret={secret} onLogout={onLogout} />}
      {sub === 'reports' && <AdminReportsPage secret={secret} onLogout={onLogout} />}
    </div>
  );
}

// ─── AdminSubmissionsPage — duyệt câu hỏi học sinh gửi ───────────────────────────

function AdminSubmissionsPage({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [items, setItems] = useState<AdminSubmissionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [detailItem, setDetailItem] = useState<AdminSubmissionListItem | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await adminListSubmissions(secret, { status: statusFilter || undefined, page, limit: ADMIN_PAGE_SIZE });
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

  async function handleApprove(id: string) {
    setBusyId(id);
    setNotice('');
    setError('');
    try {
      await adminApproveSubmission(secret, id);
      setNotice('Đã duyệt câu hỏi — thêm vào ngân hàng câu hỏi + thưởng 30 điểm cho học sinh.');
      setDetailItem(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusyId('');
    }
  }

  async function handleReject(id: string) {
    if (!rejectNote.trim()) { setError('Vui lòng nhập lý do từ chối.'); return; }
    setBusyId(id);
    setNotice('');
    setError('');
    try {
      await adminRejectSubmission(secret, id, rejectNote.trim());
      setNotice('Đã từ chối câu hỏi.');
      setRejectingId(null);
      setRejectNote('');
      setDetailItem(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusyId('');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <div>
      <div className="admin-filter">
        <select
          className="field-input"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tất cả trạng thái</option>
          {ADMIN_SUBMISSION_STATUSES.map((s) => (
            <option key={s} value={s}>{SUBMISSION_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {error && <p className="report-error admin-msg">{error}</p>}
      {notice && <p className="admin-notice admin-msg">{notice}</p>}

      {loading ? (
        <div className="screen-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="empty admin-msg">Không có câu hỏi nào.</p>
      ) : (
        <div className="admin-report-list">
          {items.map((item) => (
            <div key={item.id} className="admin-report-row">
              <div className="admin-report-top">
                <span className={`admin-status-badge status-${item.status.toLowerCase()}`}>
                  {SUBMISSION_STATUS_LABEL[item.status]}
                </span>
                <span className="admin-report-reason">
                  {SUBJECTS.find((s) => s.id === item.subject)?.name ?? item.subject}
                </span>
                {item.duplicateWarning && (
                  <span
                    className="admin-status-badge"
                    style={{ background: '#fef3c7', color: '#92400e' }}
                    title={`Trùng với: "${item.duplicateWarning.questionText}"`}
                  >
                    ⚠️ Có thể trùng ({Math.round(item.duplicateWarning.similarity * 100)}%)
                  </span>
                )}
              </div>
              {item.duplicateWarning && (
                <p style={{ margin: '.25rem 0 0', fontSize: '.78rem', color: '#92400e' }}>
                  Trùng với câu trong kho: "{item.duplicateWarning.questionText}"
                </p>
              )}
              <p className="admin-report-q">{item.questionText}</p>
              <p className="admin-report-time">{new Date(item.createdAt).toLocaleString('vi-VN')}</p>
              <div className="admin-report-actions">
                <button className="btn-secondary" onClick={() => setDetailItem(item)}>Xem chi tiết</button>
                {item.status === 'PENDING' && (
                  <>
                    <button className="btn-secondary" disabled={busyId === item.id} onClick={() => void handleApprove(item.id)}>
                      ✅ Duyệt
                    </button>
                    <button className="btn-secondary" disabled={busyId === item.id} onClick={() => setRejectingId(item.id)}>
                      ❌ Từ chối
                    </button>
                  </>
                )}
              </div>
              {rejectingId === item.id && (
                <div style={{ marginTop: '.5rem', display: 'flex', gap: '.5rem' }}>
                  <input
                    className="field-input"
                    style={{ flex: 1 }}
                    placeholder="Lý do từ chối..."
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  />
                  <button className="btn-primary" disabled={busyId === item.id} onClick={() => void handleReject(item.id)}>Gửi</button>
                  <button className="btn-secondary" onClick={() => { setRejectingId(null); setRejectNote(''); }}>Huỷ</button>
                </div>
              )}
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

      {/* Modal xem chi tiết */}
      {detailItem && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setDetailItem(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 className="modal-title">Chi tiết câu hỏi gửi</h3>
            <p>
              <strong>Môn:</strong> {SUBJECTS.find((s) => s.id === detailItem.subject)?.name ?? detailItem.subject}
              {detailItem.chapter ? ` · ${detailItem.chapter}` : ''}
            </p>
            <p style={{ fontWeight: 600 }}>{detailItem.questionText}</p>
            <p style={{ fontSize: '.8rem', color: '#64748b', marginTop: '-.5rem', marginBottom: '.5rem' }}>
              Dạng: {QUESTION_TYPE_LABEL[detailItem.questionType]}
            </p>
            <SubmissionAnswerPreview item={detailItem} />
            {detailItem.duplicateWarning && (
              <div style={{ color: '#92400e', background: '#fef3c7', padding: '.5rem .75rem', borderRadius: 8 }}>
                <p style={{ margin: 0 }}>
                  ⚠️ Có thể trùng với câu hỏi đã có trong kho (độ tương đồng {Math.round(detailItem.duplicateWarning.similarity * 100)}%):
                </p>
                <p style={{ margin: '.35rem 0 0', fontStyle: 'italic', fontWeight: 600 }}>
                  "{detailItem.duplicateWarning.questionText}"
                </p>
                <div style={{ marginTop: '.35rem' }}>
                  <SubmissionAnswerPreview item={detailItem.duplicateWarning} />
                </div>
              </div>
            )}
            <div className="modal-actions">
              {detailItem.status === 'PENDING' && (
                <>
                  <button className="btn-primary" disabled={busyId === detailItem.id} onClick={() => void handleApprove(detailItem.id)}>
                    ✅ Duyệt
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={busyId === detailItem.id}
                    onClick={() => { setRejectingId(detailItem.id); setDetailItem(null); }}
                  >❌ Từ chối</button>
                </>
              )}
              <button className="btn-secondary" onClick={() => setDetailItem(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Hình dạng tối thiểu cần có để hiện đáp án — dùng chung cho SubmissionDto,
 * AdminSubmissionListItem, và DuplicateWarning (câu trùng trong kho). */
type AnswerPreviewShape = {
  questionType: ExamQuestionType;
  options: string[] | null;
  correctAnswer: SubmissionCorrectAnswer;
};

/** Hiện đáp án đúng theo đúng dạng câu hỏi (MCQ_4 / TRUE_FALSE_4 / FILL_BLANK) — dùng
 * trong modal chi tiết bài học sinh gửi, và cả để hiện câu trùng trong kho. */
function SubmissionAnswerPreview({ item }: { item: AnswerPreviewShape }) {
  if (item.questionType === 'MCQ_4' && item.options) {
    const correct = typeof item.correctAnswer === 'number' ? item.correctAnswer : -1;
    return (
      <ul style={{ paddingLeft: '1.25rem' }}>
        {item.options.map((opt, i) => (
          <li key={i} style={{ color: i === correct ? '#16a34a' : undefined, fontWeight: i === correct ? 700 : 400 }}>
            {OPTION_LABELS[i]}. {opt}{i === correct && ' ✓'}
          </li>
        ))}
      </ul>
    );
  }
  if (item.questionType === 'TRUE_FALSE_4' && item.options) {
    const answers = Array.isArray(item.correctAnswer) ? item.correctAnswer as boolean[] : [];
    return (
      <ul style={{ paddingLeft: '1.25rem' }}>
        {item.options.map((opt, i) => (
          <li key={i}>{OPTION_LABELS[i]}. {opt} — <strong>{answers[i] ? 'Đúng' : 'Sai'}</strong></li>
        ))}
      </ul>
    );
  }
  // FILL_BLANK
  const answers = Array.isArray(item.correctAnswer) ? item.correctAnswer as string[] : [];
  return (
    <p style={{ fontSize: '.875rem' }}>
      Đáp án chấp nhận: <strong>{answers.join(' | ')}</strong>
    </p>
  );
}

export default AdminSubmissionsPage;
