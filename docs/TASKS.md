# ✅ QuizzGame — Theo dõi Task/Tính năng

> File này được duy trì bởi **Session 8 - Giám Sát Chất Lượng**.
> Mỗi vòng tính năng mới sẽ thêm 1 dòng. Khi S8 xác nhận ĐẠT quality gate → cập nhật trạng thái Done.

| ID | Tính năng | Trạng thái | Branch | Ngày hoàn thành |
|----|-----------|-----------|--------|-----------------|
| 001 | Auth + Onboarding | ✅ Done | feature/auth-onboarding | (trước khi áp dụng workflow 9-session) |
| 002 | Practice Module (Ôn tập thích nghi) | ✅ Done | feature/practice-module | 2026-06-09 |
| 003 | Admin Dashboard – Quản lý báo cáo câu hỏi | ✅ Done | feature/question-reports | 2026-06-13 |
| 004 | Exam Module – Thi thử (Mock Exam) | ✅ Done | feature/exam-module | 2026-07-03 |
| 005 | Question Bank – Ngân hàng câu hỏi | ✅ Done | feature/question-bank | 2026-07-03 |
| 006 | Leaderboard – Bảng xếp hạng | ✅ Done | feature/leaderboard | 2026-07-04 |
| 007 | Progress Dashboard – Thống kê tiến độ học sinh | ✅ Done | feature/progress-dashboard | 2026-07-04 |
| 010 | Ôn Câu Sai – Wrong Answer Review | ✅ Done | feature/wrong-answer-review | 2026-07-05 |
| 008 | Admin User Management – Quản lý người dùng | ✅ Done | feature/admin-user-management | 2026-07-06 |
| 011 | Anti-Cheat Security Fixes | ✅ Done | feature/anti-cheat-fixes | 2026-07-07 |
| 012 | Exam UX Improvements – Resume, Exit Button, ABANDONED status | ✅ Done | feature/exam-ux-improvements | 2026-07-09 |
| 009 | Notifications – Thông báo hệ thống | ✅ Done | feature/notifications | 2026-07-11 |
| 014 | Quản lý câu hỏi – Học sinh đóng góp câu hỏi + Thiết kế lại báo cáo | ✅ Done | feature/question-management-hub | 2026-07-15 |
| 015 | Khung Free/Premium | ✅ Done | feature/premium-framework | 2026-07-19 |

---

## Trạng thái sử dụng

- `🔄 Đang làm` — đang ở S1-S7
- `🔍 Đang QA` — đang ở S8 chờ quality gate
- `✅ Done` — đã merge vào master, S8 xác nhận đạt
- `↩️ Trả lại` — S8 yêu cầu làm lại, ghi chú session nào đang xử lý lại
- `⏳ Chờ S1 lên kế hoạch` — tính năng mới đã được ghi nhận, chờ S1 phân tích và tạo kế hoạch

## Lịch sử "Trả lại" (nếu có)

