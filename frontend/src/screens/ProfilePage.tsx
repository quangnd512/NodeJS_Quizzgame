import { useState, useEffect, useRef } from 'react';
import { updateProfile, uploadAvatar, deleteAvatar } from '../lib/api.js';
import type { UserProfile, ActiveExamSession as ActiveExamSessionInfo } from '../lib/api.js';
import Spinner from '../components/Spinner.js';

// Duplicate từ App.tsx — getInitials được giữ lại cả ở App.tsx theo yêu cầu S1,
// nhưng ProfilePage cũng cần → copy local để tránh circular dependency
function getInitials(name: string | null, email: string | null): string {
  const src = name ?? email ?? '?';
  return src.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function ProfilePage({
  profile, sessionToken, onProfileUpdate, onChangeSubjects, onPractice, onExam, onLeaderboard, onProgress, onWrongAnswers, onSubmissions, onBattle, onError, onLogout,
  resumeAlert, onResumeExam, onAbandonResume, unreadCount, onNotifClick,
}: {
  profile: UserProfile;
  sessionToken: string;
  onProfileUpdate: (p: UserProfile) => void;
  onChangeSubjects: () => void;
  onPractice: () => void;
  onExam: () => void;
  onLeaderboard: () => void;
  onProgress: () => void;
  onWrongAnswers: () => void;
  onSubmissions: () => void;
  onBattle: () => void;
  onError: (e: unknown) => void;
  onLogout: () => void;
  resumeAlert?: ActiveExamSessionInfo | null;
  onResumeExam?: () => void;
  onAbandonResume?: () => void;
  unreadCount?: number;
  onNotifClick?: () => void;
}) {
  const [editMode, setEditMode]         = useState(false);
  const [busy, setBusy]                 = useState(false);
  const [saved, setSaved]               = useState(false);
  const [avatarBusy, setAvatarBusy]     = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile]   = useState<File | null>(null);
  const [avatarErr, setAvatarErr]       = useState('');
  const fileInputRef                    = useRef<HTMLInputElement>(null);
  const [form, setForm]                 = useState({
    displayName: profile.displayName ?? '',
    phone:       profile.phone       ?? '',
    school:      profile.school      ?? '',
    province:    profile.province    ?? '',
  });

  const prevId = useRef(profile.id);
  useEffect(() => {
    if (profile.id !== prevId.current) {
      prevId.current = profile.id;
      setForm({
        displayName: profile.displayName ?? '',
        phone: profile.phone ?? '',
        school: profile.school ?? '',
        province: profile.province ?? '',
      });
    }
  }, [profile]);

  async function handleSave() {
    setBusy(true);
    try {
      const updated = await updateProfile(sessionToken, {
        displayName: form.displayName.trim() || null,
        phone:       form.phone.trim()       || null,
        school:      form.school.trim()      || null,
        province:    form.province.trim()    || null,
      });
      onProfileUpdate(updated);
      setEditMode(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { onError(err); }
    finally { setBusy(false); }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarErr('');
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setAvatarErr('Chỉ chấp nhận file JPG hoặc PNG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarErr('Ảnh quá lớn, tối đa 2MB.');
      return;
    }
    setPendingFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    // Reset input để có thể chọn lại cùng file
    e.target.value = '';
  }

  async function handleAvatarSave() {
    if (!pendingFile) return;
    setAvatarBusy(true);
    try {
      const updated = await uploadAvatar(sessionToken, pendingFile);
      onProfileUpdate(updated);
      setPendingFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
    } catch (err) { onError(err); }
    finally { setAvatarBusy(false); }
  }

  function handleAvatarCancel() {
    setPendingFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarErr('');
  }

  async function handleAvatarDelete() {
    if (!confirm('Xoá ảnh đại diện?')) return;
    setAvatarBusy(true);
    try {
      const updated = await deleteAvatar(sessionToken);
      onProfileUpdate(updated);
    } catch (err) { onError(err); }
    finally { setAvatarBusy(false); }
  }

  const displayAvatarUrl = avatarPreview ?? profile.avatarUrl;

  return (
    <div className="screen screen-profile">
      {/* Header */}
      <div className="profile-header">
        {/* Avatar có thể click để upload */}
        <div className="avatar-wrapper">
          <button
            className="avatar-btn"
            onClick={() => !avatarBusy && fileInputRef.current?.click()}
            title="Đổi ảnh đại diện"
            disabled={avatarBusy}
          >
            {displayAvatarUrl ? (
              <img src={displayAvatarUrl} alt="avatar" className="avatar-img" />
            ) : (
              <div className="avatar">{getInitials(profile.displayName, profile.email)}</div>
            )}
            <span className="avatar-overlay">📷</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        <div className="profile-id">
          <h2 className="profile-name">
            {profile.displayName ?? '(Chưa đặt tên)'}
            {profile.isPremium && <span className="premium-badge">⭐ Premium</span>}
          </h2>
          <p className="profile-email">{profile.email}</p>
        </div>
        <div className="header-actions">
          {/* Bell icon thông báo */}
          <button
            className="btn-icon btn-icon-bell"
            onClick={onNotifClick}
            title="Thông báo"
            aria-label={unreadCount ? `${unreadCount} thông báo chưa đọc` : 'Thông báo'}
          >
            🔔
            {!!unreadCount && unreadCount > 0 && (
              <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>
          <button className="btn-icon" onClick={onLogout} title="Đăng xuất">↩</button>
        </div>
      </div>

      {/* Avatar actions (preview / xóa) */}
      {avatarErr && <p style={{ color: 'var(--color-error, #e53)', padding: '0 1.25rem', fontSize: '.85rem' }}>{avatarErr}</p>}
      {pendingFile && (
        <div className="avatar-preview-bar">
          <span>Preview ảnh mới</span>
          <button className="btn-secondary" onClick={handleAvatarCancel} disabled={avatarBusy}>Huỷ</button>
          <button className="btn-primary" onClick={() => void handleAvatarSave()} disabled={avatarBusy}>
            {avatarBusy ? <><Spinner /> Đang lưu…</> : 'Lưu ảnh'}
          </button>
        </div>
      )}
      {!pendingFile && profile.avatarUrl && (
        <div style={{ padding: '0 1.25rem .5rem' }}>
          <button className="btn-link" style={{ color: '#e53' }} onClick={() => void handleAvatarDelete()} disabled={avatarBusy}>
            {avatarBusy ? 'Đang xoá…' : 'Xoá ảnh đại diện'}
          </button>
        </div>
      )}

      {/* Modal bài thi đang dở — hiện ngay khi quay lại app */}
      {resumeAlert && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box modal-resume">
            <div className="modal-resume-icon">📋</div>
            <h3 className="modal-title">Bài thi đang dở</h3>
            <p className="modal-body">
              Bạn có bài thi <strong>{resumeAlert.title || resumeAlert.subject}</strong>
              {resumeAlert.remainingSeconds > 0
                ? ` còn ${Math.ceil(resumeAlert.remainingSeconds / 60)} phút`
                : ' đã hết giờ'}
              . Bạn muốn tiếp tục hay huỷ bài?
            </p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={onResumeExam}>
                ▶ Tiếp tục làm bài
              </button>
              <button className="btn-secondary" onClick={onAbandonResume}>
                Huỷ bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Points */}
      <div className="points-card">
        <span className="pts-label">Điểm tích lũy</span>
        <span className="pts-num">{profile.points.toLocaleString('vi-VN')}</span>
        <span className="pts-unit">điểm</span>
      </div>

      {/* Practice + Exam + Leaderboard CTA */}
      <div style={{ padding: '0 1.25rem .75rem', display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
        <button className="btn-primary btn-lg" onClick={onPractice}>
          Bắt đầu ôn tập 📚
        </button>
        <button className="btn-secondary btn-lg" onClick={onExam}>
          Thi thử 🎯
        </button>
        <button className="btn-secondary btn-lg" onClick={onLeaderboard} style={{ background: 'linear-gradient(135deg,#f6d365,#fda085)', color: '#333', border: 'none' }}>
          🏆 Bảng xếp hạng
        </button>
        <button className="btn-secondary btn-lg" onClick={onBattle} style={{ background: 'linear-gradient(135deg,#ff6a6a,#8b0000)', color: '#fff', border: 'none' }}>
          ⚔️ Thi đấu
        </button>
        <button className="btn-secondary btn-lg" onClick={onProgress} style={{ background: 'linear-gradient(135deg,#a8edea,#fed6e3)', color: '#333', border: 'none' }}>
          📊 Tiến độ của tôi
        </button>
        <button className="btn-secondary btn-lg" onClick={onWrongAnswers} style={{ background: 'linear-gradient(135deg,#f093fb,#f5576c)', color: '#fff', border: 'none' }}>
          ❌ Ôn câu sai
        </button>
        <button className="btn-secondary btn-lg" onClick={onSubmissions} style={{ background: 'linear-gradient(135deg,#84fab0,#8fd3f4)', color: '#333', border: 'none' }}>
          ✍️ Gửi câu hỏi
        </button>
      </div>

      {/* Subjects */}
      <section className="card-section">
        <div className="section-row">
          <h3 className="section-title">Môn học đang ôn</h3>
          <button className="btn-link" onClick={onChangeSubjects}>Đổi môn</button>
        </div>
        <div className="chips">
          {profile.subjects.length === 0
            ? <span className="empty">Chưa chọn môn nào</span>
            : profile.subjects.map((s) => <span key={s.id} className="chip">{s.name}</span>)}
        </div>
      </section>

      {/* Profile edit */}
      <section className="card-section">
        <div className="section-row">
          <h3 className="section-title">Hồ sơ cá nhân</h3>
          {!editMode && <button className="btn-link" onClick={() => setEditMode(true)}>Chỉnh sửa</button>}
        </div>

        {saved && <div className="save-banner">✓ Đã lưu thành công</div>}

        {editMode ? (
          <div className="edit-form">
            {([
              ['displayName', 'Họ và tên',           'Nguyễn Văn A'],
              ['phone',       'Số điện thoại',        '0901 234 567'],
              ['school',      'Trường THPT',          'THPT Chu Văn An'],
              ['province',    'Tỉnh / Thành phố',     'Hà Nội'],
            ] as const).map(([key, label, ph]) => (
              <label key={key} className="form-field">
                <span className="field-label">{label}</span>
                <input
                  className="field-input"
                  value={form[key]}
                  placeholder={ph}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
            <div className="edit-btns">
              <button className="btn-secondary" onClick={() => setEditMode(false)}>Huỷ</button>
              <button className="btn-primary" disabled={busy} onClick={() => void handleSave()}>
                {busy && <Spinner />}{busy ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        ) : (
          <div className="info-list">
            {[
              ['Số điện thoại', profile.phone],
              ['Trường THPT',   profile.school],
              ['Tỉnh / TP',     profile.province],
              ['Tham gia',      new Date(profile.createdAt).toLocaleDateString('vi-VN')],
              ['Đăng nhập cuối', profile.lastLoginAt
                ? new Date(profile.lastLoginAt).toLocaleString('vi-VN') : null],
            ].map(([label, val]) => (
              <div key={label as string} className="info-row">
                <span className="info-label">{label}</span>
                <span className={`info-val ${!val ? 'muted' : ''}`}>{val ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default ProfilePage;
