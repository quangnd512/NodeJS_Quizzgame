import { useState, useEffect } from 'react';
import {
  adminListUsers, adminGetUserDetail, adminBlockUser, adminResetPassword,
  adminSetUserRole, adminGrantPremium, adminDeleteUser, ApiError,
} from '../../lib/api.js';
import type { AdminUserListItem, AdminUserDetail } from '../../lib/api.js';
import Spinner from '../../components/Spinner.js';
import { USERS_PAGE_SIZE } from './adminConstants.js';

function AdminUsersPage({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [blockedFilter, setBlockedFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState('');
  // Feature 015 (Free/Premium): input số tháng + trạng thái busy riêng cho từng dòng user.
  const [grantMonths, setGrantMonths] = useState<Record<string, string>>({});
  const [grantBusyUserId, setGrantBusyUserId] = useState<string | null>(null);

  async function load(p = page) {
    setLoading(true);
    setError('');
    try {
      const isBlocked =
        blockedFilter === 'true' ? true : blockedFilter === 'false' ? false : undefined;
      const result = await adminListUsers(secret, {
        search: search || undefined,
        role: roleFilter || undefined,
        isBlocked,
        page: p,
        limit: USERS_PAGE_SIZE,
      });
      setUsers(result.users);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setPage(p);
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

  async function openDetail(userId: string) {
    setDetailLoading(true);
    setSelectedUser(null);
    try {
      const detail = await adminGetUserDetail(secret, userId);
      setSelectedUser(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải chi tiết');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleBlock(userId: string, isBlocked: boolean) {
    setActionBusy(true);
    try {
      await adminBlockUser(secret, userId, isBlocked);
      setNotice(isBlocked ? 'Đã khoá tài khoản.' : 'Đã mở khoá tài khoản.');
      setSelectedUser(null);
      void load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi thao tác');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleResetPassword(userId: string) {
    setActionBusy(true);
    try {
      const { resetLink } = await adminResetPassword(secret, userId);
      // Hien thi link trong prompt de admin copy.
      window.prompt('Link đặt lại mật khẩu (copy và gửi cho học sinh):', resetLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tạo link reset');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSetRole(userId: string, role: string) {
    setActionBusy(true);
    try {
      await adminSetUserRole(secret, userId, role);
      setNotice(`Đã đổi quyền thành ${role}.`);
      setSelectedUser(null);
      void load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi đổi quyền');
    } finally {
      setActionBusy(false);
    }
  }

  /** Feature 015 (Free/Premium): admin cấp Premium thủ công theo tháng cho 1 user. */
  async function handleGrantPremium(userId: string) {
    const raw = grantMonths[userId] ?? '1';
    const months = parseInt(raw, 10);
    if (isNaN(months) || months < 1 || months > 24) {
      setError('Số tháng cấp Premium phải là số nguyên từ 1 đến 24.');
      return;
    }
    setGrantBusyUserId(userId);
    try {
      const result = await adminGrantPremium(secret, userId, months);
      setNotice(
        `Đã cấp Premium ${months} tháng — hạn mới: ${new Date(result.premiumExpiresAt).toLocaleDateString('vi-VN')}.`,
      );
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Lỗi cấp Premium');
    } finally {
      setGrantBusyUserId(null);
    }
  }

  async function handleDelete(userId: string, displayName: string | null) {
    const confirmed = window.confirm(
      `Bạn chắc chắn muốn XOÁ tài khoản "${displayName ?? userId}"?\n\nThao tác này KHÔNG THỂ hoàn tác — tài khoản sẽ bị xoá khỏi hệ thống và Firebase.`,
    );
    if (!confirmed) return;
    setActionBusy(true);
    try {
      await adminDeleteUser(secret, userId);
      setNotice('Đã xoá tài khoản.');
      setSelectedUser(null);
      void load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xoá tài khoản');
    } finally {
      setActionBusy(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(1); }, [search, roleFilter, blockedFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="admin-users-page">
      <h2>👥 Quản lý người dùng</h2>

      {/* Bộ lọc */}
      <div className="admin-users-filters">
        <input
          type="text"
          placeholder="Tìm theo tên hoặc email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-search-input"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="admin-select">
          <option value="">Tất cả quyền</option>
          <option value="STUDENT">Học sinh</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select value={blockedFilter} onChange={(e) => setBlockedFilter(e.target.value)} className="admin-select">
          <option value="">Tất cả trạng thái</option>
          <option value="false">Đang hoạt động</option>
          <option value="true">Đã khoá</option>
        </select>
      </div>

      {notice && (
        <div className="admin-notice" onClick={() => setNotice('')}>{notice} ✕</div>
      )}
      {error && (
        <div className="admin-error">{error} <button onClick={() => setError('')}>✕</button></div>
      )}

      {/* Bảng danh sách */}
      {loading ? (
        <div className="admin-loading"><Spinner /> Đang tải...</div>
      ) : (
        <>
          <div style={{ marginBottom: '.5rem', color: '#64748b', fontSize: '.88rem' }}>
            {total} người dùng
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Email</th>
                <th>Quyền</th>
                <th>Trạng thái</th>
                <th>Đăng ký</th>
                <th>Premium</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName ?? '(chưa đặt)'}</td>
                  <td>{u.email ?? '—'}</td>
                  <td>
                    <span className={`role-badge ${u.role === 'ADMIN' ? 'role-admin' : 'role-student'}`}>
                      {u.role === 'ADMIN' ? '👑 Admin' : '🎓 Học sinh'}
                    </span>
                  </td>
                  <td>
                    {u.isBlocked
                      ? <span className="status-blocked">🔒 Bị khoá</span>
                      : <span className="status-active">✅ Hoạt động</span>}
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
                  <td>
                    <div className="grant-premium-form">
                      <input
                        type="number"
                        min={1}
                        max={24}
                        className="grant-premium-input"
                        value={grantMonths[u.id] ?? '1'}
                        disabled={grantBusyUserId === u.id}
                        onChange={(e) => setGrantMonths((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        aria-label="Số tháng cấp Premium"
                      />
                      <button
                        className="btn-secondary"
                        disabled={grantBusyUserId === u.id}
                        onClick={() => void handleGrantPremium(u.id)}
                        title="Cấp Premium theo số tháng"
                      >
                        {grantBusyUserId === u.id ? '…' : '🎁 Cấp'}
                      </button>
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn-secondary"
                      onClick={() => void openDetail(u.id)}
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Phân trang */}
          {totalPages > 1 && (
            <div className="admin-pagination">
              <button
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => void load(page - 1)}
              >← Trước</button>
              <span style={{ fontSize: '.88rem', color: '#64748b' }}>
                Trang {page}/{totalPages}
              </span>
              <button
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => void load(page + 1)}
              >Tiếp →</button>
            </div>
          )}
        </>
      )}

      {/* Modal chi tiết */}
      {(detailLoading || selectedUser) && (
        <div className="modal-overlay" onClick={() => { if (!actionBusy) setSelectedUser(null); }}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="admin-loading"><Spinner /> Đang tải chi tiết...</div>
            ) : selectedUser ? (
              <>
                <div className="modal-header">
                  <h3>{selectedUser.user.displayName ?? '(chưa đặt tên)'}</h3>
                  <button className="modal-close" onClick={() => setSelectedUser(null)}>✕</button>
                </div>

                {/* Thông tin cá nhân */}
                <div className="user-detail-section">
                  <p><strong>Email:</strong> {selectedUser.user.email ?? '—'}</p>
                  <p><strong>Điện thoại:</strong> {selectedUser.user.phone ?? '—'}</p>
                  <p><strong>Trường:</strong> {selectedUser.user.school ?? '—'}</p>
                  <p><strong>Tỉnh:</strong> {selectedUser.user.province ?? '—'}</p>
                  <p><strong>Quyền:</strong> {selectedUser.user.role === 'ADMIN' ? '👑 Admin' : '🎓 Học sinh'}</p>
                  <p><strong>Trạng thái:</strong> {selectedUser.user.isBlocked ? '🔒 Bị khoá' : '✅ Hoạt động'}</p>
                  <p><strong>Đăng ký:</strong> {new Date(selectedUser.user.createdAt).toLocaleDateString('vi-VN')}</p>
                  <p><strong>Đăng nhập gần nhất:</strong> {selectedUser.user.lastLoginAt ? new Date(selectedUser.user.lastLoginAt).toLocaleString('vi-VN') : '—'}</p>
                </div>

                {/* Thống kê */}
                <div className="user-detail-section">
                  <h4>📊 Thống kê</h4>
                  <p><strong>Phiên ôn tập:</strong> {selectedUser.stats.totalPracticeSessions}</p>
                  <p><strong>Lần thi thử:</strong> {selectedUser.stats.totalExamSessions}</p>
                  <p><strong>Điểm thi TB:</strong> {selectedUser.stats.avgExamScore !== null ? selectedUser.stats.avgExamScore.toFixed(1) : '—'}</p>
                </div>

                {/* Lịch sử thi gần nhất */}
                {selectedUser.recentExams.length > 0 && (
                  <div className="user-detail-section">
                    <h4>📝 Lịch sử thi gần nhất</h4>
                    <table className="admin-table" style={{ fontSize: '.85rem' }}>
                      <thead>
                        <tr><th>Đề thi</th><th>Điểm</th><th>Trạng thái</th><th>Ngày</th></tr>
                      </thead>
                      <tbody>
                        {selectedUser.recentExams.map((e) => (
                          <tr key={e.id}>
                            <td>{e.examPaperTitle}</td>
                            <td>{e.score !== null ? e.score.toFixed(1) : '—'}</td>
                            <td>{e.status === 'COMPLETED' ? '✅' : e.status === 'EXPIRED' ? '⏰' : '🔄'} {e.status}</td>
                            <td>{e.completedAt ? new Date(e.completedAt).toLocaleDateString('vi-VN') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Actions */}
                <div className="user-detail-actions">
                  <button
                    className={selectedUser.user.isBlocked ? 'btn-primary' : 'btn-warning'}
                    disabled={actionBusy}
                    onClick={() => void handleBlock(selectedUser.user.id, !selectedUser.user.isBlocked)}
                  >
                    {selectedUser.user.isBlocked ? '🔓 Mở khoá' : '🔒 Khoá tài khoản'}
                  </button>

                  <button
                    className="btn-secondary"
                    disabled={actionBusy || !selectedUser.user.email}
                    title={!selectedUser.user.email ? 'Tài khoản này không có email' : ''}
                    onClick={() => void handleResetPassword(selectedUser.user.id)}
                  >
                    🔑 Reset mật khẩu
                  </button>

                  <button
                    className="btn-secondary"
                    disabled={actionBusy}
                    onClick={() => void handleSetRole(
                      selectedUser.user.id,
                      selectedUser.user.role === 'ADMIN' ? 'STUDENT' : 'ADMIN',
                    )}
                  >
                    {selectedUser.user.role === 'ADMIN' ? '👇 Hạ xuống Học sinh' : '👑 Nâng lên Admin'}
                  </button>

                  <button
                    className="btn-danger"
                    disabled={actionBusy}
                    onClick={() => void handleDelete(selectedUser.user.id, selectedUser.user.displayName)}
                  >
                    🗑️ Xoá tài khoản
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsersPage;
