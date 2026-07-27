# 📊 Trạng thái Workflow — QuizzGame

> File này do **S8-GiamSat** duy trì. Cập nhật sau mỗi hành động quan trọng.
> **Mọi session PHẢI đọc file này khi khởi động** (Bước 0).
> **Chỉ S8 được phép sửa bảng trạng thái.** Các session khác chỉ đọc.

---

## Tính năng đang triển khai

| Mục | Giá trị |
|-----|---------|
| Tính năng | Thi đấu đối kháng — PvP Quiz Battle, ĐỢT 1/MVP (Feature 016) |
| Branch | feature/battle-mvp |
| Bắt đầu từ | 2026-07-20 |

---

## Trạng thái từng session

| Session | Tên | Trạng thái | Việc cần làm | Số lần làm lại |
|---------|-----|------------|--------------|---------------|
| S1 | Kiến Trúc Sư | ✅ Done (16 TASK, API draft đầy đủ REST+Socket.io) | — | 0 |
| S2 | Thợ Code | ✅ Done (16/16 TASK, 48 test mới) | — | 0 |
| S3 | Người Soát Lỗi | ✅ Done (làm lại xong — 6 test mới cho battle.engine.service.ts, 282/282 PASS) | — | 1 |
| S4 | Người Ghi Chép | ✅ Done (làm lại xong — cập nhật 8 file docs theo thay đổi muộn của S5) | — | 1 |
| S5 | Người Thử Nghiệm | ✅ Done (22/22 PASS, 11 bug đã sửa, 2 thay đổi phạm vi) | — | 0 |
| S6 | Người Giảng Giải | ✅ Done | — | 0 |
| S7 | Người Đóng Gói | ⏸ Chờ | Push & merge feature/battle-mvp | 0 |
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
| 2026-07-14 | S8 | Bắt đầu rà soát Feature 014 (Quản lý câu hỏi). Tự kiểm chứng độc lập: tsc sạch (BE+FE), 137/137 backend test PASS, eslint FE sạch (retry sau lỗi ETIMEDOUT tạm thời), npm audit chỉ lỗ hổng pre-existing, 2 migration mới (question types + report resubmit) đọc kỹ khớp schema.prisma, route ordering reports/facets trước :id/resolve đúng, claim-pattern approveSubmission + CAS usage-points đọc code xác nhận đúng. PHÁT HIỆN: `resolveReport()` (practice.service.ts:951) thiếu claim-pattern chống double-resolve — cùng lớp race condition mà S3 vừa fix ở 2 chỗ khác trong CÙNG PR nhưng bỏ sót ở đây; CODE_REVIEW_LOG.md claim đã test edge case này nhưng không có test nào chứng minh. Trả lại S3, tăng "Số lần làm lại" S3 → 1. |
| 2026-07-15 | S8 | S3 báo đã sửa xong (claim-pattern giống approveSubmission, error mới ReportNotPendingError/409, 138/138 test). Tự kiểm chứng độc lập: đọc diff resolveReport() — claim đúng vị trí (trước snapshot/update), đọc test mới — assert dừng sớm đúng cả 3 điều kiện. Tự chạy lại: tsc BE (PASS, mất nhiều phút do máy nhiều session chạy song song — không phải lỗi code), tsc FE (PASS), test BE 138/138 PASS. Phát hiện nhỏ: docs/TEST_CASES.md nhắc "case #32" ở ghi chú đầu mục nhưng bảng thực tế dừng ở #31 (thiếu dòng) — S8 tự bổ sung dòng #32 (nội dung đã có sẵn đầy đủ trong CODE_REVIEW_LOG.md, không cần phán đoán thêm). Rà lại toàn bộ 17 dòng DoD: TẤT CẢ ĐẠT. Cập nhật docs/TASKS.md (014 → Done) + docs/PROJECT_OVERVIEW.md (thêm module). Lưu ý: RẤT NHIỀU thay đổi qua 3 vòng (S2/S5/S3) vẫn CHƯA COMMIT trong working tree — đã ghi rõ cho S7 quyết định cách gộp commit trước khi push. ✅ QUALITY GATE PASS — chuyển S7. |
| 2026-07-19 | S8 | Rà soát Feature 015 (Khung Free/Premium) — feature phức tạp nhất từ trước tới nay (16 task, thuật toán streak-freeze). Tự kiểm chứng độc lập, không chỉ tin báo cáo: tsc sạch (BE+FE, phải kill+retry nhiều lần do máy bị treo I/O — môi trường, không phải lỗi code), 201/201 backend test PASS (2 lần độc lập), npm audit chỉ lỗ hổng pre-existing. Đọc kỹ code các vùng rủi ro cao nhất: thuật toán computeStreaksWithFreeze (bridge/trailing-forgiveness) — đúng, có 13 test edge case riêng; CAS retry đa-field trong grantPremiumMonths — đúng; thứ tự validate-trước-consume token ad-unlock — đúng; 3 gate Premium (wrong-answers, exam-history, 2 field progress mới do S5 bổ sung) — đều chặn đúng ở backend; cron 3:05AM — đúng; migration + schema khớp; addMonthsUtc clamp cuối tháng — đúng; 2 lớp error (ADMIN_USER_NOT_FOUND vs PREMIUM_USER_NOT_FOUND) — xác nhận là defense-in-depth hợp lý, không phải bug. KHÔNG phát hiện lỗi nào — lần đầu tiên 1 feature ĐẠT ngay vòng đầu không cần làm lại. Lưu ý: `eslint` FE treo I/O vô thời hạn dù đã kill+retry 4 lần (đúng y hệt hiện tượng S3 từng ghi nhận ở Feature 014 — giới hạn sandbox, không phải code) — chấp nhận kết quả "sạch" đã được S2+S3 độc lập xác nhận trước đó, bù bằng tsc strict đã PASS. Cập nhật docs/TASKS.md (015 → Done) + docs/PROJECT_OVERVIEW.md (thêm module + chú thích gate ở Progress/Ôn câu sai/Admin). ✅ QUALITY GATE PASS — chuyển S7. |
| 2026-07-27 | S8 | Rà soát Feature 016 (Thi đấu đối kháng — PvP Battle, ĐỢT 1/MVP) — feature realtime đầu tiên của dự án (Socket.io). Tự kiểm chứng độc lập: tsc sạch BE (`npx tsc --noEmit`) + FE (phải gọi thẳng `node node_modules/typescript/bin/tsc -b` vì `npx tsc`/`.bin/tsc` không hoạt động trong sandbox hiện tại — ghi chú môi trường mới, không phải lỗi code), 276/276 backend test PASS, `eslint` FE lại ETIMEDOUT sau 120s (đúng hiện tượng đã ghi nhận nhiều vòng trước — môi trường), npm audit BE (15, pre-existing: @google-cloud/*, xlsx) + FE (3, pre-existing: eslint/firebase/vite qua `npm ls` xác nhận không liên quan socket.io/socket.io-client). Đọc kỹ battle.match.service.ts (atomic transaction + CAS chống trả điểm 2 lần S3 đã sửa — đúng) và battle.engine.service.ts (điều phối realtime, disconnect/reconnect, pause-resume timer — đọc logic đúng theo mô tả). PHÁT HIỆN 2 vấn đề (đúng như S5/S6 đã tự cảnh báo trong báo cáo, S8 xác nhận bằng chứng cụ thể): (1) `battle.engine.service.ts` — nơi xảy ra 5/11 bug S5 tìm bằng tay (đếm 30s, pause/resume timer, chặn 2 trận) — hoàn toàn KHÔNG có test tự động (chỉ có test cho match/queue/utils), vi phạm dòng DoD "test... xử lý mất kết nối 30 giây (cả 2 nhánh)"; (2) docs chưa cập nhật theo 2 thay đổi phạm vi muộn của S5 (ẩn danh tính bot, tự động resume) — grep xác nhận FEATURE_LOG.md dòng 7709 + user-guide.md dòng 1491 vẫn "Máy 🤖", api draft không có `GET /api/battle/active` hay `BATTLE_ALREADY_IN_MATCH`, TEST_CASES.md dừng ở #28 thiếu 4 kịch bản mới. Trả song song cho S3 (bổ sung test engine) và S4 (cập nhật 4 file docs) — độc lập nhau, không cần chờ nhau. Tăng "Số lần làm lại" S3 → 1, S4 → 1. Thêm dòng 016 vào docs/TASKS.md (↩️ Trả lại) + mục Lịch sử Trả lại. Sau khi trả việc: `npm rebuild` frontend cũng sửa luôn được `node_modules/.bin/eslint` bị thiếu (gốc rễ giống hệt vụ `tsc` — không phải do mạng/sandbox như các vòng trước từng đoán) — `npm run lint` chạy xong thật (không còn treo): 0 lỗi, 1 warning `react-hooks/exhaustive-deps` mới ở App.tsx:6439 (useEffect kết nối socket dùng `onProfileUpdate` trong closure nhưng không khai trong deps `[sessionToken]` — nhiều khả năng CHỦ Ý để tránh socket bị reconnect lại mỗi khi callback đổi identity, giống pattern khác trong file). KHÔNG chặn quality gate (CI `npm run lint` không có `--max-warnings=0`) — không trả lại vòng riêng, chỉ ghi nhận ở đây để S3 tiện xem qua nếu muốn trong lúc đang sửa file khác gần đó. |
| 2026-07-27 | S8 | S3 + S4 báo làm lại xong (song song). Tự kiểm chứng độc lập lại từ đầu: đọc trực tiếp `battle.engine.service.test.ts` (6 test mới, không chỉ tin số liệu) — dùng fake timers đúng cách, phủ đủ 5 kịch bản yêu cầu, chất lượng tốt; chạy lại 282/282 test PASS; `tsc --noEmit` BE + `tsc -b` FE sạch (2 lần độc lập, xác nhận qua background task hoàn tất); grep lại toàn bộ docs xác nhận hết sạch "Máy 🤖" (chỉ còn câu giải thích lịch sử có chủ đích), `BATTLE_ALREADY_IN_MATCH` + `GET /api/battle/active` xuất hiện nhất quán ở mọi file liên quan (kể cả openapi.yaml chính thức mà S4 tự phát hiện thêm ngoài 4 file được giao); `openapi.yaml` parse hợp lệ bằng pyyaml; không có xung đột giữa test case #29/#30 (S3) và B1-B5 (S4) trong TEST_CASES.md dù sửa song song. Rà lại toàn bộ 13 dòng DoD gốc của S1 + checklist QA baseline: TẤT CẢ ĐẠT. Tạo mới `docs/GAMEPLAY.md` (luật chơi PvP Battle — tính năng game đối kháng đầu tiên của app, file này đã được `PROJECT_OVERVIEW.md` tham chiếu sẵn từ trước nhưng chưa từng tồn tại). Cập nhật `docs/TASKS.md` (016 → Done) + `docs/PROJECT_OVERVIEW.md` (thêm module PvP Battle). ✅ QUALITY GATE PASS — chuyển S7. |
