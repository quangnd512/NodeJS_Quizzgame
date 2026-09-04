import { useState, useEffect } from 'react';
import {
  adminGetReportsSummary, adminListReports, adminGetReportFacets, adminResolveReport, ApiError,
} from '../../lib/api.js';
import type {
  QuestionReportDto, ReportsSummary, ReportFilterFacets, ResolveReportQuestionUpdate,
} from '../../lib/api.js';
import { SUBJECTS } from '../../lib/constants.js';
import Spinner from '../../components/Spinner.js';
import { REPORT_REASONS } from '../practice/practiceConstants.js';
import { ADMIN_PAGE_SIZE, REPORT_STATUS_LABEL, REPORT_REASON_LABEL } from './adminConstants.js';

function AdminReportsPage({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [items, setItems] = useState<QuestionReportDto[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [facets, setFacets] = useState<ReportFilterFacets | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [s, r, f] = await Promise.all([
        adminGetReportsSummary(secret),
        adminListReports(secret, {
          status: statusFilter || undefined,
          subject: subjectFilter || undefined,
          reason: reasonFilter || undefined,
          page,
          limit: ADMIN_PAGE_SIZE,
        }),
        // Loc lien dong: tinh cac gia tri con kha dung cho tung dropdown dua tren
        // 2 dieu kien loc con lai (khong tinh theo chinh dropdown do).
        adminGetReportFacets(secret, {
          status: statusFilter || undefined,
          subject: subjectFilter || undefined,
          reason: reasonFilter || undefined,
        }),
      ]);
      setSummary(s);
      setItems(r.items);
      setTotal(r.total);
      setFacets(f);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- load() goi API va setState de dong bo voi bo loc/page
  useEffect(() => { void load(); }, [statusFilter, subjectFilter, reasonFilter, page]);

  async function handleDismiss(reportId: string) {
    setBusyId(reportId);
    setNotice('');
    setError('');
    try {
      const result = await adminResolveReport(secret, reportId, 'DISMISSED');
      setNotice(
        result.batchResolvedCount > 0
          ? `Đã bỏ qua báo cáo (kèm ${result.batchResolvedCount} báo cáo trùng khác của cùng câu hỏi).`
          : 'Đã bỏ qua báo cáo.',
      );
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
      {summary && (
        <div className="admin-stats">
          <div className="admin-stat-card">
            <span className="admin-stat-num">{summary.pendingReports}</span>
            <span className="admin-stat-label">Báo cáo chờ xử lý</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-num">{summary.pendingQuestions}</span>
            <span className="admin-stat-label">Câu hỏi bị báo cáo</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-num">{summary.fixed}</span>
            <span className="admin-stat-label">Đã sửa</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-num">{summary.dismissed}</span>
            <span className="admin-stat-label">Đã bỏ qua</span>
          </div>
        </div>
      )}

      <div className="admin-filter" style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        <select
          className="field-input"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tất cả trạng thái</option>
          {(['PENDING', 'FIXED', 'DISMISSED'] as const)
            .filter((s) => !facets || facets.statuses.includes(s) || s === statusFilter)
            .map((s) => <option key={s} value={s}>{REPORT_STATUS_LABEL[s] ?? s}</option>)}
        </select>
        <select
          className="field-input"
          value={subjectFilter}
          onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tất cả môn</option>
          {SUBJECTS
            .filter((s) => !facets || facets.subjects.includes(s.id) || s.id === subjectFilter)
            .map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
        </select>
        <select
          className="field-input"
          value={reasonFilter}
          onChange={(e) => { setReasonFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tất cả lý do</option>
          {REPORT_REASONS
            .filter((r) => !facets || facets.reasons.includes(r.value) || r.value === reasonFilter)
            .map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {error && <p className="report-error admin-msg">{error}</p>}
      {notice && <p className="admin-notice admin-msg">{notice}</p>}

      {loading ? (
        <div className="screen-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="empty admin-msg">Không có báo cáo nào.</p>
      ) : (
        <div className="admin-report-list">
          {items.map((r) => (
            editingId === r.id ? (
              <AdminReportResolveForm
                key={r.id}
                secret={secret}
                report={r}
                onDone={(msg) => { setNotice(msg); setEditingId(null); void load(); }}
                onCancel={() => setEditingId(null)}
                onError={(msg) => setError(msg)}
              />
            ) : (
              <div key={r.id} className="admin-report-row">
                <div className="admin-report-top">
                  <span className={`admin-status-badge status-${r.status.toLowerCase()}`}>
                    {REPORT_STATUS_LABEL[r.status] ?? r.status}
                  </span>
                  <span className="admin-report-reason">{REPORT_REASON_LABEL[r.reason] ?? r.reason}</span>
                  <span className="admin-report-reason">
                    {SUBJECTS.find((s) => s.id === r.question.subject)?.name ?? r.question.subject}
                  </span>
                  {!r.question.isActive && (
                    <span className="admin-status-badge" style={{ background: '#fee2e2', color: '#991b1b' }}>
                      Đang bị ẩn
                    </span>
                  )}
                </div>
                <p className="admin-report-q" style={{ fontWeight: 600 }}>{r.question.question}</p>
                <ul style={{ paddingLeft: '1.25rem', margin: '.35rem 0' }}>
                  {r.question.options.map((opt, i) => (
                    <li key={i} style={{
                      color: i === r.question.correctAnswer ? '#16a34a' : undefined,
                      fontWeight: i === r.question.correctAnswer ? 700 : 400,
                    }}>
                      {String.fromCharCode(65 + i)}. {opt}{i === r.question.correctAnswer && ' ✓'}
                    </li>
                  ))}
                </ul>
                {r.description && <p className="admin-report-desc">Học sinh ghi chú: {r.description}</p>}
                <p className="admin-report-time">{new Date(r.createdAt).toLocaleString('vi-VN')}</p>
                {r.status === 'PENDING' && (
                  <div className="admin-report-actions">
                    <button className="btn-secondary" disabled={busyId === r.id} onClick={() => setEditingId(r.id)}>
                      ✏️ Sửa & Đánh dấu đã sửa
                    </button>
                    <button className="btn-secondary" disabled={busyId === r.id} onClick={() => void handleDismiss(r.id)}>
                      Bỏ qua
                    </button>
                  </div>
                )}
              </div>
            )
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
    </div>
  );
}

/** Form sửa nội dung câu hỏi tại chỗ (pre-fill từ Question) — dùng khi admin bấm "Sửa & Đánh dấu đã sửa". */
function AdminReportResolveForm({
  secret, report, onDone, onCancel, onError,
}: {
  secret: string;
  report: QuestionReportDto;
  onDone: (message: string) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const q = report.question;
  const [subject, setSubject] = useState(q.subject);
  const [chapter, setChapter] = useState(q.chapter ?? '');
  const [difficulty, setDifficulty] = useState(q.difficulty);
  const [questionText, setQuestionText] = useState(q.question);
  const [options, setOptions] = useState<[string, string, string, string]>(
    [q.options[0] ?? '', q.options[1] ?? '', q.options[2] ?? '', q.options[3] ?? ''],
  );
  const [correctAnswer, setCorrectAnswer] = useState(q.correctAnswer);
  const [explanation, setExplanation] = useState(q.explanation ?? '');
  const [busy, setBusy] = useState(false);

  function updateOption(i: number, value: string) {
    setOptions((prev) => {
      const next = [...prev] as [string, string, string, string];
      next[i] = value;
      return next;
    });
  }

  /** Chỉ gửi các field THỰC SỰ thay đổi — tránh tạo snapshot question_edit_history vô ích. */
  function buildQuestionUpdate(): ResolveReportQuestionUpdate | undefined {
    const update: ResolveReportQuestionUpdate = {};
    if (subject !== q.subject) update.subject = subject;
    if (chapter !== (q.chapter ?? '')) update.chapter = chapter.trim() || null;
    if (difficulty !== q.difficulty) update.difficulty = difficulty;
    if (questionText.trim() !== q.question) update.question = questionText.trim();
    if (JSON.stringify(options) !== JSON.stringify(q.options)) {
      update.options = options.map((o) => o.trim()) as [string, string, string, string];
    }
    if (correctAnswer !== q.correctAnswer) update.correctAnswer = correctAnswer;
    if (explanation.trim() !== (q.explanation ?? '')) update.explanation = explanation.trim() || null;
    return Object.keys(update).length > 0 ? update : undefined;
  }

  async function handleSaveFixed() {
    setBusy(true);
    try {
      const questionUpdate = buildQuestionUpdate();
      const result = await adminResolveReport(secret, report.id, 'FIXED', questionUpdate);
      const parts = [
        result.batchResolvedCount > 0
          ? `Đã đánh dấu đã sửa (kèm ${result.batchResolvedCount} báo cáo trùng khác của cùng câu hỏi).`
          : 'Đã đánh dấu đã sửa.',
      ];
      if (result.reactivated) parts.push('Câu hỏi đã được hiện lại (trước đó bị ẩn tự động do vượt ngưỡng báo cáo).');
      onDone(parts.join(' '));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss() {
    setBusy(true);
    try {
      const result = await adminResolveReport(secret, report.id, 'DISMISSED');
      onDone(
        result.batchResolvedCount > 0
          ? `Đã bỏ qua (kèm ${result.batchResolvedCount} báo cáo trùng khác của cùng câu hỏi).`
          : 'Đã bỏ qua báo cáo.',
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-report-row" style={{ border: '2px solid #6366f1' }}>
      <p style={{ fontWeight: 600, margin: '0 0 .5rem' }}>Sửa nội dung câu hỏi</p>
      <label className="form-field">
        <span className="field-label">Môn học</span>
        <select className="field-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
          {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
        </select>
      </label>
      <label className="form-field">
        <span className="field-label">Chương/chủ đề</span>
        <input className="field-input" value={chapter} onChange={(e) => setChapter(e.target.value)} />
      </label>
      <label className="form-field">
        <span className="field-label">Độ khó</span>
        <select className="field-input" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
          <option value={1}>Dễ</option>
          <option value={2}>Trung bình</option>
          <option value={3}>Khó</option>
        </select>
      </label>
      <label className="form-field">
        <span className="field-label">Nội dung câu hỏi</span>
        <textarea className="field-input" rows={3} value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
      </label>
      <span className="field-label" style={{ display: 'block', marginTop: '.5rem' }}>4 đáp án (chọn ô tròn cho đáp án đúng)</span>
      {options.map((opt, i) => (
        <label key={i} className="form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '.5rem' }}>
          <input type="radio" name={`correct-${report.id}`} checked={correctAnswer === i} onChange={() => setCorrectAnswer(i)} />
          <input className="field-input" style={{ flex: 1 }} value={opt} onChange={(e) => updateOption(i, e.target.value)} />
        </label>
      ))}
      <label className="form-field">
        <span className="field-label">Giải thích (tuỳ chọn)</span>
        <textarea className="field-input" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </label>
      <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem', flexWrap: 'wrap' }}>
        <button className="btn-primary" disabled={busy} onClick={() => void handleSaveFixed()}>
          {busy ? <><Spinner /> Đang lưu…</> : 'Lưu & Đánh dấu đã sửa'}
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => void handleDismiss()}>Bỏ qua</button>
        <button className="btn-secondary" disabled={busy} onClick={onCancel}>Huỷ</button>
      </div>
    </div>
  );
}

export default AdminReportsPage;
