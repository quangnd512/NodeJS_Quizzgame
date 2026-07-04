# Handoff từ S1-KienTrucSu → S2-ThoCode

**Thời gian:** 2026-07-03  
**Branch:** feature/leaderboard

---

[TỪ S1-KIENTRUCSU]

🎯 TÍNH NĂNG CẦN LÀM: Leaderboard — Bảng xếp hạng học sinh
🌿 BRANCH: feature/leaderboard

---

## 📝 TÓM TẮT YÊU CẦU NGƯỜI DÙNG

Thêm bảng xếp hạng học sinh dựa trên **chất lượng thi thử** (không phải điểm tích lũy).
Xếp hạng theo công thức Điểm Uy Tín — phản ánh đúng năng lực thật, không bị "farm điểm".
Giao diện phải **thu hút, kích thích học viên cạnh tranh**.

Ngoài ra, học sinh có thể **upload ảnh đại diện tùy chọn** trong trang Profile.
Nếu chưa có ảnh → hiển thị chữ cái đầu tên + màu nền tự động.

---

## 🔧 CHI TIẾT KỸ THUẬT

### Công thức Điểm Uy Tín (ĐÃ CHỐT VỚI NGƯỜI DÙNG)

```
Điểm Uy Tín = (Trung Bình - 0.5 × Độ Dao Động) × (1 - 1/(số lần thi + 1))
```

- **Trung Bình** = avg(score) của tất cả ExamSession có status="COMPLETED" và score NOT NULL
- **Độ Dao Động** = độ lệch chuẩn (stddev) của score — tính bằng `STDDEV_POP` trong PostgreSQL
- **Hệ Số Tin Cậy** = `1 - 1/(n+1)` với n = số lần thi thành công
  - 1 lần → 0.50, 3 lần → 0.75, 5 lần → 0.83, 10 lần → 0.91
- Không có yêu cầu số lần thi tối thiểu — ai cũng vào bảng được (chỉ là điểm thấp hơn nếu thi ít)
- Điểm bằng nhau → ưu tiên người có `completedAt` gần nhất

### Xu hướng tháng (↑↓→)

- So sánh **hạng hiện tại** vs **hạng tính từ dữ liệu 30 ngày trước**
  - "30 ngày trước" = chỉ tính ExamSession có `completedAt < NOW() - 30 days`
  - Nếu user không có data từ 30 ngày trước → hiển thị "—" (chưa đủ dữ liệu)
- ↑ = hạng tăng (số thứ tự nhỏ hơn), ↓ = hạng giảm, → = không đổi

### DB thay đổi

Thêm vào model `User` trong `backend/prisma/schema.prisma`:
```prisma
avatarUrl String?  // URL ảnh đại diện (null = dùng avatar chữ cái)
```

### Lưu ảnh avatar

- Dùng **Multer** để xử lý upload (cài thêm package)
- Lưu file tại: `backend/uploads/avatars/<userId>.<ext>`
- Phục vụ qua Express static: `/uploads/avatars/` → `backend/uploads/avatars/`
- Giới hạn: chỉ JPG/PNG, tối đa 2MB
- Xóa file vật lý khi user xóa avatar hoặc upload ảnh mới (tránh rác)

### Files cần tạo/chỉnh sửa

**Backend:**
- `backend/prisma/schema.prisma` — thêm `avatarUrl`
- `backend/prisma/migrations/` — migration mới
- `backend/src/routes/users.route.ts` — thêm POST/DELETE avatar
- `backend/src/services/users.service.ts` — thêm uploadAvatar, removeAvatar
- `backend/src/services/leaderboard.service.ts` — **file mới**, hàm tính Điểm Uy Tín
- `backend/src/routes/leaderboard.route.ts` — **file mới**, 2 endpoint
- `backend/src/app.ts` — đăng ký leaderboard route + static /uploads

**Frontend:**
- `frontend/src/App.tsx` — thêm screen 'leaderboard'
- `frontend/src/pages/ProfilePage.tsx` — thêm section upload avatar + nút vào Leaderboard
- `frontend/src/pages/LeaderboardPage.tsx` — **file mới**, UI đầy đủ

### API Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/api/users/me/avatar` | Upload ảnh (multipart/form-data, field: "avatar") |
| DELETE | `/api/users/me/avatar` | Xóa ảnh đại diện |
| GET | `/api/leaderboard?subject=<optional>&page=<n>` | Danh sách xếp hạng (20 người/trang) |
| GET | `/api/leaderboard/me` | Hạng + chỉ số của user đang đăng nhập |