| ID | Vấn đề | Trả về session | Kết quả sau khi làm lại |
|----|--------|-----------------|--------------------------|
| 004 | (1) S5: Test thủ công chưa hoàn thành — chỉ có A1–A4 PASS, A5→D2 còn "đang tiến hành"; (2) S6: bị bỏ qua hoàn toàn — GLOSSARY.md thiếu toàn bộ thuật ngữ Exam Module (ExamPaper, ExamSession, ExamQuestion, ExamAnswer, entry fee, grace period, pointsAwarded, MCQ_4, TRUE_FALSE_4, FILL_BLANK...) | S5 (ưu tiên trước), sau đó S6 | ✅ Đạt — S5 hoàn thành test cases (6 nhóm, ~70 test case), fix thêm 3 bug (isActive schema); S6 bổ sung 8 thuật ngữ GLOSSARY. Build+lint+smoke test 108/108 PASS. S8 xác nhận 2026-07-03 |
| 005 | (1) S2: Frontend build/lint FAIL — `handleRestoreQuestion` (App.tsx:1796) định nghĩa nhưng không gọi, bị bỏ lại khi refactor onclick sang AdminFromBankModal; chặn `tsc -b` (TS6133) và `eslint` (no-unused-vars). (2) S5: Không có record kiểm thử thủ công cho vòng Question Bank (chỉ có handoff cũ từ round Exam Module). | S2 (fix build trước), sau đó S5 (manual test) | ✅ Đạt — S2 fix unused function + commit 9862bcf; S5 fix pageSize clamp bug + commit a0243f4, 25/25 manual test PASS. Build+lint+smoke 45/45 PASS. S8 xác nhận 2026-07-03 |
| 006 | (1) S5 lần đầu: không có báo cáo thủ công → trả lại S5. (2) S5 phát hiện bug `getMyRank` luôn trả #1 (đã fix), người dùng đổi PAGE_SIZE=10, thêm modal+auto-hide. (3) S8 đồng bộ smoke test + docs (pageSize 20→10). Smoke 8/8 PASS, build+lint PASS. | S5 (manual test) | ✅ Đạt — S8 xác nhận 2026-07-04 |
| 007 | S5: Không có kết quả test thủ công — 21 test case đã định nghĩa nhưng chưa có PASS/FAIL. Frontend UI chưa được kiểm tra thực tế (nút ProfilePage, điều hướng, render ProgressPage, sparkline, phân trang exam history). | S5 (manual test) | ✅ Đạt — S5: 20/21 PASS, 1 SKIP chấp nhận (test xóa ExamPaper khỏi DB, không ảnh hưởng chức năng chính). UI/UX 8/8 PASS. Smoke 4/4 PASS. S8 xác nhận 2026-07-04 |
| 010 | S8 phát hiện: (1) soft expiry code trong retryQuestion() → xác nhận là yêu cầu người dùng (S5 thêm), không phải bug; (2) unit test mock thiếu `wrongAnswer.update` → 3/18 FAIL. S2 fix mock → 18/18 PASS. TEST_CASES.md #14 cập nhật spec mới. | S2-ThoCode (fix mock) | ✅ Đạt — S2: 18/18 PASS. S5: 20/20 PASS. S6: GLOSSARY 6 thuật ngữ + ADR 008. S8 xác nhận 2026-07-05 |
| 009 | S8 phát hiện: DoD của S1 yêu cầu rõ "Bấm thông báo streak → Trang Tiến độ", "Bấm thông báo rank → Trang Bảng xếp hạng", "Bấm thông báo đề thi mới → Trang Thi thử" — nhưng `NotificationPanel` (frontend/src/App.tsx) chỉ gọi `handleMarkOne` khi click, hoàn toàn không đọc field `targetScreen` (có sẵn trong API response) để điều hướng. 3/16 dòng DoD không đạt. S3 (review 8 tiêu chí), S5 (26 test thủ công), S4/S6 (docs) đều không phát hiện ra vì không có test case nào kiểm tra hành vi click-to-navigate — chỉ test mark-as-read. user-guide.md cũng mô tả sai (toast "4 giây" thay vì 7 giây thực tế đã sửa ở FEATURE_LOG). | S2-ThoCode (bổ sung logic điều hướng) | ✅ S2 đã sửa (commit 293b40d) — S8 tự kiểm chứng: tsc/lint/test PASS, diff đúng yêu cầu. Phát hiện tiếp: docs/CHANGELOG.md + user-guide.md vẫn ghi toast "4 giây" (đúng phải 7s) và chưa mô tả hành vi điều hướng mới → trả tiếp cho S4. |
| 009 | (tiếp) S4 đã sửa xong 2 chỗ docs (7 giây + bảng điều hướng) — S8 đối chiếu diff, ĐẠT. Nhưng docs/TEST_CASES.md chưa có case nào cho hành vi click-to-navigate — 4 kịch bản (streak/rank/đề thi mới/báo cáo) chưa từng được xác nhận bằng tay trên app thật, đúng lỗ hổng gây ra miss ban đầu. | S5-ThuNghiem (test bổ sung) | ✅ Đạt — S5: 4/4 kịch bản PASS (verify UI thật qua browser + DB isRead), bổ sung N1-N4 vào TEST_CASES.md. S8 xác nhận ĐẠT quality gate toàn phần 2026-07-11 |
| 014 | S8 tự đọc code (không chỉ tin báo cáo): `resolveReport()` (practice.service.ts:951) update trạng thái report chính bằng `tx.questionReport.update({where:{id}})` thường — KHÔNG có claim-pattern (`updateMany` điều kiện `status:'PENDING'` + check `count`) như 2 chỗ khác S3 vừa tự sửa trong CÙNG vòng review này (approveSubmission, usage-points CAS). Hệ quả: 2 admin resolve trùng 1 report (hoặc gọi lại report đã resolve) → không báo lỗi, chạy lại toàn bộ (tạo snapshot thừa, gửi trùng thông báo REPORT_RESOLVED cho cùng 1 học sinh). docs/CODE_REVIEW_LOG.md dòng 840 ghi nhận "report đã bị resolve trước đó ✅ Pass" nhưng không có test nào (practice.service.test.ts, TEST_CASES.md) xác nhận điều này — có thể nhầm với hành vi của `updateReport()` cũ (hàm khác, vẫn giữ nội bộ). | S3-SoatLoi (đã có sẵn context, vừa fix 2 case tương tự) | ✅ Đạt — S3: thêm ReportNotPendingError (409) + claim-pattern đúng vị trí (trước snapshot/update), 138/138 test PASS, đính chính CODE_REVIEW_LOG.md. S8 tự đọc lại diff + chạy độc lập tsc BE/FE + test 138/138: khớp hoàn toàn. S8 tự bổ sung 1 dòng test case #32 còn thiếu trong TEST_CASES.md (nội dung đã có sẵn trong CODE_REVIEW_LOG, chỉ là thiếu copy vào bảng). S8 xác nhận ĐẠT quality gate toàn phần 2026-07-15. |
