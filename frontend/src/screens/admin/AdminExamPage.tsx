import { useState, useEffect, useRef } from 'react';
import {
  adminListExamPapers, adminCreateExamPaper,
  adminGetExamPaperDetail, adminUpdateExamPaper,
  adminDeleteExamQuestion, adminRestoreExamQuestion, adminUpdateExamQuestion,
  adminAutoFillFromBank, adminImportExamQuestions,
  adminListQuestionBank, adminAddFromBank,
  ApiError,
} from '../../lib/api.js';
import type {
  ExamPaperSummary, ExamPaperDetail, ExamQuestionType, ExamImportResultDto, QuestionBankItem,
} from '../../lib/api.js';
import { SUBJECTS, SUBJECTS_MAP } from '../../lib/constants.js';
import Spinner from '../../components/Spinner.js';
import { DIFF_LABEL, OPTION_LABELS } from '../practice/practiceConstants.js';
import { QUESTION_TYPE_LABEL } from './adminConstants.js';

type AdminExamSub = 'list' | 'detail';

function AdminExamPage({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [sub, setSub] = useState<AdminExamSub>('list');
  const [selectedId, setSelectedId] = useState('');

  if (sub === 'detail' && selectedId) {
    return (
      <AdminExamPaperDetailPage
        secret={secret}
        paperId={selectedId}
        onBack={() => { setSub('list'); setSelectedId(''); }}
        onLogout={onLogout}
      />
    );
  }

  return (
    <AdminExamPaperListPage
      secret={secret}
      onSelect={(id) => { setSelectedId(id); setSub('detail'); }}
      onLogout={onLogout}
    />
  );
}

// ─── AdminExamPaperListPage ────────────────────────────────────────────────────

function AdminExamPaperListPage({
  secret, onSelect, onLogout,
}: {
  secret: string;
  onSelect: (id: string) => void;
  onLogout: () => void;
}) {
  const [papers, setPapers] = useState<ExamPaperSummary[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ subject: SUBJECTS[0].id, title: '', durationMinutes: 50 });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await adminListExamPapers(secret, subjectFilter || undefined);
      setPapers(data);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- load() goi API va setState de dong bo voi subjectFilter
  useEffect(() => { void load(); }, [subjectFilter]);

  async function handleCreate() {
    if (creating) return;
    if (!form.title.trim()) {
      setCreateError('Vui lòng nhập tên đề thi.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await adminCreateExamPaper(secret, {
        subject: form.subject,
        title: form.title.trim(),
        durationMinutes: form.durationMinutes,
      });
      setForm((f) => ({ ...f, title: '' }));
      setShowCreate(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="screen screen-admin">
      <div className="admin-header">
        <h2 className="page-title">Quản lý đề thi thử</h2>
        <button className="btn-link" onClick={onLogout}>Đăng xuất</button>
      </div>

      <div className="admin-filter">
        <select className="field-input" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="">Tất cả môn học</option>
          {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {error && <p className="report-error admin-msg">{error}</p>}

      <div className="admin-msg">
        <button className="btn-secondary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Đóng' : '+ Tạo đề thi mới'}
        </button>
      </div>

      {showCreate && (
        <section className="card-section">
          <h3 className="section-title" style={{ marginBottom: '.75rem' }}>Tạo đề thi mới</h3>
          <div className="edit-form">
            <label className="form-field">
              <span className="field-label">Môn học</span>
              <select className="field-input" value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}>
                {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">Tên đề thi</span>
              <input className="field-input" value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Đề thi thử THPT QG 2024 - Mã đề 101" />
            </label>
            <label className="form-field">
              <span className="field-label">Thời gian làm bài (phút)</span>
              <input className="field-input" type="number" min={1} value={form.durationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))} />
            </label>
            {createError && <p className="report-error">{createError}</p>}
            <button className="btn-primary" disabled={creating} onClick={() => void handleCreate()}>
              {creating && <Spinner />}{creating ? 'Đang tạo…' : 'Tạo đề thi'}
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <div className="screen-center"><Spinner /></div>
      ) : papers.length === 0 ? (
        <p className="empty admin-msg">Chưa có đề thi nào.</p>
      ) : (
        <div className="admin-report-list">
          {papers.map((p) => (
            <button key={p.id} className="admin-exam-card" onClick={() => onSelect(p.id)}>
              <div className="admin-exam-card-top">
                <span className="admin-exam-subject">{SUBJECTS_MAP[p.subject]?.name ?? p.subject}</span>
                <span className={`admin-status-badge ${p.isActive ? 'status-fixed' : 'status-dismissed'}`}>
                  {p.isActive ? 'Đang hoạt động' : 'Tạm ẩn'}
                </span>
              </div>
              <p className="admin-exam-title">{p.title}</p>
              <p className="admin-exam-meta">{p.questionCount} câu hỏi · {p.durationMinutes} phút</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AdminExamPaperDetailPage ──────────────────────────────────────────────────

function AdminExamPaperDetailPage({
  secret, paperId, onBack, onLogout,
}: {
  secret: string;
  paperId: string;
  onBack: () => void;
  onLogout: () => void;
}) {
  const [paper, setPaper] = useState<ExamPaperDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState({
    points: 0.25, difficulty: 1, chapter: '', questionText: '',
    options: ['', '', '', ''], mcqCorrect: 0,
    tfCorrect: [true, true, true, true] as boolean[],
    fillAnswers: '', explanation: '',
    questionType: 'MCQ_4' as ExamQuestionType,
  });
  const [editError, setEditError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await adminGetExamPaperDetail(secret, paperId);
      setPaper(data);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- load() goi API va setState de dong bo voi paperId
  useEffect(() => { void load(); }, [paperId]);

  async function handleToggleActive() {
    if (!paper || busy) return;
    setBusy(true);
    setError('');
    try {
      await adminUpdateExamPaper(secret, paper.id, { isActive: !paper.isActive });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteQuestion(qid: string) {
    if (!paper || busy) return;
    setBusy(true);
    setError('');
    try {
      await adminDeleteExamQuestion(secret, paper.id, qid);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreQuestion(qid: string) {
    if (!paper || busy) return;
    setBusy(true);
    setError('');
    try {
      await adminRestoreExamQuestion(secret, paper.id, qid);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(q: ExamPaperDetail['questions'][number]) {
    const mcqCorrect = q.questionType === 'MCQ_4' && typeof q.correctAnswer === 'number' ? q.correctAnswer : 0;
    const tfCorrect = q.questionType === 'TRUE_FALSE_4' && Array.isArray(q.correctAnswer) && q.correctAnswer.length === 4
      ? (q.correctAnswer as boolean[])
      : [true, true, true, true];
    const fillAnswers = q.questionType === 'FILL_BLANK' && Array.isArray(q.correctAnswer)
      ? (q.correctAnswer as string[]).join(' | ')
      : typeof q.correctAnswer === 'string' ? q.correctAnswer : '';
    setEditingId(q.id);
    setEditForm({
      points: q.points,
      difficulty: q.difficulty,
      chapter: q.chapter ?? '',
      questionText: q.questionText,
      options: (q.options && q.options.length === 4) ? [...q.options] : ['', '', '', ''],
      mcqCorrect,
      tfCorrect,
      fillAnswers,
      explanation: q.explanation ?? '',
      questionType: q.questionType,
    });
    setEditError('');
  }

  async function handleUpdateQuestion() {
    if (!paper || busy || !editingId) return;
    setBusy(true);
    setEditError('');
    try {
      const base = {
        points: editForm.points,
        difficulty: editForm.difficulty,
        chapter: editForm.chapter.trim() || undefined,
        questionText: editForm.questionText.trim(),
        explanation: editForm.explanation.trim() || undefined,
      };
      let correctAnswer: number | boolean[] | string[];
      let options: string[] | undefined;
      if (editForm.questionType === 'MCQ_4') {
        options = editForm.options.map((o) => o.trim());
        correctAnswer = editForm.mcqCorrect;
      } else if (editForm.questionType === 'TRUE_FALSE_4') {
        options = editForm.options.map((o) => o.trim());
        correctAnswer = editForm.tfCorrect;
      } else {
        correctAnswer = editForm.fillAnswers.split('|').map((a) => a.trim()).filter(Boolean);
      }
      await adminUpdateExamQuestion(secret, paper.id, editingId, { ...base, options, correctAnswer });
      setEditingId('');
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="screen screen-center"><Spinner /></div>;
  }

  if (!paper) {
    return (
      <div className="screen screen-admin">
        <div className="admin-header">
          <button className="btn-link" onClick={onBack}>← Quay lại</button>
          <button className="btn-link" onClick={onLogout}>Đăng xuất</button>
        </div>
        {error && <p className="report-error admin-msg">{error}</p>}
      </div>
    );
  }

  return (
    <div className="screen screen-admin">
      <div className="admin-header">
        <button className="btn-link" onClick={onBack}>← Quay lại</button>
        <button className="btn-link" onClick={onLogout}>Đăng xuất</button>
      </div>

      <section className="card-section">
        <h2 className="page-title" style={{ marginBottom: '.25rem' }}>{paper.title}</h2>
        <p className="admin-exam-meta">
          {SUBJECTS_MAP[paper.subject]?.name ?? paper.subject} · {paper.durationMinutes} phút · {paper.questions.filter((q) => q.isActive).length} câu hỏi active ({paper.questions.length} tổng)
        </p>
        <div className="admin-exam-toggle">
          <span>Trạng thái: {paper.isActive ? 'Đang hoạt động' : 'Tạm ẩn'}</span>
          <button className="btn-secondary" disabled={busy} onClick={() => void handleToggleActive()}>
            {paper.isActive ? 'Tạm ẩn' : 'Kích hoạt'}
          </button>
        </div>
      </section>

      {error && <p className="report-error admin-msg">{error}</p>}

      <AdminExamImportBox secret={secret} paperId={paper.id} onDone={() => void load()} />

      <AdminFromBankModal
        secret={secret}
        paperId={paper.id}
        paperSubject={paper.subject}
        onDone={() => void load()}
      />

      <AdminAutoFillBox secret={secret} paperId={paper.id} onDone={() => void load()} />

      <section className="card-section">
        <h3 className="section-title" style={{ marginBottom: '.75rem' }}>
          Danh sách câu hỏi ({paper.questions.filter((q) => q.isActive).length} active · {paper.questions.length} tổng)
        </h3>
        {paper.questions.length === 0 ? (
          <p className="empty">Chưa có câu hỏi nào.</p>
        ) : (
          <div className="admin-exam-question-list">
            {paper.questions.map((q, idx) => (
              <div key={q.id} className="admin-exam-question-row" style={!q.isActive ? { opacity: 0.5, background: 'var(--cream)' } : {}}>
                <div className="admin-exam-question-head">
                  <span className="exam-question-num">Câu {idx + 1}</span>
                  <span className={`diff-badge diff-${q.difficulty}`}>{DIFF_LABEL[q.difficulty] ?? 'N/A'}</span>
                  <span className="admin-exam-qtype">{QUESTION_TYPE_LABEL[q.questionType]}</span>
                  {!q.isActive && (
                    <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#fff', background: '#718096', borderRadius: '100px', padding: '.15rem .625rem' }}>
                      ẨN
                    </span>
                  )}
                </div>
                <p className="exam-question-text">{q.questionText}</p>
                {editingId === q.id ? (
                  <div className="edit-form" style={{ marginTop: '.75rem' }}>
                    <label className="form-field">
                      <span className="field-label">Nội dung câu hỏi</span>
                      <textarea className="report-desc" style={{ minHeight: '3rem' }}
                        value={editForm.questionText}
                        onChange={(e) => setEditForm((f) => ({ ...f, questionText: e.target.value }))} />
                    </label>

                    {(editForm.questionType === 'MCQ_4' || editForm.questionType === 'TRUE_FALSE_4') && (
                      <div className="form-field">
                        <span className="field-label">
                          {editForm.questionType === 'MCQ_4' ? '4 lựa chọn' : '4 phát biểu'}
                        </span>
                        {editForm.options.map((opt, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.4rem' }}>
                            {editForm.questionType === 'MCQ_4' ? (
                              <input type="radio" name={`mcq-edit-${editingId}`} checked={editForm.mcqCorrect === idx}
                                onChange={() => setEditForm((f) => ({ ...f, mcqCorrect: idx }))} />
                            ) : (
                              <select className="field-input" style={{ width: '90px', flexShrink: 0 }}
                                value={editForm.tfCorrect[idx] ? 'true' : 'false'}
                                onChange={(e) => setEditForm((f) => {
                                  const next = [...f.tfCorrect];
                                  next[idx] = e.target.value === 'true';
                                  return { ...f, tfCorrect: next };
                                })}>
                                <option value="true">Đúng</option>
                                <option value="false">Sai</option>
                              </select>
                            )}
                            <span style={{ fontWeight: 600, minWidth: '1.2rem' }}>{OPTION_LABELS[idx]}.</span>
                            <input className="field-input" value={opt}
                              onChange={(e) => setEditForm((f) => {
                                const next = [...f.options];
                                next[idx] = e.target.value;
                                return { ...f, options: next };
                              })} />
                          </div>
                        ))}
                        {editForm.questionType === 'MCQ_4' && (
                          <p style={{ fontSize: '.78rem', color: 'var(--muted)' }}>
                            Chọn radio bên trái để đặt đáp án đúng.
                          </p>
                        )}
                      </div>
                    )}

                    {editForm.questionType === 'FILL_BLANK' && (
                      <label className="form-field">
                        <span className="field-label">Đáp án chấp nhận (phân cách bởi "|")</span>
                        <input className="field-input" value={editForm.fillAnswers}
                          placeholder="Hà Nội | Ha Noi"
                          onChange={(e) => setEditForm((f) => ({ ...f, fillAnswers: e.target.value }))} />
                      </label>
                    )}

                    <label className="form-field">
                      <span className="field-label">Giải thích (tuỳ chọn)</span>
                      <textarea className="report-desc" style={{ minHeight: '2.5rem' }}
                        value={editForm.explanation}
                        onChange={(e) => setEditForm((f) => ({ ...f, explanation: e.target.value }))} />
                    </label>

                    <div className="admin-exam-row3">
                      <label className="form-field">
                        <span className="field-label">Chương</span>
                        <input className="field-input" value={editForm.chapter}
                          onChange={(e) => setEditForm((f) => ({ ...f, chapter: e.target.value }))} />
                      </label>
                      <label className="form-field">
                        <span className="field-label">Độ khó</span>
                        <select className="field-input" value={editForm.difficulty}
                          onChange={(e) => setEditForm((f) => ({ ...f, difficulty: Number(e.target.value) }))}>
                          <option value={1}>Dễ</option>
                          <option value={2}>Trung bình</option>
                          <option value={3}>Khó</option>
                        </select>
                      </label>
                      <label className="form-field">
                        <span className="field-label">Điểm</span>
                        <input className="field-input" type="number" step="0.25" min="0.25"
                          value={editForm.points}
                          onChange={(e) => setEditForm((f) => ({ ...f, points: Number(e.target.value) }))} />
                      </label>
                    </div>
                    {editError && <p className="report-error">{editError}</p>}
                    <div style={{ display: 'flex', gap: '.75rem' }}>
                      <button className="btn-primary" disabled={busy} onClick={() => void handleUpdateQuestion()}>
                        {busy ? <Spinner /> : null} Lưu
                      </button>
                      <button className="btn-secondary" onClick={() => setEditingId('')}>Huỷ</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '.75rem' }}>
                    <button className="btn-link" disabled={busy} onClick={() => startEdit(q)}>
                      Sửa ✏️
                    </button>
                    {q.isActive ? (
                      <button className="btn-link" style={{ color: 'var(--danger)' }} disabled={busy}
                        onClick={() => void handleDeleteQuestion(q.id)}>
                        Xoá khỏi đề 🗑️
                      </button>
                    ) : (
                      <button className="btn-link" style={{ color: 'var(--success, #38a169)' }} disabled={busy}
                        onClick={() => void handleRestoreQuestion(q.id)}>
                        Khôi phục ↩️
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── AdminAutoFillBox ───────────────────────────────────────────────────────────

function AdminAutoFillBox({
  secret, paperId, onDone,
}: {
  secret: string;
  paperId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(40);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ added: number; shortage: number } | null>(null);

  async function handleAutoFill() {
    if (busy || count < 1) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await adminAutoFillFromBank(secret, paperId, count);
      setResult({ added: res.added, shortage: res.shortage });
      if (res.added > 0) onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="admin-msg">
        <button className="btn-secondary" onClick={() => { setOpen(true); setResult(null); setError(''); }}>
          Lấy câu tự động
        </button>
      </div>
    );
  }

  return (
    <section className="card-section">
      <div className="section-row">
        <h3 className="section-title">Lấy câu tự động từ ngân hàng</h3>
        <button className="btn-link" onClick={() => setOpen(false)}>Đóng</button>
      </div>
      <p className="admin-exam-meta" style={{ marginBottom: '.75rem' }}>
        Hệ thống chọn ngẫu nhiên từ ngân hàng câu hỏi (cùng môn) theo tỷ lệ:
        <strong> 50% dễ / 30% trung bình / 20% khó</strong>.
        Câu đã có trong đề sẽ không bị thêm lại.
      </p>
      <div className="edit-form">
        <label className="form-field">
          <span className="field-label">Số câu hỏi cần lấy</span>
          <input
            className="field-input"
            type="number"
            min={1}
            max={200}
            value={count}
            style={{ maxWidth: '120px' }}
            onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value))))}
          />
        </label>
        {result && (
          <div>
            {result.added > 0 && (
              <p className="admin-notice">✓ Đã thêm {result.added} câu hỏi vào đề thi.</p>
            )}
            {result.shortage > 0 && (
              <p className="report-error" style={{ marginTop: '.25rem' }}>
                Ngân hàng không đủ câu: thiếu {result.shortage} câu theo tỷ lệ đã chọn.
              </p>
            )}
            {result.added === 0 && result.shortage === 0 && (
              <p className="admin-notice">Không có câu hỏi mới nào được thêm (đã đủ hoặc kho trống).</p>
            )}
          </div>
        )}
        {error && <p className="report-error">{error}</p>}
        <button className="btn-primary" disabled={busy || count < 1} onClick={() => void handleAutoFill()}>
          {busy && <Spinner />}{busy ? 'Đang lấy câu…' : `Lấy ${count} câu tự động`}
        </button>
      </div>
    </section>
  );
}

// ─── AdminExamImportBox ─────────────────────────────────────────────────────────

function AdminExamImportBox({
  secret, paperId, onDone,
}: {
  secret: string;
  paperId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ExamImportResultDto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await adminImportExamQuestions(secret, paperId, file);
      setResult(res);
      if (res.inserted > 0) onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <section className="card-section">
      <h3 className="section-title" style={{ marginBottom: '.75rem' }}>Nhập câu hỏi từ Excel</h3>
      <p className="admin-exam-meta" style={{ marginBottom: '.625rem' }}>
        Dùng file mẫu <code>docs/templates/mau-import-cau-hoi-thi-thu.xlsx</code>, điền dữ liệu rồi chọn file để nhập.
        Các dòng hợp lệ được lưu ngay, dòng lỗi sẽ được báo cụ thể theo số dòng.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        disabled={busy}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {busy && <p className="admin-exam-meta" style={{ marginTop: '.5rem' }}><Spinner /> Đang xử lý…</p>}
      {error && <p className="report-error" style={{ marginTop: '.5rem' }}>{error}</p>}
      {result && (
        <div className="admin-import-result">
          <p className="admin-import-ok">✓ Đã thêm {result.inserted} câu hỏi.</p>
          {result.errors.length > 0 && (
            <div className="admin-import-errors">
              <p className="admin-import-err-title">Có {result.errors.length} dòng lỗi:</p>
              {result.errors.map((e) => (
                <p key={e.row} className="admin-import-err-row">Dòng {e.row}: {e.message}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── AdminFromBankModal ─────────────────────────────────────────────────────────

function AdminFromBankModal({
  secret, paperId, paperSubject, onDone,
}: {
  secret: string;
  paperId: string;
  paperSubject: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Mon hoc bi khoa theo de thi — chi hien cau cung mon, khong cho doi mon.
  const filterSubject = paperSubject;
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  const PAGE_SIZE = 20;

  async function loadBank(pg = 1) {
    setLoading(true);
    setError('');
    try {
      const res = await adminListQuestionBank(secret, {
        subject: filterSubject,
        difficulty: filterDifficulty ? Number(filterDifficulty) : undefined,
        search: filterSearch || undefined,
        isActive: true,
        page: pg,
        pageSize: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    setSelected(new Set());
    setResult(null);
    setPage(1);
    void loadBank(1);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (open) { setPage(1); void loadBank(1); } }, [filterDifficulty, filterSearch]);
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (open) { void loadBank(page); } }, [page]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddSelected() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await adminAddFromBank(secret, paperId, [...selected]);
      setResult(res);
      setSelected(new Set());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!open) {
    return (
      <div className="admin-msg">
        <button className="btn-secondary" onClick={handleOpen}>
          Lấy câu từ ngân hàng
        </button>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={() => { if (!busy) setOpen(false); }}>
      <div className="modal-box modal-box-wide" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Lấy câu từ ngân hàng</h3>
          <button className="btn-link" onClick={() => setOpen(false)}>Đóng ✕</button>
        </div>

        {/* Filter — môn học bị khoá theo đề thi, chỉ lọc độ khó và tìm kiếm */}
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.75rem' }}>
          <select className="field-input" style={{ flex: '1 1 110px' }}
            value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
            <option value="">Tất cả độ khó</option>
            <option value="1">Dễ</option>
            <option value="2">Trung bình</option>
            <option value="3">Khó</option>
          </select>
          <input className="field-input" style={{ flex: '2 1 160px' }}
            placeholder="Tìm kiếm câu hỏi…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setFilterSearch(searchInput); }}
          />
          <button className="btn-secondary" onClick={() => setFilterSearch(searchInput)}>Tìm</button>
        </div>

        {selected.size > 0 && (
          <div style={{ marginBottom: '.5rem', padding: '.5rem .75rem', background: 'var(--cream)', borderRadius: '8px', fontSize: '.88rem' }}>
            Đã chọn <strong>{selected.size}</strong> câu hỏi.
          </div>
        )}

        {error && <p className="report-error" style={{ marginBottom: '.5rem' }}>{error}</p>}
        {result && (
          <p className="admin-notice" style={{ marginBottom: '.5rem' }}>
            ✓ Đã thêm {result.added} câu vào đề.{result.skipped > 0 ? ` (${result.skipped} câu đã tồn tại, bỏ qua)` : ''}
          </p>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="empty" style={{ textAlign: 'center', padding: '.75rem' }}>Không có câu hỏi nào phù hợp.</p>
        ) : (
          <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            {items.map((q) => {
              const isChecked = selected.has(q.id);
              return (
                <div
                  key={q.id}
                  className="admin-exam-question-row"
                  style={{ cursor: 'pointer', background: isChecked ? 'rgba(59,130,246,.08)' : undefined }}
                  onClick={() => toggleSelect(q.id)}
                >
                  <div style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(q.id)}
                      onClick={(e) => e.stopPropagation()} style={{ marginTop: '.2rem', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="admin-exam-question-head">
                        <span className="admin-exam-subject">{SUBJECTS_MAP[q.subject]?.name ?? q.subject}</span>
                        <span className={`diff-badge diff-${q.difficulty}`}>{DIFF_LABEL[q.difficulty] ?? 'N/A'}</span>
                        <span className="admin-exam-qtype">{QUESTION_TYPE_LABEL[q.questionType]}</span>
                        {q.chapter && <span className="exam-chapter-tag">{q.chapter}</span>}
                        <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{q.points}đ</span>
                      </div>
                      <p className="exam-question-text" style={{ margin: '.25rem 0 0' }}>{q.questionText}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="admin-pagination" style={{ marginTop: '.5rem' }}>
            <button className="btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>← Trước</button>
            <span>Trang {page}/{totalPages}</span>
            <button className="btn-secondary" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Sau →</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '.75rem', marginTop: '1rem' }}>
          <button className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Đóng</button>
          <button className="btn-primary" disabled={selected.size === 0 || busy} onClick={() => void handleAddSelected()}>
            {busy && <Spinner />}
            {busy ? 'Đang thêm…' : `Thêm ${selected.size > 0 ? selected.size : ''} câu vào đề`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminExamPage;
