import { useState, useEffect } from 'react';
import {
  getNotifications, markNotificationAsRead, markAllNotificationsAsRead,
} from '../lib/api.js';
import type { NotificationItem, NotificationTargetScreen } from '../lib/api.js';
import Spinner from './Spinner.js';

// Dùng nội bộ trong NotificationPanel để định dạng thời gian hiển thị.
function formatNotifTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1)  return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7)     return `${days} ngày trước`;
  return new Date(isoString).toLocaleDateString('vi-VN');
}

function notifTypeClass(type: NotificationItem['type']): string {
  switch (type) {
    case 'RANK_UP':          return 'notif-type-rank-up';
    case 'RANK_DOWN':        return 'notif-type-rank-down';
    case 'STREAK_MILESTONE': return 'notif-type-streak';
    case 'REPORT_RESOLVED':  return 'notif-type-report';
    case 'NEW_EXAM_PAPER':   return 'notif-type-exam';
    default:                 return '';
  }
}

export function NotificationToast({ item, onClose }: { item: NotificationItem; onClose: () => void }) {
  return (
    <div className={`notif-toast ${notifTypeClass(item.type)}`} role="alert" onClick={onClose}>
      <div className="notif-toast-content">
        <p className="notif-toast-title">{item.title}</p>
        <p className="notif-toast-body">{item.body}</p>
      </div>
      <button className="toast-close" aria-label="Đóng" onClick={(e) => { e.stopPropagation(); onClose(); }}>✕</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationPanel — drawer slide-in danh sách thông báo
// ─────────────────────────────────────────────────────────────────────────────

function NotificationPanel({
  sessionToken, onClose, onCountChange, onNavigate,
}: {
  sessionToken: string;
  onClose: () => void;
  onCountChange: (count: number) => void;
  /** Điều hướng sang màn hình tương ứng với targetScreen của thông báo (progress/leaderboard/exam) */
  onNavigate: (target: Exclude<NotificationTargetScreen, null>) => void;
}) {
  const [items, setItems]       = useState<NotificationItem[]>([]);
  const [loading, setLoading]   = useState(true); // bắt đầu ở trạng thái loading
  const [markBusy, setMarkBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // setLoading(true) không cần gọi lại — useState đã khởi tạo true
    getNotifications(sessionToken, 1, 50)
      .then((res) => {
        if (!cancelled) {
          setItems(res.notifications);
          onCountChange(res.unreadCount);
        }
      })
      .catch(() => { /* bỏ qua */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleMarkAll() {
    setMarkBusy(true);
    try {
      await markAllNotificationsAsRead(sessionToken);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      onCountChange(0);
    } catch { /* bỏ qua */ }
    finally { setMarkBusy(false); }
  }

  async function handleMarkOne(id: string) {
    try {
      await markNotificationAsRead(sessionToken, id);
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      const remaining = items.filter((n) => !n.isRead && n.id !== id).length;
      onCountChange(remaining);
    } catch { /* bỏ qua */ }
  }

  /**
   * Bấm vào 1 thông báo: LUÔN đánh dấu đã đọc (nếu chưa đọc), SAU ĐÓ điều hướng
   * sang màn hình tương ứng nếu thông báo có targetScreen (streak/rank → progress|leaderboard,
   * đề thi mới → exam). Thông báo báo cáo (targetScreen = null) chỉ đánh dấu đã đọc,
   * không chuyển màn hình — giữ đúng hành vi hiện tại.
   */
  function handleItemClick(n: NotificationItem) {
    if (!n.isRead) void handleMarkOne(n.id);
    if (n.targetScreen) onNavigate(n.targetScreen);
  }

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className="notif-overlay" onClick={onClose}>
      <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
        <div className="notif-panel-header">
          <h3>🔔 Thông báo {unread > 0 && <span className="notif-panel-badge">{unread}</span>}</h3>
          <div className="notif-panel-actions">
            {unread > 0 && (
              <button className="btn-link" onClick={() => void handleMarkAll()} disabled={markBusy}>
                {markBusy ? 'Đang xử lý…' : 'Đánh dấu tất cả đã đọc'}
              </button>
            )}
            <button className="btn-icon" onClick={onClose} aria-label="Đóng">✕</button>
          </div>
        </div>

        <div className="notif-panel-body">
          {loading && <div className="notif-empty"><Spinner /> Đang tải…</div>}
          {!loading && items.length === 0 && (
            <div className="notif-empty">Chưa có thông báo nào.</div>
          )}
          {!loading && items.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${notifTypeClass(n.type)}${n.isRead ? '' : ' notif-item--unread'}`}
              onClick={() => handleItemClick(n)}
            >
              <div className="notif-item-content">
                <p className="notif-item-title">{n.title}</p>
                <p className="notif-item-body">{n.body}</p>
                <p className="notif-item-time">{formatNotifTime(n.createdAt)}</p>
              </div>
              {!n.isRead && <span className="notif-dot" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NotificationPanel;
export { NotificationToast };
