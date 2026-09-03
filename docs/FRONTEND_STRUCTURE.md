# 🏗️ Frontend — Cấu trúc thư mục

> Cập nhật lần cuối: 2026-09-03 (Refactor Tách App.tsx Vòng 1)

## Tổng quát

Cấu trúc `frontend/src/` được chia thành các thư mục chính:

```
frontend/src/
├── lib/              # Hằng số, API client, utility
├── components/       # Component tái sử dụng (nhỏ, không page-level)
├── screens/          # Màn hình/page-level component
├── App.tsx           # Entry point, routing, context chính
└── main.tsx          # Vite entry
```

## Chi tiết từng thư mục

### `lib/`
- **constants.ts** — Hằng số toàn cục (SUBJECTS, SUBJECTS_MAP, v.v.)
- **api.ts** — HTTP client + tất cả endpoint (mock `fetch` sang backend `/api`)
- **firebase.ts** — Firebase Auth + config (private key hoá được)
- **battleSocket.ts** — Socket.io client cho PvP Battle

### `components/`
Các component nhỏ, tái sử dụng, không tương ứng với page cụ thể:

| File | Mục đích |
|------|---------|
| Spinner.tsx | Loading indicator |
| GoogleIcon.tsx | Google logo cho Sign-In |
| AvatarCell.tsx | Avatar + initials cell |

Mọi component có test file đi kèm trong `__tests__/`.

### `screens/`
Các màn hình/page-level component, thường được render bằng React Router:

| File | Mục đích |
|------|---------|
| LoadingScreen.tsx | Khởi tạo, kết nối app |
| LoginPage.tsx | Đăng nhập Google |
| OnboardingPage.tsx | Chọn môn học cho user mới |

Mọi screen có test file đi kèm trong `__tests__/`.

## Lịch sử refactor

### Vòng 1 (2026-09-03) — Tách App.tsx Vòng 1
- **Mục tiêu**: Giảm kích thước App.tsx từ 7.018 → 6.837 dòng (giảm 181 dòng)
- **File tách ra**:
  - `lib/constants.ts` (SUBJECTS, SUBJECTS_MAP)
  - `components/Spinner.tsx`, `components/GoogleIcon.tsx`, `components/AvatarCell.tsx`
  - `screens/LoadingScreen.tsx`, `screens/LoginPage.tsx`, `screens/OnboardingPage.tsx`
- **Thêm test**: 5 file test mới (Spinner, AvatarCell, LoadingScreen, LoginPage, OnboardingPage)

### Vòng 2-7 (planned)
Kế hoạch đầy đủ: [S1_tech_debt_master_plan.md](../workflow/handoff/backlog/S1_tech_debt_master_plan.md)

---

## Nguyên tắc di chuyển code

Khi tách component từ App.tsx:
1. **Chỉ di chuyển**, KHÔNG sửa logic/CSS/behavior
2. Thêm TypeScript type rõ ràng cho props (KHÔNG `any`)
3. Cập nhật import path theo NodeNext: dùng `.js` extension
4. Viết test cho component mới (tối thiểu: render + aria attributes)
5. Chạy `npm run build` sau mỗi tách để phát hiện lỗi import sớm
