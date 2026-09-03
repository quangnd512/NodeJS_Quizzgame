[KẾ HOẠCH TỔN THẤT KỸ THUẬT — 9 VÒNG LIÊN TIẾP]
Ngày lập: 2026-09-03
Người dùng xác nhận: "Làm tất cả đề xuất trong 1 lượt này"

⚠️ FILE NÀY do S1 đọc đầu mỗi vòng để biết vòng tiếp theo là gì.
Sau mỗi merge, S1 đánh dấu [x] vào vòng vừa xong rồi tiến hành vòng kế.

## Thứ tự thực hiện

- [x] VÒNG A: Vá bảo mật (branch: fix/security-audit) ✅ merge 2026-09-03 v1.15.1
- [ ] VÒNG 1: Tách App.tsx — shared components + auth screens (branch: refactor/split-app-tsx-round-1)
- [ ] VÒNG 2: Tách App.tsx — ProfilePage + AdGatePage + LeaderboardPage (branch: refactor/split-app-tsx-round-2)
- [ ] VÒNG 3: Tách App.tsx — PracticePage + PracticeSessionScreen + PracticeResultScreen (branch: refactor/split-app-tsx-round-3)
- [ ] VÒNG 4: Tách App.tsx — ExamPage + ExamSessionScreen + ExamQuestionCard + ExamResultScreen (branch: refactor/split-app-tsx-round-4)
- [ ] VÒNG 5: Tách App.tsx — ProgressPage + WrongAnswersPage + SubmissionsPage (branch: refactor/split-app-tsx-round-5)
- [ ] VÒNG 6: Tách App.tsx — BattlePage (cả 5 phase) + NotificationPanel + NotificationToast (branch: refactor/split-app-tsx-round-6)
- [ ] VÒNG 7: Tách App.tsx — toàn bộ Admin pages (~2.000 dòng) (branch: refactor/split-app-tsx-round-7)
- [ ] VÒNG B: Observability Mức 1 — health check + uptime monitor (branch: feat/observability-level-1)

---

## VÒNG A — Vá bảo mật

### Tình trạng hiện tại (đo 2026-09-03)
| Phần | High | Moderate |
|------|------|----------|
| backend | 8 | 12 |
| frontend | 4 | 1 |
| mobile | 8 | 15 |

Đáng lo nhất: `multer` (backend) — DoS qua tên trường lồng sâu.

### TASK
```
TASK 1: [backend] npm audit fix → npm test → npm run build
  → Nếu multer vẫn còn sau audit fix: nâng thủ công, kiểm tra luồng upload ảnh câu hỏi còn OK
  → Phụ thuộc: không

TASK 2: [frontend] npm audit fix → npm run lint → npm test → npm run build
  → Phụ thuộc: không (song song với TASK 1)

TASK 3: [mobile] npm audit fix → npm run lint → npm run typecheck → npm test
  → Phụ thuộc: không (song song với TASK 1, 2)
```

### DoD
```
□ npm audit backend: 0 lỗ hổng high (hoặc có giải thích rõ tại sao không thể vá)
□ npm audit frontend: 0 lỗ hổng high
□ npm audit mobile: 0 lỗ hổng high
□ npm test backend PASS
□ npm run build backend PASS
□ npm run lint frontend PASS
□ npm test frontend PASS
□ npm run lint mobile PASS + npm run typecheck mobile PASS + npm test mobile PASS
```

### Ngoài phạm vi
- KHÔNG dùng --force
- KHÔNG nâng major version tùy tiện
- KHÔNG thêm tính năng mới

---

## VÒNG 1 — Tách App.tsx: shared components + auth screens

Branch: refactor/split-app-tsx-round-1

