# 📊 Trạng thái Workflow — QuizzGame

> File này do **S8-GiamSat** duy trì. Cập nhật sau mỗi hành động quan trọng.
> **Mọi session PHẢI đọc file này khi khởi động** (Bước 0).
> **Chỉ S8 được phép sửa bảng trạng thái.** Các session khác chỉ đọc.

---

## Tính năng đang triển khai

| Mục | Giá trị |
|-----|---------|
| Tính năng | Notifications — Thông báo hệ thống (Feature 013 / TASKS.md ID 009) |
| Branch | feature/notifications |
| Bắt đầu từ | 2026-07-09 |

---

## Trạng thái từng session

| Session | Tên | Trạng thái | Việc cần làm | Số lần làm lại |
|---------|-----|------------|--------------|---------------|
| S1 | Kiến Trúc Sư | ✅ Done | — | 0 |
| S2 | Thợ Code | ✅ Done (đã sửa navigation, commit 293b40d) | — | 1 |
| S3 | Người Soát Lỗi | ✅ Done | — | 0 |
| S4 | Người Ghi Chép | ✅ Done (đã sửa 2 chỗ docs lỗi thời + bổ sung mô tả điều hướng) | — | 1 |
| S5 | Người Thử Nghiệm | ✅ Done (4/4 kịch bản click-to-navigate PASS) | — | 1 |
| S6 | Người Giảng Giải | ✅ Done | — | 0 |
| S7 | Người Đóng Gói | ⏸ Chờ | Push & merge feature/notifications | 0 |
| S8 | Giám Sát Chất Lượng | ✅ Done | Quality gate PASS | — |
| S9 | Cố Vấn Ra Mắt | ⏸ Chờ | — | — |

**Trạng thái**: `⏸ Chờ` | `🔄 Đang làm` | `✅ Done` | `↩️ Làm lại` | `⛔ Bị chặn`

> ⚠️ **Quy tắc làm lại**: Nếu "Số lần làm lại" của một session đạt **3**, S8 dừng tự động và báo người dùng trực tiếp.

---

## Yêu cầu mới từ người dùng (chưa xử lý)

_(S8 ghi vào đây khi người dùng đặt ra yêu cầu mới trong lúc tính năng đang được làm)_

---

## Lịch sử cập nhật

| Thời gian | Session | Hành động |
|-----------|---------|-----------|
| _(khởi tạo)_ | S8 | Tạo file STATUS.md |
| 2026-07-09 | S8 | Cập nhật tính năng đang triển khai → Feature 012 (Exam UX Improvements); chạy quality gate |
| 2026-07-10 | S8 | Rà soát Feature 013 (Notifications). KHÔNG ĐẠT: thiếu logic điều hướng khi bấm thông báo (targetScreen không được dùng ở NotificationPanel/App.tsx) — vi phạm 3 dòng DoD của S1. Trả lại S2, tăng "Số lần làm lại" S2 → 1. |
| 2026-07-10 | S8 | S2 báo đã sửa (commit 293b40d). Tự kiểm chứng độc lập: đọc diff, chạy `tsc --noEmit` (FE+BE), `npm test` BE (89/89 PASS), `npm run lint` FE (PASS) — khớp báo cáo S2, logic điều hướng đúng theo DoD. Phát hiện thêm: docs/CHANGELOG.md dòng 24 và docs/guides/user-guide.md dòng 1226 vẫn ghi toast "4 giây" (thực tế đã là 7 giây từ vòng test S5) + user-guide.md chưa mô tả hành vi điều hướng mới. Trả lại S4, tăng "Số lần làm lại" S4 → 1. |
| 2026-07-10 | S8 | S4 báo đã sửa. Đối chiếu diff trực tiếp: CHANGELOG.md + user-guide.md đúng như yêu cầu (7 giây + bảng điều hướng đầy đủ). Docs ĐẠT. Rà lại docs/TEST_CASES.md: không có case nào kiểm tra hành vi click-to-navigate (đúng lỗ hổng đã gây ra miss ban đầu) — 4 kịch bản (streak/rank/đề thi mới/báo cáo) chưa từng được xác nhận bằng tay trên app thật. Trả lại S5 để test bổ sung trước khi chốt ĐẠT, tăng "Số lần làm lại" S5 → 1. |
| 2026-07-11 | S8 | S5 báo 4/4 kịch bản click-to-navigate PASS (verify UI thật + DB), bổ sung N1-N4 vào TEST_CASES.md. Rà soát lại toàn bộ 17 dòng DoD + checklist QA baseline: TẤT CẢ ĐẠT. Dọn file rác `backend/package.json.tmp`. Cập nhật docs/TASKS.md (009 → Done, 2026-07-11) + docs/PROJECT_OVERVIEW.md (thêm dòng module Notifications). ✅ QUALITY GATE PASS — chuyển S7 push & merge. |
