// ─── OnboardingPage — chọn môn học khi đăng ký lần đầu / đổi môn ────────────

import { useState } from 'react';
import { updateSubjects } from '../lib/api.js';
import Spinner from '../components/Spinner.js';
import { SUBJECTS } from '../lib/constants.js';

export default function OnboardingPage({
  sessionToken,
  currentSubjects,
  onDone,
  onError,
}: {
  sessionToken: string;
  /** Mã các môn ĐÃ chọn trước đó (profile.subjects) — dùng làm initial state để tránh bug hiển thị trống khi mở lại màn "Đổi môn". */
  currentSubjects: string[];
  onDone: () => void;
  onError: (e: unknown) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(currentSubjects));
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 7) next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await updateSubjects(sessionToken, [...selected]);
      onDone();
    } catch (err) { onError(err); setBusy(false); }
  }

  const count = selected.size;

  return (
    <div className="screen screen-onboarding">
      <div className="onboarding-header">
        <h2 className="page-title">Chọn môn học</h2>
        <p className="page-sub">Chọn các môn bạn muốn ôn thi để cá nhân hoá nội dung</p>
        <div className="counter-badge">
          <span className={count >= 7 ? 'full' : ''}>{count}</span>/7 môn đã chọn
        </div>
      </div>

      <div className="subject-grid">
        {SUBJECTS.map((s) => {
          const isOn  = selected.has(s.id);
          const isOff = !isOn && count >= 7;
          return (
            <button
              key={s.id}
              className={`subject-card ${isOn ? 'on' : ''} ${isOff ? 'off' : ''}`}
              onClick={() => !isOff && toggle(s.id)}
            >
              <span className="sub-emoji">{s.emoji}</span>
              <span className="sub-name">{s.name}</span>
              {isOn && <span className="sub-check">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="onboarding-footer">
        <button
          className="btn-primary btn-lg"
          disabled={count === 0 || busy}
          onClick={() => void handleSubmit()}
        >
          {busy && <Spinner />}
          {busy ? 'Đang lưu…' : 'Bắt đầu ôn thi 🚀'}
        </button>
      </div>
    </div>
  );
}