### TASK
```
TASK 1: [frontend] Tạo frontend/src/lib/constants.ts
  → export SUBJECTS (9 môn), SUBJECTS_MAP
  → App.tsx import từ đây thay vì khai báo trực tiếp
  → Phụ thuộc: không

TASK 2: [frontend] Tạo frontend/src/components/Spinner.tsx + GoogleIcon.tsx + AvatarCell.tsx
  → Copy nguyên code từ App.tsx, xóa định nghĩa gốc
  → Phụ thuộc: không

TASK 3: [frontend] Tạo frontend/src/screens/LoadingScreen.tsx
  → Props: không có
  → Phụ thuộc: không

TASK 4: [frontend] Tạo frontend/src/screens/LoginPage.tsx
  → Props: { onError: (m: string) => void }
  → Import: Spinner, GoogleIcon từ ../components/, firebase từ ../lib/firebase
  → Phụ thuộc: TASK 2

TASK 5: [frontend] Tạo frontend/src/screens/OnboardingPage.tsx
  → Props: { sessionToken, currentSubjects, onDone, onError }
  → Import: Spinner từ ../components/, SUBJECTS từ ../lib/constants, updateSubjects từ ../lib/api
  → Phụ thuộc: TASK 1, 2

TASK 6: [frontend] Dọn App.tsx — xóa 6 định nghĩa cũ, thêm import
  → App.tsx không còn định nghĩa Spinner/GoogleIcon/AvatarCell/LoadingScreen/LoginPage/OnboardingPage
  → Phụ thuộc: TASK 2-5

TASK 7: [frontend] Viết test
  → components/__tests__/Spinner.test.tsx
  → components/__tests__/AvatarCell.test.tsx
  → screens/__tests__/LoadingScreen.test.tsx
  → screens/__tests__/LoginPage.test.tsx (mock signInWithPopup)
  → screens/__tests__/OnboardingPage.test.tsx (toggle môn, giới hạn 7, gọi updateSubjects)
  → Phụ thuộc: TASK 2-6
```

### DoD
```
□ Tồn tại: frontend/src/lib/constants.ts (SUBJECTS, SUBJECTS_MAP)
□ Tồn tại: components/Spinner.tsx, GoogleIcon.tsx, AvatarCell.tsx
□ Tồn tại: screens/LoadingScreen.tsx, LoginPage.tsx, OnboardingPage.tsx
□ App.tsx không còn định nghĩa 6 component trên
□ App.tsx ≤ 6.600 dòng (từ 7.018)
□ npm run build frontend PASS
□ npm run lint frontend PASS
□ npm test frontend PASS (tất cả test cũ + ≥ 5 test mới)
□ S5 hồi quy thủ công: đăng nhập Google → chọn môn → vào màn hình chính
```

### Ngoài phạm vi
- KHÔNG tách màn hình nào khác ngoài danh sách
- KHÔNG sửa CSS/logic/behavior
- SUBJECTS_MAP và các hằng số khác thuộc màn hình chưa tách → giữ trong App.tsx

---

## VÒNG 2 — Tách App.tsx: ProfilePage + AdGatePage + LeaderboardPage

Branch: refactor/split-app-tsx-round-2

### Phạm vi ước tính
- ProfilePage (dòng 603–919): ảnh đại diện, đổi môn, thống kê nhanh, điều hướng
- AdGatePage (dòng 530–601): countdown đếm ngược, mô phỏng xem quảng cáo (Premium)
- LeaderboardPage (dòng 2116–2343): bảng xếp hạng, podium top 3, load more
- App.tsx giảm thêm ~750 dòng → còn ~5.850 dòng

### Hằng số cần tách theo
- TREND_ICON, TREND_COLOR (hiện dòng 2096) → đi theo LeaderboardPage

### DoD (tương tự vòng 1, điều chỉnh số dòng)
```
□ Tồn tại: screens/ProfilePage.tsx, screens/AdGatePage.tsx, screens/LeaderboardPage.tsx
□ App.tsx không còn định nghĩa 3 component trên + TREND_ICON + TREND_COLOR
□ App.tsx ≤ 5.850 dòng
□ npm run build / lint / test frontend PASS
□ ≥ 3 file test mới (mỗi screen ít nhất 1)
□ S5 hồi quy: xem hồ sơ, xem quảng cáo giả, xem bảng xếp hạng
```

---

## VÒNG 3 — Tách App.tsx: PracticePage + các màn ôn tập

Branch: refactor/split-app-tsx-round-3

### Phạm vi ước tính
- PracticePage (951–1098): chọn chế độ ôn tập
- PracticeSessionScreen (1099–1323): màn câu hỏi ôn tập theo thời gian
- PracticeResultScreen (1324–1362): màn kết quả ôn tập
- Hằng số liên quan: SESSION_SECONDS, OPTION_LABELS, REPORT_REASONS, DIFF_LABEL
- App.tsx giảm thêm ~700 dòng → còn ~5.150 dòng

