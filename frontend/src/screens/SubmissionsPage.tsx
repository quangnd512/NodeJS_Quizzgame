import { useState, useEffect } from 'react';
import {
  createSubmission, getMySubmissions, updateSubmission, deleteSubmission, ApiError,
} from '../lib/api.js';
import type {
  ExamQuestionType, SubmissionDto, SubmissionStatus, SubmissionCorrectAnswer,
} from '../lib/api.js';
import { SUBJECTS } from '../lib/constants.js';
import { OPTION_LABELS } from './practice/practiceConstants.js';
import Spinner from '../components/Spinner.js';

type SubmissionsSub = 'form' | 'list';

const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  PENDING:  '🟡 Chờ duyệt',
  APPROVED: '✅ Đã duyệt',
  REJECTED: '❌ Từ chối',
};

function SubmissionsPage({
  sessionToken, onBack, onError,
}: {
  sessionToken: string;
  onBack: () => void;
  onError: (e: unknown) => void;
}) {
  const [sub, setSub] = useState<SubmissionsSub>('form');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="screen" style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '1rem 1.25rem .75rem', background: 'linear-gradient(135deg,#84fab0,#8fd3f4)', color: '#1e293b' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#1e293b', fontSize: '1.4rem', cursor: 'pointer', padding: 0 }}>←</button>
        <h2 style={{ flex: 1, margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>✍️ Đóng góp câu hỏi</h2>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <button
          className={`admin-tab ${sub === 'form' ? 'active' : ''}`}
          style={{ flex: 1 }}
          onClick={() => setSub('form')}
        >Gửi câu hỏi mới</button>
        <button
          className={`admin-tab ${sub === 'list' ? 'active' : ''}`}
          style={{ flex: 1 }}
          onClick={() => setSub('list')}
        >Câu đã gửi</button>
      </div>

      <div style={{ padding: '1rem 1.25rem' }}>
        {sub === 'form' && (
          <SubmissionFormFields
            mode="create"
            sessionToken={sessionToken}
            onError={onError}
            onDone={() => { setSub('list'); setRefreshKey((k) => k + 1); }}
          />
        )}
        {sub === 'list' && (
          <SubmissionListSection key={refreshKey} sessionToken={sessionToken} onError={onError} />
        )}
      </div>
    </div>
  );
}

/** Form dùng chung cho tạo mới (mode="create") và sửa (mode="edit", cần truyền `initial`). */
function SubmissionFormFields({
  mode, initial, sessionToken, onError, onDone, onCancel,
}: {
  mode: 'create' | 'edit';
  initial?: SubmissionDto;
  sessionToken: string;
  onError: (e: unknown) => void;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [questionType, setQuestionType] = useState<ExamQuestionType>(initial?.questionType ?? 'MCQ_4');
  const [questionText, setQuestionText] = useState(initial?.questionText ?? '');
  const [options, setOptions] = useState<[string, string, string, string]>(
    (initial?.options && initial.options.length === 4 ? initial.options : ['', '', '', '']) as
      [string, string, string, string],
  );
  const [mcqCorrect, setMcqCorrect] = useState<number | null>(
    initial?.questionType === 'MCQ_4' && typeof initial.correctAnswer === 'number' ? initial.correctAnswer : null,
  );
  const [tfCorrect, setTfCorrect] = useState<boolean[]>(
    initial?.questionType === 'TRUE_FALSE_4' && Array.isArray(initial.correctAnswer)
      ? (initial.correctAnswer as boolean[]) : [true, true, true, true],
  );
  const [fillAnswers, setFillAnswers] = useState(
    initial?.questionType === 'FILL_BLANK' && Array.isArray(initial.correctAnswer)
      ? (initial.correctAnswer as string[]).join(' | ') : '',
  );
  const [busy, setBusy] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [rateLimitModal, setRateLimitModal] = useState('');

  function updateOption(i: number, value: string) {
    setOptions((prev) => {
      const next = [...prev] as [string, string, string, string];
      next[i] = value;
      return next;
    });
  }

  function resetFormFields() {
    setSubject(''); setQuestionType('MCQ_4'); setQuestionText('');
    setOptions(['', '', '', '']); setMcqCorrect(null);
    setTfCorrect([true, true, true, true]); setFillAnswers('');
  }

  async function handleSubmit() {
    if (!subject) { setValidationError('Vui lòng chọn môn học.'); return; }
    if (questionText.trim().length < 5) {
      setValidationError('Nội dung câu hỏi quá ngắn (tối thiểu 5 ký tự).'); return;
    }

    let correctAnswer: SubmissionCorrectAnswer;
    let sendOptions: string[] | undefined;
    if (questionType === 'MCQ_4') {
      const opts = options.map((o) => o.trim());
      if (opts.some((o) => !o)) { setValidationError('Vui lòng nhập đủ 4 đáp án.'); return; }
      if (mcqCorrect === null) { setValidationError('Vui lòng chọn đáp án đúng.'); return; }
      sendOptions = opts;
      correctAnswer = mcqCorrect;
    } else if (questionType === 'TRUE_FALSE_4') {
      const opts = options.map((o) => o.trim());
      if (opts.some((o) => !o)) { setValidationError('Vui lòng nhập đủ 4 phát biểu.'); return; }
      sendOptions = opts;
      correctAnswer = tfCorrect;
    } else {
      const answers = fillAnswers.split('|').map((a) => a.trim()).filter(Boolean);
      if (answers.length === 0) { setValidationError('Vui lòng nhập ít nhất 1 đáp án.'); return; }
      correctAnswer = answers;
    }

    setValidationError('');
    setBusy(true);
    try {
      const payload = {
        subject,
        questionType,
        questionText: questionText.trim(),
        options: sendOptions,
        correctAnswer,
      };
      if (mode === 'create') {
        await createSubmission(sessionToken, payload);
      } else if (initial) {
        await updateSubmission(sessionToken, initial.id, payload);
      }
      if (mode === 'create') resetFormFields();
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SUBMISSION_RATE_LIMIT_EXCEEDED') {
        setRateLimitModal(err.message);
      } else if (err instanceof ApiError && (err.status === 400 || err.status === 409)) {
        setValidationError(err.message);
      } else {
        onError(err);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '1rem', border: '1px solid #e2e8f0' }}>
      {mode === 'create' && (
        <p style={{ margin: '0 0 1rem', fontSize: '.85rem', color: '#64748b' }}>
          Gửi câu hỏi để đóng góp vào ngân hàng câu hỏi. Câu hỏi được duyệt sẽ thưởng{' '}
          <strong>30 điểm</strong>, mỗi lần được dùng trong 1 đề thi thật sẽ thưởng thêm{' '}
          <strong>5 điểm</strong> (tối đa 100 điểm/câu). Tối đa 5 câu/ngày.
        </p>
      )}
      <label className="form-field">
        <span className="field-label">Môn học</span>
        <select className="field-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">-- Chọn môn --</option>
          {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
        </select>
      </label>
      <label className="form-field">
        <span className="field-label">Dạng câu hỏi</span>
        <select
          className="field-input"
          value={questionType}
          onChange={(e) => setQuestionType(e.target.value as ExamQuestionType)}
        >
          <option value="MCQ_4">Trắc nghiệm 4 đáp án</option>
          <option value="TRUE_FALSE_4">Đúng/Sai (4 ý)</option>
          <option value="FILL_BLANK">Điền đáp án</option>
        </select>
      </label>
      <label className="form-field">
        <span className="field-label">Nội dung câu hỏi</span>
        <textarea
          className="field-input"
          rows={3}
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="Nhập nội dung câu hỏi..."
        />
      </label>
      {(questionType === 'MCQ_4' || questionType === 'TRUE_FALSE_4') && (
        <>
          <span className="field-label" style={{ display: 'block', marginTop: '.5rem' }}>
            {questionType === 'MCQ_4' ? '4 đáp án (chọn ô tròn cho đáp án đúng)' : '4 phát biểu (chọn Đúng/Sai cho từng ý)'}
          </span>
          {options.map((opt, i) => (
            <div key={i} className="form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '.5rem' }}>
              {questionType === 'MCQ_4' ? (
                <input
                  type="radio"
                  name="correctOption"
                  checked={mcqCorrect === i}
                  onChange={() => setMcqCorrect(i)}
                />
              ) : (
                <div className="exam-tf-toggle">
                  <button type="button"
                    className={`exam-tf-btn ${tfCorrect[i] ? 'active-true' : ''}`}
                    onClick={() => setTfCorrect((t) => { const next = [...t]; next[i] = true; return next; })}>
                    Đúng
                  </button>
                  <button type="button"
                    className={`exam-tf-btn ${!tfCorrect[i] ? 'active-false' : ''}`}
                    onClick={() => setTfCorrect((t) => { const next = [...t]; next[i] = false; return next; })}>
                    Sai
                  </button>
                </div>
              )}
              <input
                className="field-input"
                style={{ flex: 1 }}
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={questionType === 'MCQ_4' ? `Đáp án ${OPTION_LABELS[i]}` : `Phát biểu ${OPTION_LABELS[i]}`}
              />
            </div>
          ))}
        </>
      )}
      {questionType === 'FILL_BLANK' && (
        <label className="form-field">
          <span className="field-label">Đáp án chấp nhận (phân tách bởi "|")</span>
          <input
            className="field-input"
            value={fillAnswers}
            placeholder="Hà Nội | Ha Noi"
            onChange={(e) => setFillAnswers(e.target.value)}
          />
        </label>
      )}
      {validationError && <p className="report-error">{validationError}</p>}
      <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem' }}>
        <button className="btn-primary btn-lg" disabled={busy} onClick={() => void handleSubmit()}>
          {busy ? <><Spinner /> Đang lưu…</> : mode === 'create' ? 'Gửi câu hỏi' : 'Lưu thay đổi'}
        </button>
        {mode === 'edit' && onCancel && (
          <button className="btn-secondary btn-lg" disabled={busy} onClick={onCancel}>Huỷ</button>
        )}
      </div>

      {/* Modal riêng cho lỗi vượt rate limit 5 câu/ngày — nổi bật hơn lỗi validate thường */}
      {rateLimitModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setRateLimitModal('')}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 className="modal-title">⏳ Đã đạt giới hạn gửi câu hỏi</h3>
            <p>{rateLimitModal}</p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setRateLimitModal('')}>Đã hiểu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubmissionListSection({
  sessionToken, onError,
}: {
  sessionToken: string;
  onError: (e: unknown) => void;
}) {
  const [items, setItems] = useState<SubmissionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await getMySubmissions(sessionToken, { limit: 50 });
      setItems(res.items);
    } catch (err) { onError(err); }
    finally { setLoading(false); }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- load() 1 lan khi mount
  useEffect(() => { void load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm('Xoá câu hỏi này?')) return;
    try {
      await deleteSubmission(sessionToken, id);
      await load();
    } catch (err) { onError(err); }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}><Spinner /></div>;
  if (items.length === 0) {
    return <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Bạn chưa gửi câu hỏi nào.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      {items.map((item) => (
        editingId === item.id ? (
          <SubmissionFormFields
            key={item.id}
            mode="edit"
            initial={item}
            sessionToken={sessionToken}
            onError={onError}
            onDone={() => { setEditingId(null); void load(); }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={item.id} style={{ background: '#fff', borderRadius: 12, padding: '.85rem 1rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '.85rem' }}>{SUBMISSION_STATUS_LABEL[item.status]}</span>
              <span style={{ fontSize: '.78rem', color: '#94a3b8' }}>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
            </div>
            <p style={{ margin: '.5rem 0', fontWeight: 500 }}>{item.questionText}</p>
            <p style={{ margin: 0, fontSize: '.82rem', color: '#64748b' }}>
              Môn: {SUBJECTS.find((s) => s.id === item.subject)?.name ?? item.subject}
              {item.chapter ? ` · ${item.chapter}` : ''}
            </p>
            {item.status === 'REJECTED' && item.adminNote && (
              <p style={{ margin: '.5rem 0 0', fontSize: '.82rem', color: '#e53', background: '#fef2f2', padding: '.5rem .65rem', borderRadius: 8 }}>
                Lý do từ chối: {item.adminNote}
              </p>
            )}
            {item.status === 'APPROVED' && (
              <p style={{ margin: '.5rem 0 0', fontSize: '.82rem', color: '#16a34a' }}>
                Đã dùng {item.usageCount} lần trong đề thi · +{item.usagePointsEarned}đ (tối đa 100đ)
              </p>
            )}
            {item.status === 'PENDING' && (
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.6rem' }}>
                <button className="btn-secondary" onClick={() => setEditingId(item.id)}>Sửa</button>
                <button className="btn-secondary" style={{ color: '#e53' }} onClick={() => void handleDelete(item.id)}>Xoá</button>
              </div>
            )}
          </div>
        )
      ))}
    </div>
  );
}

export default SubmissionsPage;
