[GHI CHÚ CHO S9 — LỘ TRÌNH RA MẮT]
Ngày lưu: 2026-09-08
Mục tiêu cuối cùng: Web + App Store (iOS) + Google Play (Android) + Admin panel

== ĐÃ SẴN SÀNG ==
- Backend API (Node.js + Express + PostgreSQL + Redis)
- Web frontend (React + Vite) — học sinh + admin
- Mobile app (React Native + Expo) — đang hoàn thiện

== CẦN LÀM ĐỂ LAUNCH WEB ==
1. Thuê server (Railway / Render / VPS) — $10-25/tháng
2. Thuê domain (ví dụ quizzgame.vn)
3. Deploy backend: Node.js + PostgreSQL + Redis trên server
4. Deploy frontend: build Vite → serve static hoặc Vercel/Netlify
5. Cấu hình SSL (Let's Encrypt — miễn phí)
6. Environment variables cho production (.env riêng)
7. CI/CD: auto-deploy khi push lên master

== CẦN LÀM THÊM ĐỂ LAUNCH APP STORE + GOOGLE PLAY ==
BẮT BUỘC (Apple từ chối nếu thiếu):
- Trang Privacy Policy (URL public)
- Trang Terms of Service
- Tính năng Tự xóa tài khoản (đã có trong backlog)
- Restore Purchases (Apple/Google policy)

THANH TOÁN THẬT (Premium không hoạt động trên mobile nếu thiếu):
- Apple StoreKit 2 (iOS In-App Purchase)
- Google Play Billing (Android)
- Backend xác thực receipt server-side (không tin client)
- Dùng thử Premium 7 ngày miễn phí

QUẢNG CÁO THẬT:
- Google AdMob (thay quảng cáo giả lập hiện tại)
- Backend endpoint xác minh "đã xem quảng cáo thật"

THỦ TỤC NỘP:
- Apple Developer Account ($99/năm)
- Google Play Developer Account ($25 một lần)
- EAS Build (Expo Application Services) để build .ipa + .aab
- App screenshots + store listing + mô tả
- Chờ Apple review (1-7 ngày), Google Play (1-3 ngày)

== THỜI GIAN ƯỚC TÍNH ==
- Website: 2-3 tuần sau khi quyết định
- App Store + Google Play: 2-3 tháng thêm

== LƯU Ý QUAN TRỌNG ==
- Admin panel đã tự nhiên quản lý mọi nền tảng (web/iOS/Android) vì tất cả dùng chung 1 backend
- Chỉ cần 1 admin panel trên web, không cần làm riêng cho từng platform
- Premium trên web hiện chỉ cấp qua admin tay — cần cổng thanh toán web (VNPay/Momo) trước khi web launch