**Response GET /api/leaderboard:**
```json
{
  "data": [
    {
      "rank": 1,
      "userId": "...",
      "displayName": "Nguyễn Văn An",
      "avatarUrl": "http://localhost:4000/uploads/avatars/abc.jpg",
      "reputationScore": 74.1,
      "avgScore": 90.0,
      "examCount": 5,
      "trend": "up" | "down" | "same" | "new"
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20
}
```

**Response GET /api/leaderboard/me:**
```json
{
  "rank": 12,
  "reputationScore": 55.3,
  "avgScore": 72.0,
  "examCount": 3,
  "trend": "up"
}
```

---

## 📋 DANH SÁCH TASK

**TASK 1:** Thêm `avatarUrl String?` vào model User trong schema.prisma + chạy `prisma migrate dev --name add-user-avatar-url`
- Output: migration mới, Prisma Client tái sinh, cột `avatarUrl` sẵn sàng
- Phụ thuộc: không

**TASK 2:** Backend — cài Multer, tạo API upload/xóa avatar
- `POST /api/users/me/avatar`: validate file (JPG/PNG ≤ 2MB), lưu vào `uploads/avatars/`, cập nhật `avatarUrl` trong DB, xóa file cũ nếu có
- `DELETE /api/users/me/avatar`: xóa file vật lý + set `avatarUrl = null` trong DB
- Cấu hình Express serve static `/uploads/avatars/`
- Cập nhật `getProfile()` trả về `avatarUrl`
- Output: 2 endpoint hoạt động, ảnh truy cập được qua URL
- Phụ thuộc: TASK 1

**TASK 3:** Backend — Service + API Leaderboard
- Tạo `leaderboard.service.ts` với hàm tính Điểm Uy Tín (dùng Prisma raw query `$queryRaw` cho `STDDEV_POP`)
- Tính xu hướng tháng (30 ngày)
- Tạo `leaderboard.route.ts` với 2 endpoint
- Đăng ký route trong `app.ts`
- Output: 2 endpoint đúng công thức, có phân trang
- Phụ thuộc: TASK 1

**TASK 4:** Frontend — Trang LeaderboardPage
- Top 3: **podium style** (hạng 2 bên trái thấp hơn, hạng 1 ở giữa cao nhất, hạng 3 bên phải thấp nhất), avatar lớn, tên, Điểm Uy Tín, hiệu ứng đẹp
- Bảng từ hạng 4 trở xuống: avatar nhỏ, tên, Điểm Uy Tín, điểm TB, số lần thi, mũi tên xu hướng (↑↓→ hoặc —)
- Filter môn học (dropdown chọn môn, mặc định = tất cả)
- **Thanh ghim dưới cùng**: luôn hiển thị hạng của user đang đăng nhập (kể cả không vào top)
- Phân trang: nút "Xem thêm" hoặc infinite scroll
- Thêm nút "Bảng xếp hạng" vào ProfilePage, thêm 'leaderboard' vào type Screen trong App.tsx
- Output: trang Leaderboard đẹp, thu hút, đầy đủ tính năng
- Phụ thuộc: TASK 3

**TASK 5:** Frontend — Upload ảnh đại diện trong ProfilePage
- Khu vực avatar: hiển thị ảnh (nếu có) hoặc chữ cái đầu + màu nền (generate từ tên)
- Bấm vào avatar → mở dialog chọn file (chỉ JPG/PNG, max 2MB, có thông báo lỗi rõ ràng)
- Preview ảnh trước khi lưu + nút "Lưu" / "Hủy"
- Nút "Xóa ảnh" xuất hiện khi đã có avatar
- Output: học sinh upload/xóa được ảnh, cập nhật ngay trên UI sau khi lưu
- Phụ thuộc: TASK 2, TASK 4

---

## ⚠️ LƯU Ý ĐẶC BIỆT

1. **Công thức Điểm Uy Tín đã được người dùng xác nhận** — KHÔNG thay đổi hệ số (0.5 và 1/(n+1))
2. **Xu hướng dùng 30 ngày** (không phải 7 ngày) — người dùng đã xác nhận
3. **`STDDEV_POP`** (không phải `STDDEV_SAMP`) — dùng cho toàn bộ dữ liệu thi của user
4. Học sinh chưa thi lần nào → không xuất hiện trong bảng (nhưng vẫn có dữ liệu ở `/api/leaderboard/me` với rank=null)
5. Khi user upload ảnh mới → xóa file ảnh cũ trước khi lưu ảnh mới (tránh tồn file rác)
6. Tên file avatar nên dùng userId (không random) để dễ overwrite: `<userId>.jpg`
7. Giao diện Leaderboard phải **thật thu hút và kích thích** — đây là yêu cầu quan trọng của người dùng. Dùng gradient, animation nhẹ, màu sắc sống động cho phần Top 3