### Ghi chú quan trọng
PracticeSessionScreen có timer + interval — S3 phải kiểm tra kỹ không bị memory leak
khi tách ra ngoài (useEffect cleanup).

### DoD
```
□ Tồn tại: screens/practice/ (hoặc screens/PracticePage.tsx + PracticeSessionScreen.tsx + PracticeResultScreen.tsx)
□ App.tsx ≤ 5.150 dòng
□ npm run build / lint / test PASS
□ ≥ 3 file test mới
□ S5 hồi quy: bắt đầu phiên ôn tập → trả lời câu hỏi → xem kết quả
```

---

## VÒNG 4 — Tách App.tsx: ExamPage + các màn thi thử

Branch: refactor/split-app-tsx-round-4

### Phạm vi ước tính
- ExamPage (1446–1773): chọn đề thi, resume, bắt đầu
- ExamSessionScreen (1774–1912): màn thi, countdown, draft answers
- ExamQuestionCard (1913–1995): render 1 câu hỏi
- ExamResultScreen (1996–2095): kết quả chi tiết
- Helper functions: defaultAnswerFor, toSubmitAnswer, describeExamAnswer, examDraftKey,
  saveDraftAnswers, loadDraftAnswers, clearDraftAnswers (dòng 1363–1445)
- App.tsx giảm thêm ~700 dòng → còn ~4.450 dòng

### Ghi chú quan trọng
- Draft answers dùng localStorage — test cần mock localStorage
- Timer thi dùng interval — kiểm tra kỹ cleanup

### DoD
```
□ Tồn tại: screens/exam/ (ExamPage, ExamSessionScreen, ExamQuestionCard, ExamResultScreen)
□ Helper functions exam tách vào screens/exam/examUtils.ts
□ App.tsx ≤ 4.450 dòng
□ npm run build / lint / test PASS
□ ≥ 4 file test mới
□ S5 hồi quy: vào thi, resume bài dở, nộp bài, xem kết quả chi tiết
```

---

## VÒNG 5 — Tách App.tsx: ProgressPage + WrongAnswersPage + SubmissionsPage

Branch: refactor/split-app-tsx-round-5

### Phạm vi ước tính
- ScoreSparkline (4475–4500) → components/ScoreSparkline.tsx
- ProgressPage (4501–4762): thống kê tiến độ, lịch sử thi
- WrongAnswerRetry (4774–4918) + WrongAnswerCard (4919–5026) + WrongAnswersPage (5027–5172)
- SubmissionsPage (5179–5443) + SubmissionFormFields (5229) + SubmissionListSection (5444–5528)
- EXAM_PAGE_SIZE, OPTION_ALPHA, subjectName, daysLeft (dòng 4472–4773)
- App.tsx giảm thêm ~1.200 dòng → còn ~3.250 dòng

### DoD
```
□ Tồn tại: components/ScoreSparkline.tsx
□ Tồn tại: screens/ProgressPage.tsx, screens/WrongAnswersPage.tsx, screens/SubmissionsPage.tsx
□ App.tsx ≤ 3.250 dòng
□ npm run build / lint / test PASS
□ ≥ 4 file test mới
□ S5 hồi quy: xem tiến độ, ôn câu sai, xem/gửi câu hỏi đóng góp
```

---

## VÒNG 6 — Tách App.tsx: BattlePage + Thông báo

Branch: refactor/split-app-tsx-round-6

### Phạm vi ước tính
- NotificationToast (6037–6052) → components/NotificationToast.tsx
- NotificationPanel (6053–6160) → components/NotificationPanel.tsx
- BattlePage (6185–6602): khởi tạo socket, logic chính
- BattleSetupPhase (6603–6728)
- BattleQueuePhase (6729–6769)
- BattlePlayPhase (6770–6864)
- BattleResultPhase (6865–6907)
- BattleHistoryPage (6916–7007)
- Helper: formatNotifTime (7008–cuối file)
- App.tsx giảm thêm ~1.000 dòng → còn ~2.250 dòng

