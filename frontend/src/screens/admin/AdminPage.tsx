import { useState, useEffect } from 'react';
import { adminGetReportsSummary, adminListSubmissions, ApiError } from '../../lib/api.js';
import Spinner from '../../components/Spinner.js';
import AdminDashboardPage from './AdminDashboardPage.js';
import AdminUsersPage from './AdminUsersPage.js';
import { AdminQuestionManagementPage } from './AdminSubmissionsPage.js';
import AdminExamPage from './AdminExamPage.js';
import AdminQuestionBankPage from './AdminQuestionBankPage.js';

type AdminTab = 'dashboard' | 'users' | 'questions' | 'exams' | 'bank';

function AdminPage() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem('adminSecret') ?? '');
  const [tab, setTab] = useState<AdminTab>('dashboard');
  // Badge tổng "chờ xử lý" trên tab cha "Câu hỏi" — gộp cả bài học sinh gửi (PENDING)
  // + báo cáo lỗi (pendingReports). Refetch mỗi khi đổi tab để cập nhật sau khi xử lý xong.
  const [questionsPendingBadge, setQuestionsPendingBadge] = useState(0);

  useEffect(() => {
    if (!secret) return;
    let cancelled = false;
    async function loadBadge() {
      try {
        const [summary, subs] = await Promise.all([
          adminGetReportsSummary(secret),
          adminListSubmissions(secret, { status: 'PENDING', limit: 1 }),
        ]);
        if (!cancelled) setQuestionsPendingBadge(summary.pendingReports + subs.total);
      } catch { /* bỏ qua — không để lỗi badge làm hỏng trang admin */ }
    }
    void loadBadge();
    return () => { cancelled = true; };
  }, [secret, tab]);

  function handleLoginSuccess(value: string) {
    sessionStorage.setItem('adminSecret', value);
    setSecret(value);
  }

  function handleLogout() {
    sessionStorage.removeItem('adminSecret');
    setSecret('');
  }

  if (!secret) {
    return <AdminLoginPage onSuccess={handleLoginSuccess} />;
  }

  return (
    <div>
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          📊 Dashboard
        </button>
        <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          👥 Người dùng
        </button>
        <button className={`admin-tab ${tab === 'questions' ? 'active' : ''}`} onClick={() => setTab('questions')}>
          Câu hỏi
          {questionsPendingBadge > 0 && <span className="admin-tab-badge">{questionsPendingBadge}</span>}
        </button>
        <button className={`admin-tab ${tab === 'exams' ? 'active' : ''}`} onClick={() => setTab('exams')}>
          Đề thi thử
        </button>
        <button className={`admin-tab ${tab === 'bank' ? 'active' : ''}`} onClick={() => setTab('bank')}>
          Ngân hàng câu hỏi
        </button>
        <button className="btn-link admin-tab-logout" onClick={handleLogout}>
          Đăng xuất
        </button>
      </div>
      {tab === 'dashboard' && <AdminDashboardPage secret={secret} onLogout={handleLogout} />}
      {tab === 'users'     && <AdminUsersPage secret={secret} onLogout={handleLogout} />}
      {tab === 'questions' && <AdminQuestionManagementPage secret={secret} onLogout={handleLogout} />}
      {tab === 'exams'     && <AdminExamPage secret={secret} onLogout={handleLogout} />}
      {tab === 'bank'      && <AdminQuestionBankPage secret={secret} onLogout={handleLogout} />}
    </div>
  );
}

// ─── AdminLoginPage ─────────────────────────────────────────────────────────────

function AdminLoginPage({ onSuccess }: { onSuccess: (secret: string) => void }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    const value = input.trim();
    if (!value || busy) return;
    setBusy(true);
    setError('');
    try {
      await adminGetReportsSummary(value);
      onSuccess(value);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError('Mã bí mật không đúng.');
      } else {
        setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen screen-center screen-login">
      <div className="login-card">
        <div className="brand">
          <div className="brand-icon">A</div>
          <h1 className="brand-name">QuizzGame Admin</h1>
          <p className="brand-sub">Quản lý báo cáo câu hỏi</p>
        </div>

        <hr className="divider" />

        <p className="login-headline">Đăng nhập quản trị</p>
        <label className="form-field">
          <span className="field-label">Mã bí mật (Admin Secret)</span>
          <input
            className="field-input"
            type="password"
            value={input}
            placeholder="Nhập mã bí mật"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
          />
        </label>

        {error && <p className="report-error">{error}</p>}

        <button className="btn-primary btn-lg" disabled={busy || !input.trim()} onClick={() => void handleSubmit()}>
          {busy && <Spinner />}{busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
        </button>
      </div>
    </div>
  );
}

export default AdminPage;
