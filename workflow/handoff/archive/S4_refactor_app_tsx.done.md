[TỪ S8-GIAMSAT]

📝 YÊU CẦU VIẾT TÀI LIỆU: Tách App.tsx Vòng 1 (nợ kỹ thuật)
🌿 BRANCH: refactor/split-app-tsx-round-1

📂 FILE MỚI (S2 đã tạo):
- frontend/src/lib/constants.ts — SUBJECTS, SUBJECTS_MAP
- frontend/src/components/Spinner.tsx, GoogleIcon.tsx, AvatarCell.tsx
- frontend/src/screens/LoadingScreen.tsx, LoginPage.tsx, OnboardingPage.tsx
- frontend/src/App.tsx — xóa 6 component + 2 hằng số, thêm imports (6.837 dòng, giảm từ 7.018)

📋 VIỆC CẦN LÀM:
- CHANGELOG.md: thêm entry refactor "Tách App.tsx Vòng 1 — tách 7 file nhỏ từ App.tsx"
- FEATURE_LOG.md hoặc docs tương ứng: ghi lại kiến trúc mới (cấu trúc thư mục frontend/src/components, frontend/src/screens, frontend/src/lib)

⚠️ LƯU Ý: Đây là vòng refactor — KHÔNG có tính năng mới, KHÔNG thay đổi API/DB.
Chỉ cần ghi nhận cấu trúc file mới và lý do (giảm kích thước App.tsx).

📄 Chi tiết đầy đủ: workflow/handoff/archive/S2.done.md + archive/S3.done.md

👉 Sau khi xong: ghi vào workflow/handoff/PENDING/S8.md và báo người dùng.
