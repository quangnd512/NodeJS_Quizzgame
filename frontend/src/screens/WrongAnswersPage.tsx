import { useState, useEffect } from 'react';
import { getWrongAnswers, retryWrongAnswer } from '../lib/api.js';
import type { WrongAnswerItem, WrongAnswerListResponse, RetryResult } from '../lib/api.js';
import { SUBJECTS } from '../lib/constants.js';
import Spinner from '../components/Spinner.js';

const OPTION_ALPHA = ['A', 'B', 'C', 'D'];

function subjectName(id: string): string {
  return SUBJECTS.find((s) => s.id === id)?.name ?? id;
}

function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
}

// Mini quiz inline cho từng câu sai
function WrongAnswerRetry({
  item,
  sessionToken,
  onError,
  onCorrect,
}: {
  item: WrongAnswerItem;
  sessionToken: string;
  onError: (e: unknown) => void;
  onCorrect: () => void;
}) {
  const [selected, setSelected] = useState<unknown>(null);
  const [result, setResult]     = useState<RetryResult | null>(null);
  const [busy, setBusy]         = useState(false);

  const q = item.question;
  const opts = Array.isArray(q.options) ? (q.options as string[]) : [];

  async function handleSubmit() {
    if (selected === null) return;
    setBusy(true);
    try {
      const res = await retryWrongAnswer(sessionToken, item.id, selected);
      setResult(res);
      if (res.isCorrect) onCorrect();
    } catch (err) { onError(err); }
    finally { setBusy(false); }
  }

  function handleReset() {
    setSelected(null);
    setResult(null);
  }

  if (result) {
    const correctDisplay = (() => {
      if (q.type === 'MCQ_4' && typeof result.correctAnswer === 'number') {
        return `${OPTION_ALPHA[result.correctAnswer]}. ${opts[result.correctAnswer] ?? ''}`;
      }
      if (q.type === 'TRUE_FALSE_4' && Array.isArray(result.correctAnswer)) {
        return (result.correctAnswer as boolean[]).map((v, i) => `${OPTION_ALPHA[i]}: ${v ? 'Đúng' : 'Sai'}`).join(' | ');
      }
      if (q.type === 'FILL_BLANK' && Array.isArray(result.correctAnswer)) {
        return (result.correctAnswer as string[]).join(' hoặc ');
      }
      return String(result.correctAnswer);
    })();

    return (
      <div style={{ marginTop: '.75rem', padding: '.75rem', background: result.isCorrect ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)', borderRadius: '10px', border: `1px solid ${result.isCorrect ? '#22c55e' : '#ef4444'}` }}>
        <p style={{ margin: '0 0 .4rem', fontWeight: 700, color: result.isCorrect ? '#15803d' : '#dc2626' }}>
          {result.isCorrect ? '✅ Đúng rồi!' : '❌ Chưa đúng'}
        </p>
        <p style={{ margin: '0 0 .25rem', fontSize: '.85rem' }}><strong>Đáp án đúng:</strong> {correctDisplay}</p>
        {result.explanation && (
          <p style={{ margin: '0 0 .5rem', fontSize: '.82rem', color: '#555' }}>{result.explanation}</p>
        )}
        <button className="btn-link" style={{ fontSize: '.82rem' }} onClick={handleReset}>Thử lại</button>
      </div>
    );
  }

  // Render input theo loại câu
  if (q.type === 'MCQ_4') {
    return (
      <div style={{ marginTop: '.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {opts.map((opt, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              style={{
                padding: '.5rem .75rem', borderRadius: '8px', textAlign: 'left', fontSize: '.88rem',
                border: selected === i ? '2px solid #6366f1' : '1px solid #ddd',
                background: selected === i ? '#eef2ff' : '#fafafa',
                cursor: 'pointer',
              }}
            >
              {OPTION_ALPHA[i]}. {opt}
            </button>
          ))}
        </div>
        <button
          className="btn-primary"
          style={{ marginTop: '.6rem', fontSize: '.88rem', padding: '.45rem 1rem' }}
          disabled={selected === null || busy}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'Đang kiểm tra…' : 'Kiểm tra'}
        </button>
      </div>
    );
  }

  if (q.type === 'TRUE_FALSE_4') {
    const sel = Array.isArray(selected) ? (selected as (boolean | null)[]) : [null, null, null, null];
    return (
      <div style={{ marginTop: '.75rem' }}>
        {opts.map((stmt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.4rem' }}>
            <span style={{ flex: 1, fontSize: '.88rem' }}>{OPTION_ALPHA[i]}. {stmt}</span>
            <button
              onClick={() => { const next = [...sel]; next[i] = true; setSelected(next); }}
              style={{ padding: '.25rem .6rem', borderRadius: '6px', border: sel[i] === true ? '2px solid #22c55e' : '1px solid #ddd', background: sel[i] === true ? '#dcfce7' : '#fafafa', cursor: 'pointer', fontSize: '.82rem' }}
            >Đúng</button>
            <button
              onClick={() => { const next = [...sel]; next[i] = false; setSelected(next); }}
              style={{ padding: '.25rem .6rem', borderRadius: '6px', border: sel[i] === false ? '2px solid #ef4444' : '1px solid #ddd', background: sel[i] === false ? '#fee2e2' : '#fafafa', cursor: 'pointer', fontSize: '.82rem' }}
            >Sai</button>
          </div>
        ))}
        <button
          className="btn-primary"
          style={{ marginTop: '.5rem', fontSize: '.88rem', padding: '.45rem 1rem' }}
          disabled={sel.some((v) => v === null) || busy}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'Đang kiểm tra…' : 'Kiểm tra'}
        </button>
      </div>
    );
  }

  // FILL_BLANK
  return (
    <div style={{ marginTop: '.75rem' }}>
      <input
        type="text"
        placeholder="Nhập đáp án…"
        style={{ width: '100%', padding: '.5rem .75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '.88rem', boxSizing: 'border-box' }}
        value={typeof selected === 'string' ? selected : ''}
        onChange={(e) => setSelected(e.target.value)}
      />
      <button
        className="btn-primary"
        style={{ marginTop: '.5rem', fontSize: '.88rem', padding: '.45rem 1rem' }}
        disabled={!selected || busy}
        onClick={() => void handleSubmit()}
      >
        {busy ? 'Đang kiểm tra…' : 'Kiểm tra'}
      </button>
    </div>
  );
}

function WrongAnswerCard({
  item,
  sessionToken,
  onError,
  isRetriedCorrectly,
  onRetryCorrect,
}: {
  item: WrongAnswerItem;
  sessionToken: string;
  onError: (e: unknown) => void;
  isRetriedCorrectly: boolean;
  onRetryCorrect: () => void;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [showRetry,  setShowRetry]  = useState(false);
  const q = item.question;

  const correctDisplay = (() => {
    if (q.type === 'MCQ_4') {
      const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
      const idx = typeof q.correctAnswer === 'number' ? q.correctAnswer : -1;
      return idx >= 0 ? `${OPTION_ALPHA[idx]}. ${opts[idx] ?? ''}` : String(q.correctAnswer);
    }
    if (q.type === 'TRUE_FALSE_4' && Array.isArray(q.correctAnswer)) {
      return (q.correctAnswer as boolean[]).map((v, i) => `${OPTION_ALPHA[i]}: ${v ? 'Đúng' : 'Sai'}`).join(' | ');
    }
    if (q.type === 'FILL_BLANK' && Array.isArray(q.correctAnswer)) {
      return (q.correctAnswer as string[]).join(' hoặc ');
    }
    return String(q.correctAnswer);
  })();

  return (
    <div style={{
      background: isRetriedCorrectly ? '#f0fdf4' : '#fff',
      borderRadius: '12px', padding: '1rem',
      boxShadow: '0 1px 4px rgba(0,0,0,.08)', marginBottom: '.75rem',
      border: isRetriedCorrectly ? '1.5px solid #86efac' : '1.5px solid transparent',
      opacity: isRetriedCorrectly ? 0.8 : 1,
    }}>
      {/* Badge môn + số lần sai + hết hạn */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.6rem' }}>
        <span style={{ background: '#eef2ff', color: '#4338ca', borderRadius: '6px', padding: '.15rem .55rem', fontSize: '.78rem', fontWeight: 600 }}>
          {subjectName(q.subjectId)}
        </span>
        <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '6px', padding: '.15rem .55rem', fontSize: '.78rem', fontWeight: 600 }}>
          Sai {item.wrongCount} lần
        </span>
        {isRetriedCorrectly && (
          <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: '6px', padding: '.15rem .55rem', fontSize: '.78rem', fontWeight: 600 }}>
            ✅ Đã làm đúng
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '.76rem' }}>
          Hết hạn sau {daysLeft(item.expiresAt)} ngày
        </span>
      </div>

      {/* Nội dung câu hỏi */}
      <p style={{ margin: '0 0 .75rem', fontSize: '.92rem', lineHeight: 1.5 }}>{q.content}</p>

      {/* Options (với MCQ_4 / TRUE_FALSE_4) */}
      {q.type !== 'FILL_BLANK' && Array.isArray(q.options) && (
        <div style={{ marginBottom: '.6rem' }}>
          {(q.options as string[]).map((opt, i) => (
            <div key={i} style={{ fontSize: '.85rem', color: '#555', marginBottom: '.2rem' }}>
              {OPTION_ALPHA[i]}. {opt}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        <button
          className="btn-secondary"
          style={{ fontSize: '.82rem', padding: '.35rem .75rem' }}
          onClick={() => { setShowAnswer((v) => !v); setShowRetry(false); }}
        >
          {showAnswer ? 'Ẩn đáp án' : 'Xem đáp án'}
        </button>
        <button
          className="btn-secondary"
          style={{ fontSize: '.82rem', padding: '.35rem .75rem', background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
          onClick={() => { setShowRetry((v) => !v); setShowAnswer(false); }}
        >
          {showRetry ? 'Ẩn làm lại' : 'Làm lại'}
        </button>
      </div>

      {/* Đáp án */}
      {showAnswer && (
        <div style={{ marginTop: '.6rem', padding: '.6rem .75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: 0, fontSize: '.85rem' }}><strong>Đáp án đúng:</strong> {correctDisplay}</p>
          {q.explanation && (
            <p style={{ margin: '.35rem 0 0', fontSize: '.82rem', color: '#555' }}>{q.explanation}</p>
          )}
        </div>
      )}

      {/* Mini quiz inline */}
      {showRetry && (
        <WrongAnswerRetry item={item} sessionToken={sessionToken} onError={onError} onCorrect={onRetryCorrect} />
      )}
    </div>
  );
}

function WrongAnswersPage({
  sessionToken, isPremium, onBack, onError,
}: {
  sessionToken: string;
  /** Feature 015 (Free/Premium): Free bị khoá hoàn toàn tính năng này. */
  isPremium: boolean;
  onBack: () => void;
  onError: (e: unknown) => void;
}) {
  const [subject,           setSubject]           = useState('');
  const [page,              setPage]              = useState(1);
  const [data,              setData]              = useState<WrongAnswerItem[]>([]);
  const [total,             setTotal]             = useState(0);
  const [loading,           setLoading]           = useState(true);
  const [retriedCorrectIds, setRetriedCorrectIds] = useState<Set<number>>(new Set());
  const PAGE_SIZE = 20;

  async function fetchData(p: number, subj: string) {
    setLoading(true);
    try {
const res: WrongAnswerListResponse = await getWrongAnswers(sessionToken, subj || undefined, p, PAGE_SIZE);
      setData(res.data);
      setTotal(res.total);
    } catch (err) { onError(err); }
    finally { setLoading(false); }
  }

  // Load dữ liệu lần đầu khi mount — CHỈ khi Premium (Free bị khoá hoàn toàn,
  // không cần gọi API vì backend cũng sẽ chặn 403 WRONG_ANSWER_REVIEW_PREMIUM_ONLY).
  useEffect(() => {
    if (!isPremium) {
      setLoading(false); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    void fetchData(1, '');
  }, [isPremium]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / PAGE_SIZE);

  async function handlePageChange(next: number) {
    setPage(next);
    await fetchData(next, subject);
  }

  function handleSubjectChange(newSubject: string) {
    setSubject(newSubject);
    setPage(1);
    void fetchData(1, newSubject);
  }

  function handleRetryCorrect(id: number) {
    setRetriedCorrectIds((prev) => new Set(prev).add(id));
  }

  return (
    <div className="screen" style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '1rem 1.25rem .75rem', background: 'linear-gradient(135deg,#f093fb,#f5576c)', color: '#fff' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', padding: 0 }}>←</button>
        <h2 style={{ flex: 1, margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>❌ Ôn Câu Sai</h2>
        <span style={{ fontSize: '.82rem', opacity: .85 }}>{total} câu</span>
      </div>

      {!isPremium ? (
        /* Feature 015 (Free/Premium): khoá hoàn toàn — banner nâng cấp thay vì danh sách câu sai */
        <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2.5rem', margin: '0 0 .75rem' }}>⭐</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: '#334155' }}>
            Ôn lại câu sai là quyền lợi Premium
          </p>
          <p style={{ margin: '.5rem 0 0', fontSize: '.9rem', color: '#64748b' }}>
            Nâng cấp Premium để xem lại và luyện tập những câu bạn đã trả lời sai, giúp học hiệu quả hơn.
          </p>
        </div>
      ) : (
        <>
          {/* Filter môn */}
          <div style={{ padding: '.75rem 1.25rem', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
            <select
              value={subject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              style={{ width: '100%', padding: '.5rem .75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '.9rem', background: '#fafafa' }}
            >
              <option value="">Tất cả môn học</option>
              {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
            </select>
          </div>

          {/* Nội dung */}
          <div style={{ padding: '1rem 1.25rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <Spinner />
                <p style={{ margin: '.75rem 0 0', color: '#94a3b8', fontSize: '.88rem' }}>Đang tải danh sách câu sai…</p>
              </div>
            ) : data.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <p style={{ fontSize: '2rem', margin: '0 0 .75rem' }}>🎉</p>
                <p style={{ margin: 0, fontWeight: 600 }}>Không có câu sai nào</p>
                <p style={{ margin: '.35rem 0 0', fontSize: '.88rem' }}>
                  {subject ? 'Thử chọn môn khác hoặc học tốt lắm!' : 'Bạn chưa có câu sai nào còn hạn. Tiếp tục cố gắng!'}
                </p>
              </div>
            ) : (
              <>
                {data.map((item) => (
                  <WrongAnswerCard
                    key={item.id}
                    item={item}
                    sessionToken={sessionToken}
                    onError={onError}
                    isRetriedCorrectly={retriedCorrectIds.has(item.id)}
                    onRetryCorrect={() => handleRetryCorrect(item.id)}
                  />
                ))}

                {/* Phân trang */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '.75rem', marginTop: '1rem' }}>
                    <button
                      className="btn-secondary"
                      disabled={page <= 1 || loading}
                      onClick={() => void handlePageChange(page - 1)}
                    >← Trước</button>
                    <span style={{ fontSize: '.88rem', color: '#64748b' }}>Trang {page}/{totalPages}</span>
                    <button
                      className="btn-secondary"
                      disabled={page >= totalPages || loading}
                      onClick={() => void handlePageChange(page + 1)}
                    >Sau →</button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default WrongAnswersPage;
