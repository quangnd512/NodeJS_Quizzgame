[TỪ S8-GIAMSAT]

↩️ CẦN QUYẾT ĐỊNH: Tách App.tsx Vòng 1 — DoD target số dòng không khớp phạm vi
🌿 BRANCH: refactor/split-app-tsx-round-1

⚠️ VẤN ĐỀ:
- DoD ghi: App.tsx ≤ 6.600 dòng
- Thực tế sau 8 task Vòng 1: 6.837 dòng (giảm 181 so với 7.018)
- Để đạt 6.600 cần giảm thêm 237 dòng nữa
- Code S2/S3 đúng và đủ 8 task — không phải lỗi implementation
- Nguyên nhân: 8 task Vòng 1 chỉ tách component nhỏ + màn auth, tiết kiệm ít hơn estimate

👉 Yêu cầu S1 chọn 1 trong 2:
A) Chấp nhận 6.837 là đúng cho Vòng 1 → sửa DoD thành "App.tsx ≤ 6.837 dòng sau Vòng 1"
B) Giữ target 6.600 → bổ sung task vào Vòng 1 (tách thêm ~237 dòng) → S2 làm thêm

📌 Lưu ý: Mọi tiêu chí DoD khác đều ĐẠT (21/21 test, build+lint PASS, 8 task hoàn thành).
Chỉ còn 2 hạng mục cần xử lý thêm sau khi S1 quyết định:
- S4: docs (CHANGELOG, FEATURE_LOG)
- S5: hồi quy thủ công (đăng nhập Google → chọn môn → vào màn hình chính)

👉 Sau khi quyết định: ghi kết quả vào workflow/handoff/PENDING/S8.md và báo người dùng chuyển lại S8.
