[BACKLOG — HẠ TẦNG VẬN HÀNH, làm TRƯỚC khi deploy thật]

# Giám sát & cảnh báo (observability)

## Vấn đề
Hiện tại nếu phần mềm hỏng lúc đang chạy thật, **không ai biết** cho đến khi có người
dùng phàn nàn. Không có cách trả lời các câu hỏi cơ bản:
- Server còn sống không?
- Có bao nhiêu lỗi trong 1 giờ qua?
- API nào đang chậm?

## Hiện trạng đã kiểm tra (2026-09-03)
- ❌ Không có endpoint `/health` — hosting (Render/Railway) cần cái này để biết khi nào
  app chết mà khởi động lại; dịch vụ uptime cũng cần để báo bạn khi web sập
- ❌ Không có logger có cấu trúc (đang dùng `console.log`) — log dạng chữ thường không
  lọc/tìm được khi có sự cố
- ❌ Không có công cụ thu thập lỗi phía người dùng

## Đề xuất — chia 3 mức, làm dần

**Mức 1 — Tối thiểu, làm TRƯỚC khi deploy** (nhỏ, ~1 vòng S1-S8)
- Endpoint `GET /api/health` trả `{ status, uptime, database: 'ok'|'error' }`
  (có kiểm tra kết nối DB thật, không chỉ trả 200 suông)
- Đăng ký một dịch vụ uptime miễn phí (UptimeRobot / Better Stack) ping endpoint đó
  5 phút/lần, gửi email khi sập

**Mức 2 — Khi đã có người dùng thật**
- Thay `console.log` bằng logger có cấu trúc (`pino` — nhẹ, nhanh)
- Log dạng JSON kèm `requestId` để lần theo được một request qua nhiều tầng
- Không bao giờ log token/mật khẩu

**Mức 3 — Khi có nhiều người dùng**
- Sentry (có gói miễn phí) cho cả backend, web và mobile — tự gom lỗi phía người dùng
- Cảnh báo khi tỉ lệ lỗi vượt ngưỡng

## Vì sao chưa làm ngay
Dự án chưa deploy thật nên chưa có gì để giám sát. Nhưng **Mức 1 phải xong trước khi
S9 đưa lên môi trường thật** — deploy mà không có health check là bay không có đồng hồ.

📄 Phát hiện khi đánh giá quy trình theo chuẩn DevOps hiện đại, 2026-09-03
