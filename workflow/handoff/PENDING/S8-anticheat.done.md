[TỪ S6-GIANGGIAI]

✅ GIẢI THÍCH XONG: Anti-Cheat Security Fixes
🌿 BRANCH: feature/anti-cheat-fixes

📚 TÀI LIỆU ĐÃ GHI:
- GLOSSARY.md: +2 term mới (Stale Closure, Latest Ref Pattern)
- LESSONS_LEARNED.md: Vòng 11 — 3 bài học + 3 quyết định thiết kế

---

📋 TỔNG KẾT TOÀN BỘ VÒNG (S1→S6):

S1: Đặc tả 4 bug anti-cheat + DoD
S2: Implement 4 bug fixes (exam + practice)
S3: Review → thêm 22 unit tests, sửa UX message
S4: Tài liệu (FEATURE_LOG, GLOSSARY, ADR-009, CHANGELOG, troubleshooting guide)
S5: Manual test 6/6 PASS + fix 2 bug phát sinh (Zod schema, auto-submit timer)
S6: Giải thích kỹ thuật + ghi LESSONS_LEARNED

📦 COMMITS TRÊN BRANCH:
- d1f32a0 security: sửa 4 lỗ hổng gian lận trong exam và practice module
- 460bf7f workflow: ghi handoff S3 cho anti-cheat review
- 19d1dc5 review: S3 anti-cheat — viết unit test + sửa UX message + export helper
- ff0ea3d docs: S4 tài liệu anti-cheat security fixes
- e983543 fix(exam): gửi sentinel {} cho câu bỏ trắng khi nộp bài
- e38ab8a fix(exam): accept sentinel {} in submitExamSchema Zod validation
- e945ba0 fix(exam): auto-submit dựa trên server time thay vì timeLeft state

🧪 TEST SUITE: 66/66 PASS
🔨 BUILD: BE + FE TypeScript OK
✅ MANUAL TESTS: 6/6 PASS

📋 DEFINITION OF DONE (tất cả ✅):
✅ POST /api/exam/submit khi chưa đủ 30% → 400 EXAM_SUBMIT_TOO_EARLY
✅ POST /api/exam/submit sau 30% → thành công
✅ POST /api/exam/start khi IN_PROGRESS cùng môn → 409 EXAM_SESSION_ALREADY_ACTIVE
✅ GET /api/exam/:id/result: câu bỏ trắng → correctAnswer = null
✅ GET /api/exam/:id/result: câu có trả lời → correctAnswer bình thường
✅ Frontend hiển thị đúng tất cả trường hợp
✅ 66 unit tests PASS, build sạch

👉 YÊU CẦU: Rà soát tổng thể, nếu đạt thì cho phép S7 push & merge branch feature/anti-cheat-fixes vào master.
