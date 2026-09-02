# Handoff từ S2-ThoCode → S3-SoatLoi

**Thời gian:** 2026-07-04  
**Branch:** feature/leaderboard

---

[TỪ S2-THOCODE]

✅ ĐÃ HOÀN THÀNH: Leaderboard — Bảng xếp hạng học sinh

📂 FILE ĐÃ TẠO/SỬA:

Backend:
- backend/prisma/schema.prisma (sửa — thêm avatarUrl String? vào User)
- backend/prisma/migrations/20260703175302_add_user_avatar_url/ (mới)
- backend/uploads/avatars/.gitkeep (mới — thư mục lưu ảnh)
- backend/src/services/users/users.types.ts (sửa — thêm avatarUrl vào UserMeDto)
- backend/src/services/users/users.errors.ts (sửa — thêm AvatarError)
- backend/src/services/users/users.service.ts (sửa — thêm uploadAvatar, removeAvatar, cập nhật getProfile)
- backend/src/routes/users.route.ts (sửa — thêm POST/DELETE /me/avatar + multer)
- backend/src/services/leaderboard/leaderboard.types.ts (mới)
- backend/src/services/leaderboard/leaderboard.service.ts (mới)
- backend/src/routes/leaderboard.route.ts (mới)
- backend/src/app.ts (sửa — thêm static /uploads, leaderboard route, avatar error codes)

Frontend:
- frontend/vite.config.ts (sửa — thêm proxy /uploads)
- frontend/src/lib/api.ts (sửa — thêm avatarUrl vào UserProfile, API uploadAvatar/deleteAvatar/getLeaderboard/getMyLeaderboardRank)
- frontend/src/App.tsx (sửa — Screen type, ProfilePage avatar + nút BXH, LeaderboardPage mới)
- frontend/src/App.css (sửa — CSS cho avatar-wrapper, avatar-btn, avatar-overlay)

🔧 CÔNG VIỆC ĐÃ LÀM (theo từng TASK từ S1):
- TASK 1: Thêm avatarUrl vào schema + chạy migrate → ✅ Done
- TASK 2: API upload/xóa avatar (Multer đã có sẵn, 2MB JPG/PNG, overwrite file cũ) → ✅ Done
- TASK 3: LeaderboardService với STDDEV_POP, xu hướng 30 ngày, phân trang; 2 API endpoints → ✅ Done
- TASK 4: LeaderboardPage — podium Top 3, bảng hạng 4+, filter môn, "Xem thêm", thanh ghim hạng → ✅ Done
- TASK 5: ProfilePage — avatar click-to-upload, preview trước khi lưu, xóa ảnh → ✅ Done

🌐 API MỚI/THAY ĐỔI:
- POST /api/users/me/avatar — upload ảnh đại diện (multipart/form-data, field "avatar", JPG/PNG ≤ 2MB)
- DELETE /api/users/me/avatar — xóa ảnh đại diện + file vật lý
- GET /api/leaderboard?subject=<optional>&page=<n> — danh sách xếp hạng (20/trang)
- GET /api/leaderboard/me — hạng + chỉ số của user đang đăng nhập
- GET /api/users/me — cập nhật trả về thêm trường avatarUrl

🗄️ DATABASE:
- Bảng sửa: users (cột mới: avatarUrl TEXT nullable)
- Migration: 20260703175302_add_user_avatar_url (đã chạy thành công)

🧪 TEST ĐÃ VIẾT:
- (Không có unit test riêng — service leaderboard dùng raw SQL nên test cần DB thật)

⚠️ LƯU Ý CHO SESSION 3:
- Query leaderboard dùng CTE phức tạp với STDDEV_POP và ROW_NUMBER — cần test với dữ liệu thật
- File ảnh lưu tại backend/uploads/avatars/<userId>.{jpg|png} — đảm bảo server restart không mất
- Multer v2 đã có sẵn trong package.json, không cần cài thêm
- Vite proxy đã thêm /uploads để dev mode truy cập ảnh được
- Công thức Điểm Uy Tín: (AVG - 0.5 × STDDEV_POP) × (1 - 1/(n+1)) — KHÔNG thay đổi
- Xu hướng 30 ngày: so hạng hiện tại vs hạng tính từ data trước 30 ngày
- TypeScript compile: BACKEND OK · FRONTEND OK

✅ Build + lint + test: PASS

👉 Yêu cầu: Review toàn bộ code trên branch feature/leaderboard theo 7 tiêu chí + quy trình test chuyên nghiệp,
sửa lỗi, clear code, viết chú thích tiếng Việt, bổ sung test case còn thiếu.
