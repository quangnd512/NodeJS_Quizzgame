import { useState, useEffect } from 'react';
import {
  adminGetDashboard, adminGetPremiumDefaultSetting, adminSetPremiumDefaultSetting, ApiError,
} from '../../lib/api.js';
import type { DashboardStats } from '../../lib/api.js';

/** Công tắc toàn cục "Mặc định Premium cho tất cả" (Feature 015 — Free/Premium). */
function PremiumDefaultToggle({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminGetPremiumDefaultSetting(secret)
      .then((res) => { if (!cancelled) setEnabled(res.enabled); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { onLogout(); return; }
        setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      });
    return () => { cancelled = true; };
  }, [secret]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle() {
    if (enabled === null || busy) return;
    const next = !enabled;
    setBusy(true);
    try {
      const res = await adminSetPremiumDefaultSetting(secret, next);
      setEnabled(res.enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi đổi công tắc');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="premium-toggle-card">
      <div className="premium-toggle-info">
        <strong>⭐ Mặc định Premium cho tất cả</strong>
        <p>
          Khi BẬT: mọi tài khoản (cũ lẫn mới) đều được coi là Premium.
          Khi TẮT: chỉ user được admin cấp Premium riêng (còn hạn) mới là Premium.
        </p>
        {error && <p className="premium-toggle-error">{error}</p>}
      </div>
      <button
        className={`premium-toggle-switch ${enabled ? 'on' : ''}`}
        disabled={enabled === null || busy}
        onClick={() => void handleToggle()}
        aria-pressed={enabled ?? false}
      >
        <span className="premium-toggle-knob" />
      </button>
    </div>
  );
}

function AdminDashboardPage({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await adminGetDashboard(secret);
      setStats(data);
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="admin-loading">Đang tải...</div>;
  if (error) return <div className="admin-error">{error} <button onClick={() => void load()}>Thử lại</button></div>;
  if (!stats) return null;

  const cards = [
    { label: 'Tổng học sinh', value: stats.totalUsers.toLocaleString(), icon: '👥' },
    { label: 'Mới trong tuần', value: stats.newUsersThisWeek.toLocaleString(), icon: '📅' },
    { label: 'Mới trong tháng', value: stats.newUsersThisMonth.toLocaleString(), icon: '📆' },
    { label: 'Tổng lượt thi', value: stats.totalExamSessions.toLocaleString(), icon: '📝' },
    { label: 'Tỉ lệ đạt (≥7)', value: `${stats.examPassRate}%`, icon: '✅' },
    { label: 'Đang online', value: stats.onlineNow.toLocaleString(), icon: '🟢' },
  ];

  return (
    <div className="admin-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>📊 Tổng quan hệ thống</h2>
        <button className="btn-secondary" onClick={() => void load()}>🔄 Làm mới</button>
      </div>

      <PremiumDefaultToggle secret={secret} onLogout={onLogout} />

      <div className="dashboard-cards">
        {cards.map((c) => (
          <div key={c.label} className="dashboard-card">
            <div className="dashboard-card-icon">{c.icon}</div>
            <div className="dashboard-card-value">{c.value}</div>
            <div className="dashboard-card-label">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminDashboardPage;
