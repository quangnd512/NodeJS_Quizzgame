# ADR 004: Hệ thống xác thực 2 lớp — Firebase ID Token + JWT nội bộ

## Bối cảnh

QuizzGame dùng Firebase Authentication để xác minh danh tính người dùng (Google Sign-In).
Câu hỏi: sau khi đăng nhập, các request tiếp theo xác thực bằng cách nào?

**Lựa chọn A**: Gửi Firebase ID Token trong mỗi request → backend gọi Firebase SDK để xác thực.
**Lựa chọn B**: Phát JWT nội bộ sau đăng nhập → dùng JWT cho mọi request sau.

## Quyết định

Dùng **hệ thống 2 lớp**:
1. `POST /api/auth/login` nhận Firebase ID Token → xác thực qua Firebase Admin SDK → phát JWT nội bộ (7 ngày)
2. Mọi API khác nhận JWT nội bộ → xác thực bằng `jwt.verify()` (offline) → tra cứu `userId` thẳng vào DB

Hai middleware tương ứng trong `auth.middleware.ts`:
- `verifyFirebaseToken`: dùng duy nhất cho `/api/auth/login`
- `verifyAppToken`: dùng cho tất cả các route còn lại

## Lý do

**Firebase ID Token gọi Firebase mỗi request:**
- Mất ~100–300ms/request do gọi mạng đến Firebase
- Tốn phí Firebase API theo số lần gọi
- Phụ thuộc uptime của Firebase — nếu Firebase lỗi, mọi request đều thất bại

**JWT nội bộ xác thực offline:**
- `jwt.verify()` chỉ dùng toán học (HMAC-SHA256) → < 1ms, không cần mạng
- JWT payload chứa sẵn `userId` (PostgreSQL primary key) → tra cứu DB trực tiếp, không cần vòng qua `firebaseUid`
- Phù hợp cho cả HTTP API lẫn Socket.io (PvP real-time) với cùng một cơ chế

**Thời gian sống 7 ngày:**
- Phù hợp app mobile — user không cần đăng nhập lại thường xuyên
- Firebase ID Token chỉ sống 1 giờ → không thể dùng trực tiếp

## Hệ quả

- Firebase chỉ được gọi 1 lần/phiên đăng nhập, không phải mỗi request
- Nếu JWT bị lộ trong 7 ngày, không có cơ chế revoke (trade-off chấp nhận được ở giai đoạn này)
- `JWT_SECRET` phải đủ mạnh (>= 32 ký tự ngẫu nhiên) và không được lộ
