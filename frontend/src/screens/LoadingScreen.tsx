// ─── LoadingScreen — màn hình chờ khi khởi tạo app ──────────────────────────

export default function LoadingScreen() {
  return (
    <div className="screen screen-center">
      <div className="loader-ring" />
      <p className="loading-text">Đang kết nối…</p>
    </div>
  );
}