### Ghi chú quan trọng
BattlePage dùng Socket.io — đây là vòng phức tạp nhất trong 7 vòng tách.
S2 cần cẩn thận với socket lifecycle (connect/disconnect/cleanup trong useEffect).
S3 phải kiểm tra kỹ không bị dangling socket sau khi unmount.

### DoD
```
□ Tồn tại: components/NotificationToast.tsx, components/NotificationPanel.tsx
□ Tồn tại: screens/battle/ (BattlePage + 4 phase + BattleHistoryPage)
□ App.tsx ≤ 2.250 dòng
□ npm run build / lint / test PASS
□ ≥ 4 file test mới
□ S5 hồi quy: thi đấu từ đầu đến cuối, nhận thông báo, xem lịch sử trận
```

---

## VÒNG 7 — Tách App.tsx: toàn bộ Admin pages

Branch: refactor/split-app-tsx-round-7

### Phạm vi ước tính (~2.000 dòng Admin)
- AdminPage (2375) + AdminLoginPage (2446)
- AdminDashboardPage (5582) + PremiumDefaultToggle (5529)
- AdminUsersPage (5646)
- AdminQuestionManagementPage (2508) + AdminSubmissionsPage (2537)
- AdminReportsPage (2790) + AdminReportResolveForm (2997)
- AdminExamPage (3133) + AdminExamPaperListPage (3159) + AdminExamPaperDetailPage (3298)
- AdminAutoFillBox (3632) + AdminExamImportBox (4214) + AdminFromBankModal (4278)
- AdminQuestionBankPage (3723)
- Hằng số Admin: ADMIN_PAGE_SIZE, REPORT_STATUS_LABEL, REPORT_REASON_LABEL, QUESTION_TYPE_LABEL, QB_PAGE_SIZE...
- App.tsx sau vòng này: ~300 dòng (chỉ còn App component + auth + routing + notification polling)

### DoD
```
□ Tồn tại: screens/admin/ (tất cả các AdminPage trên)
□ App.tsx ≤ 350 dòng — chỉ còn: imports, SUBJECTS import, App() component
□ npm run build / lint / test PASS
□ ≥ 5 file test mới (ưu tiên AdminUsersPage, AdminQuestionBankPage)
□ S5 hồi quy toàn diện: đăng nhập admin, quản lý câu hỏi, duyệt báo cáo, quản lý người dùng
```

---

## VÒNG B — Observability Mức 1: Health Check

Branch: feat/observability-level-1

### TASK
```
TASK 1: [backend] Thêm endpoint GET /api/health
  → Trả { status: 'ok', uptime: number, database: 'ok'|'error', timestamp: string }
  → Có kiểm tra kết nối DB thật (Prisma $queryRaw`SELECT 1`)
  → KHÔNG cần auth (phải gọi được công khai)
  → Phụ thuộc: không

TASK 2: [backend] Viết unit test cho health endpoint
  → Mock Prisma thành công → expect database: 'ok'
  → Mock Prisma throw → expect database: 'error', status vẫn 200 (không crash)
  → Phụ thuộc: TASK 1

TASK 3: [docs] Hướng dẫn đăng ký UptimeRobot
  → Tạo docs/MONITORING.md: URL endpoint, tần suất ping (5 phút), cấu hình email cảnh báo
  → Phụ thuộc: TASK 1
```

### DoD
```
□ GET /api/health trả 200 + JSON đúng format (test bằng curl)
□ Kết nối DB thật được kiểm tra (không chỉ return 200 cứng)
□ npm test backend PASS (gồm test health endpoint)
□ npm run build backend PASS
□ docs/MONITORING.md tồn tại với hướng dẫn UptimeRobot đủ để người không rành IT làm theo
```

### Ngoài phạm vi vòng B
- KHÔNG triển khai Mức 2 (pino logger) hay Mức 3 (Sentry)
- KHÔNG đăng ký UptimeRobot thay người dùng (chỉ viết hướng dẫn)

---

## Ghi chú cho S1 sau mỗi vòng
Sau mỗi merge, S1 quay lại file này, đánh [x] vào vòng vừa xong, tạo branch mới,
viết PENDING/S2.md theo chi tiết vòng tiếp theo trong file này.
KHÔNG cần hỏi lại người dùng về thứ tự — đã xác nhận ngày 2026-09-03.
