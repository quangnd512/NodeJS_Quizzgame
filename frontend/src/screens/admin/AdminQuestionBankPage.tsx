import { useState, useEffect } from 'react';
import {
  adminListQuestionBank, adminCreateQuestionBankItem, adminUpdateQuestionBankItem,
  adminDeleteQuestionBankItem, adminGetQuestionBankUsage, ApiError,
} from '../../lib/api.js';
import type { ExamQuestionType, QuestionBankItem, QuestionBankUsage } from '../../lib/api.js';
import { SUBJECTS, SUBJECTS_MAP } from '../../lib/constants.js';
import Spinner from '../../components/Spinner.js';
import { DIFF_LABEL, OPTION_LABELS } from '../practice/practiceConstants.js';
import { QB_PAGE_SIZE, QUESTION_TYPE_LABEL } from './adminConstants.js';

function AdminQuestionBankPage({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterSubject, setFilterSubject] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<QuestionBankItem | null>(null);
  const [formError, setFormError] = useState('');
  const [formBusy, setFormBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<QuestionBankItem | null>(null);
  const [usage, setUsage] = useState<QuestionBankUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageFailed, setUsageFailed] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [form, setForm] = useState({
    subject: SUBJECTS[0]!.id,
    chapter: '',
    difficulty: 1,
    questionType: 'MCQ_4' as ExamQuestionType,
    points: 0.25,
    questionText: '',
    options: ['', '', '', ''] as string[],
    mcqCorrect: 0,
    tfCorrect: [true, true, true, true] as boolean[],
    fillAnswers: '',
    explanation: '',
    examYear: '',
    examCode: '',
  });

  async function load(pg = page) {
    setLoading(true);
    setError('');
    try {
      const res = await adminListQuestionBank(secret, {
        subject: filterSubject || undefined,
        difficulty: filterDifficulty ? Number(filterDifficulty) : undefined,
        search: filterSearch || undefined,
        page: pg,
        pageSize: QB_PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { onLogout(); return; }
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { void load(1); setPage(1); }, [filterSubject, filterDifficulty, filterSearch]);
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { void load(page); }, [page]);

  function resetForm(item?: QuestionBankItem) {
    if (item) {
      const mcqCorrect = item.questionType === 'MCQ_4' && typeof item.correctAnswer === 'number' ? item.correctAnswer : 0;
      const tfCorrect = item.questionType === 'TRUE_FALSE_4' && Array.isArray(item.correctAnswer) && item.correctAnswer.length === 4
        ? (item.correctAnswer as boolean[]) : [true, true, true, true];
      const fillAnswers = item.questionType === 'FILL_BLANK' && Array.isArray(item.correctAnswer)
        ? (item.correctAnswer as string[]).join(' | ') : '';
      setForm({
        subject: item.subject,
        chapter: item.chapter ?? '',
        difficulty: item.difficulty,
        questionType: item.questionType,
        points: item.points,
        questionText: item.questionText,
        options: (item.options && item.options.length === 4) ? [...item.options] : ['', '', '', ''],
        mcqCorrect,
        tfCorrect: tfCorrect as boolean[],
        fillAnswers,
        explanation: item.explanation ?? '',
        examYear: item.examYear ? String(item.examYear) : '',
        examCode: item.examCode ?? '',
      });
    } else {
      setForm({
        subject: SUBJECTS[0]!.id,
        chapter: '',
        difficulty: 1,
        questionType: 'MCQ_4',
        points: 0.25,
        questionText: '',
        options: ['', '', '', ''],
        mcqCorrect: 0,
        tfCorrect: [true, true, true, true],
        fillAnswers: '',
        explanation: '',
        examYear: '',
        examCode: '',
      });
    }
    setFormError('');
  }

  function openCreate() {
    setEditingItem(null);
    resetForm();
    setShowForm(true);
  }

  function openEdit(item: QuestionBankItem) {
    setEditingItem(item);
    resetForm(item);
    setShowForm(true);
  }

  async function handleSubmitForm() {
    if (formBusy) return;
    if (!form.questionText.trim()) { setFormError('Vui lòng nhập nội dung câu hỏi.'); return; }

    let correctAnswer: unknown;
    let options: string[] | undefined;
    if (form.questionType === 'MCQ_4') {
      const opts = form.options.map((o) => o.trim());
      if (opts.some((o) => !o)) { setFormError('Vui lòng nhập đủ 4 lựa chọn.'); return; }
      options = opts;
      correctAnswer = form.mcqCorrect;
    } else if (form.questionType === 'TRUE_FALSE_4') {
      const opts = form.options.map((o) => o.trim());
      if (opts.some((o) => !o)) { setFormError('Vui lòng nhập đủ 4 phát biểu.'); return; }
      options = opts;
      correctAnswer = form.tfCorrect;
    } else {
      const answers = form.fillAnswers.split('|').map((a) => a.trim()).filter(Boolean);
      if (answers.length === 0) { setFormError('Vui lòng nhập ít nhất 1 đáp án.'); return; }
      correctAnswer = answers;
    }

    const payload = {
      subject: form.subject,
      chapter: form.chapter.trim() || undefined,
      difficulty: form.difficulty,
      questionType: form.questionType,
      points: form.points,
      questionText: form.questionText.trim(),
      options,
      correctAnswer,
      explanation: form.explanation.trim() || undefined,
      examYear: form.examYear ? Number(form.examYear) : undefined,
      examCode: form.examCode.trim() || undefined,
    };

    setFormError('');
    setFormBusy(true);
    try {
      if (editingItem) {
        await adminUpdateQuestionBankItem(secret, editingItem.id, payload);
      } else {
        await adminCreateQuestionBankItem(secret, payload);
      }
      setShowForm(false);
      setEditingItem(null);
      await load(1);
      setPage(1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setFormBusy(false);
    }
  }

  async function openDeleteDialog(item: QuestionBankItem) {
    setDeleteTarget(item);
    setDeleteError('');
    setUsage(null);
    setUsageFailed(false);
    setUsageLoading(true);
    try {
      const u = await adminGetQuestionBankUsage(secret, item.id);
      setUsage(u);
    } catch {
      setUsageFailed(true);
      setDeleteError('Không thể kiểm tra thông tin sử dụng. Vui lòng đóng và thử lại.');
    } finally {
      setUsageLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    if (usage?.hasActiveSession) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await adminDeleteQuestionBankItem(secret, deleteTarget.id);
      setDeleteTarget(null);
      setUsage(null);
      await load(1);
      setPage(1);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setDeleteBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / QB_PAGE_SIZE));

  return (
    <div className="screen screen-admin">
      <div className="admin-header">
        <h2 className="page-title">Ngân hàng câu hỏi</h2>
        <button className="btn-link" onClick={onLogout}>Đăng xuất</button>
      </div>

      {/* Filter */}
      <div className="admin-filter" style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        <select className="field-input" style={{ flex: '1 1 130px' }}
          value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
          <option value="">Tất cả môn</option>
          {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="field-input" style={{ flex: '1 1 120px' }}
          value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
          <option value="">Tất cả độ khó</option>
          <option value="1">Dễ</option>
          <option value="2">Trung bình</option>
          <option value="3">Khó</option>
        </select>
        <input className="field-input" style={{ flex: '2 1 180px' }}
          placeholder="Tìm kiếm nội dung câu hỏi…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setFilterSearch(searchInput); }}
        />
        <button className="btn-secondary" onClick={() => setFilterSearch(searchInput)}>Tìm</button>
      </div>

      {error && <p className="report-error admin-msg">{error}</p>}

      <div className="admin-msg">
        <button className="btn-secondary" onClick={openCreate}>+ Thêm câu hỏi vào kho</button>
        <span style={{ marginLeft: '.75rem', fontSize: '.84rem', color: 'var(--muted)' }}>
          Tổng: {total} câu
        </span>
      </div>

      {/* Form thêm/sửa */}
      {showForm && (
        <section className="card-section">
          <div className="section-row">
            <h3 className="section-title">{editingItem ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới'}</h3>
            <button className="btn-link" onClick={() => { setShowForm(false); setEditingItem(null); }}>Đóng</button>
          </div>
          <div className="edit-form">
            <div className="admin-exam-row3">
              <label className="form-field">
                <span className="field-label">Môn học</span>
                <select className="field-input" value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}>
                  {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Dạng câu hỏi</span>
                <select className="field-input" value={form.questionType}
                  onChange={(e) => setForm((f) => ({ ...f, questionType: e.target.value as ExamQuestionType }))}>
                  <option value="MCQ_4">Trắc nghiệm 4 đáp án</option>
                  <option value="TRUE_FALSE_4">Đúng/Sai 4 ý</option>
                  <option value="FILL_BLANK">Điền đáp án</option>
                </select>
              </label>
            </div>

            <label className="form-field">
              <span className="field-label">Nội dung câu hỏi</span>
              <textarea className="report-desc" style={{ minHeight: '4rem' }}
                value={form.questionText}
                onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))} />
            </label>

            <div className="admin-exam-row3">
              <label className="form-field">
                <span className="field-label">Chương (tuỳ chọn)</span>
                <input className="field-input" value={form.chapter}
                  onChange={(e) => setForm((f) => ({ ...f, chapter: e.target.value }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Độ khó</span>
                <select className="field-input" value={form.difficulty}
                  onChange={(e) => setForm((f) => ({ ...f, difficulty: Number(e.target.value) }))}>
                  <option value={1}>Dễ</option>
                  <option value={2}>Trung bình</option>
                  <option value={3}>Khó</option>
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Điểm</span>
                <input className="field-input" type="number" step="0.25" min="0.25"
                  value={form.points}
                  onChange={(e) => setForm((f) => ({ ...f, points: Number(e.target.value) }))} />
              </label>
            </div>

            {(form.questionType === 'MCQ_4' || form.questionType === 'TRUE_FALSE_4') && (
              <div className="form-field">
                <span className="field-label">
                  {form.questionType === 'MCQ_4' ? '4 lựa chọn (radio = đáp án đúng)' : '4 phát biểu'}
                </span>
                {form.options.map((opt, idx) => (
                  <div key={idx} className="admin-exam-option-row">
                    {form.questionType === 'MCQ_4' ? (
                      <input type="radio" name="qb-mcq" checked={form.mcqCorrect === idx}
                        onChange={() => setForm((f) => ({ ...f, mcqCorrect: idx }))} />
                    ) : (
                      <div className="exam-tf-toggle">
                        <button type="button"
                          className={`exam-tf-btn ${form.tfCorrect[idx] ? 'active-true' : ''}`}
                          onClick={() => setForm((f) => { const t = [...f.tfCorrect]; t[idx] = true; return { ...f, tfCorrect: t }; })}>
                          Đúng
                        </button>
                        <button type="button"
                          className={`exam-tf-btn ${!form.tfCorrect[idx] ? 'active-false' : ''}`}
                          onClick={() => setForm((f) => { const t = [...f.tfCorrect]; t[idx] = false; return { ...f, tfCorrect: t }; })}>
                          Sai
                        </button>
                      </div>
                    )}
                    <span className="opt-label">{OPTION_LABELS[idx]}</span>
                    <input className="field-input" value={opt}
                      onChange={(e) => setForm((f) => {
                        const opts = [...f.options];
                        opts[idx] = e.target.value;
                        return { ...f, options: opts };
                      })} />
                  </div>
                ))}
              </div>
            )}

            {form.questionType === 'FILL_BLANK' && (
              <label className="form-field">
                <span className="field-label">Đáp án chấp nhận (phân tách bởi "|")</span>
                <input className="field-input" value={form.fillAnswers}
                  placeholder="Hà Nội | Ha Noi"
                  onChange={(e) => setForm((f) => ({ ...f, fillAnswers: e.target.value }))} />
              </label>
            )}

            <label className="form-field">
              <span className="field-label">Giải thích (tuỳ chọn)</span>
              <textarea className="report-desc" value={form.explanation}
                onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))} />
            </label>

            <div className="admin-exam-row3">
              <label className="form-field">
                <span className="field-label">Năm thi</span>
                <input className="field-input" type="number" value={form.examYear}
                  onChange={(e) => setForm((f) => ({ ...f, examYear: e.target.value }))} />
              </label>
              <label className="form-field">
                <span className="field-label">Mã đề</span>
                <input className="field-input" value={form.examCode}
                  onChange={(e) => setForm((f) => ({ ...f, examCode: e.target.value }))} />
              </label>
            </div>

            {formError && <p className="report-error">{formError}</p>}

            <button className="btn-primary" disabled={formBusy} onClick={() => void handleSubmitForm()}>
              {formBusy && <Spinner />}{formBusy ? 'Đang lưu…' : (editingItem ? 'Cập nhật câu hỏi' : 'Thêm câu hỏi')}
            </button>
          </div>
        </section>
      )}

      {/* Danh sách câu hỏi */}
      {loading ? (
        <div className="screen-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="empty admin-msg">Không có câu hỏi nào trong kho.</p>
      ) : (
        <div className="admin-exam-question-list" style={{ margin: '0 1rem' }}>
          {items.map((q) => (
            <div key={q.id} className="admin-exam-question-row">
              <div className="admin-exam-question-head">
                <span className="admin-exam-subject">{SUBJECTS_MAP[q.subject]?.name ?? q.subject}</span>
                <span className={`diff-badge diff-${q.difficulty}`}>{DIFF_LABEL[q.difficulty] ?? 'N/A'}</span>
                <span className="admin-exam-qtype">{QUESTION_TYPE_LABEL[q.questionType]}</span>
                {q.chapter && <span className="exam-chapter-tag">{q.chapter}</span>}
              </div>
              <p className="exam-question-text">{q.questionText}</p>
              <div style={{ display: 'flex', gap: '.75rem', marginTop: '.5rem' }}>
                <button className="btn-link" onClick={() => openEdit(q)}>Sửa ✏️</button>
                <button className="btn-link" style={{ color: 'var(--danger)' }}
                  onClick={() => void openDeleteDialog(q)}>
                  Xoá khỏi kho 🗑️
                </button>
              </div>
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

      {/* Dialog xác nhận xoá */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => { if (!deleteBusy) { setDeleteTarget(null); setUsage(null); } }}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title" style={{ marginBottom: '.75rem' }}>Xác nhận xoá câu hỏi khỏi kho</h3>
            <p style={{ fontSize: '.9rem', marginBottom: '.75rem' }}>
              <strong>"{deleteTarget.questionText.slice(0, 100)}{deleteTarget.questionText.length > 100 ? '…' : ''}"</strong>
            </p>

            {usageLoading ? (
              <div style={{ textAlign: 'center', padding: '.75rem' }}><Spinner /></div>
            ) : usage !== null ? (
              <div>
                {usage.totalExamPapers === 0 ? (
                  <p className="admin-notice" style={{ marginBottom: '.75rem' }}>
                    Câu hỏi này chưa được dùng trong đề thi nào. Có thể xoá an toàn.
                  </p>
                ) : (
                  <div style={{ marginBottom: '.75rem' }}>
                    <p style={{ fontSize: '.88rem', marginBottom: '.5rem' }}>
                      Câu hỏi đang được dùng trong <strong>{usage.totalExamPapers}</strong> đề thi:
                    </p>
                    <ul style={{ fontSize: '.84rem', paddingLeft: '1.25rem', margin: '0 0 .5rem' }}>
                      {usage.examPapers.map((p) => (
                        <li key={p.paperId} style={{ marginBottom: '.25rem' }}>
                          {p.paperTitle}
                          {p.hasActiveSession && (
                            <span style={{ color: 'var(--danger)', marginLeft: '.4rem', fontWeight: 700 }}>
                              [Đang có phiên thi đang diễn ra]
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {usage.hasActiveSession ? (
                      <p className="report-error" style={{ marginBottom: 0 }}>
                        Không thể xoá: còn phiên thi đang diễn ra tham chiếu câu hỏi này. Vui lòng chờ phiên kết thúc.
                      </p>
                    ) : (
                      <p className="admin-notice" style={{ marginBottom: 0 }}>
                        Khi xoá, câu hỏi sẽ bị xoá khỏi kho nhưng vẫn tồn tại trong các đề thi đã dùng (dạng câu hỏi tự do).
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {deleteError && <p className="report-error">{deleteError}</p>}

            <div style={{ display: 'flex', gap: '.75rem', marginTop: '.75rem' }}>
              <button className="btn-secondary" disabled={deleteBusy}
                onClick={() => { setDeleteTarget(null); setUsage(null); setUsageFailed(false); setDeleteError(''); }}>
                Huỷ
              </button>
              <button
                className="btn-primary"
                style={{ background: 'var(--danger)' }}
                disabled={deleteBusy || usageLoading || usageFailed || (usage?.hasActiveSession ?? false)}
                onClick={() => void handleConfirmDelete()}
              >
                {deleteBusy ? <Spinner /> : null}
                {deleteBusy ? 'Đang xoá…' : 'Xác nhận xoá'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminQuestionBankPage;
