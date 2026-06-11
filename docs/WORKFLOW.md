# 🔄 QuizzGame — Quy trình phát triển 9 Session

## Tổng quan

Dự án QuizzGame sử dụng quy trình phát triển tự động gồm **9 session Claude Code** phối hợp với nhau.
Mỗi session đảm nhận một vai trò chuyên biệt trong vòng đời phát triển tính năng (SDLC):
yêu cầu → thiết kế → code → test → tài liệu → kiểm thử → giải thích → QA/QC → đóng gói → (lặp lại hoặc) triển khai.

```
[S1-KienTrucSu] ──► [S2-ThoCode] ──► [S3-SoatLoi] ──► [S4-GhiChep]
                                                            │
                                                            ▼
                                                    [S5-ThuNghiem]
                                                            │
                                                            ▼
                                                    [S6-GiangGiai]
                                                            │
                                                            ▼
                                                    [S8-GiamSat] ◄──────┐
                                                       │      │          │
                                              ĐẠT ─────┘      └─KHÔNG ĐẠT┤
                                                │            (trả về S2/S3/
                                                ▼             S4/S5/S6 tuỳ vấn đề)
                                          [S7-DongGoi]
                                                │
                                ┌───────────────┴───────────────┐
                                │                                │
                        "còn làm tiếp"                  "đủ tính năng rồi"
                                │                                │
                                ▼                                ▼
                        quay về [S1-KienTrucSu]          [S9-CoVan] (chỉ chạy
                                                           1 lần khi launch)
```

**Mỗi lần một session hoàn thành việc của mình, nó sẽ HỎI XÁC NHẬN người dùng
trước khi chuyển toàn bộ kết quả sang session tiếp theo.** Bạn chỉ cần mở Tab 1
(Session 1), trả lời các câu hỏi và xác nhận từng bước chuyển giao — các session
tiếp theo sẽ tự mở tab khi được xác nhận.

---

## Vai trò từng session

| Session | Tên | Tag | Nhiệm vụ chính |
|---------|-----|-----|----------------|
| S1 | **Kiến Trúc Sư** | `[S1-KienTrucSu]` | Hỏi yêu cầu bằng ngôn ngữ đời thường, dịch sang đặc tả kỹ thuật, chia TASK, tạo branch |
| S2 | **Thợ Code** | `[S2-ThoCode]` | Viết code + unit test theo từng TASK, tổng kết công việc khi xong |
| S3 | **Người Soát Lỗi** | `[S3-SoatLoi]` | Review 7 tiêu chí, viết/chạy test (unit + integration), build/lint, đối chiếu thiết kế |
| S4 | **Người Ghi Chép** | `[S4-GhiChep]` | Cập nhật FEATURE_LOG, openapi.yaml, hướng dẫn admin/người dùng |
| S5 | **Người Thử Nghiệm** | `[S5-ThuNghiem]` | Checklist test thủ công (UI/UX), sửa bug nếu fail |
| S6 | **Người Giảng Giải** | `[S6-GiangGiai]` | Giải thích thuật toán/quyết định thiết kế, viết GLOSSARY.md, ADR |
| S7 | **Người Đóng Gói** | `[S7-DongGoi]` | Push code, chờ CI pass, hỏi merge, hỏi định hướng tiếp theo |
| S8 | **Giám Sát Chất Lượng** | `[S8-GiamSat]` | QA/QC tổng thể: đối chiếu yêu cầu gốc, quản lý TASKS.md/PROJECT_OVERVIEW.md, quality gate |
| S9 | **Cố Vấn Ra Mắt** | `[S9-CoVan]` | Tư vấn + hướng dẫn triển khai thực tế (chỉ chạy khi dự án hoàn thiện) |

---

## Cài đặt lần đầu

### Yêu cầu
- macOS với Claude Code desktop app đã cài
- Node.js v18+ (qua nvm)
- Git đã cấu hình với GitHub
- (Tuỳ chọn) `gh` CLI đã đăng nhập — để Session 7 kiểm tra trạng thái CI

### Thêm `claude` vào PATH

```bash
echo 'export PATH="/Users/quangnd512/Library/Application Support/Claude/claude-code/2.1.165/claude.app/Contents/MacOS:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Kiểm tra
claude --version  # Phải hiện: 2.1.165 (Claude Code)
```

### Cấp quyền script

```bash
chmod +x workflow/start-session.sh
chmod +x workflow/open-next.sh
```

---

## Khởi động workflow

Chỉ cần **1 lệnh duy nhất**:

```bash
cd /Users/quangnd512/Desktop/claude/quiz_dh
./workflow/start-session.sh 1
```

Session 1 sẽ khởi động. Sau mỗi bước, session sẽ hỏi bạn xác nhận trước khi
**tự động mở tab terminal mới** cho session tiếp theo — bạn không cần mở tay.

---

## Quy trình làm việc chi tiết (1 vòng tính năng mới)

```
┌──────────────────────────────────────────────────────────────────────┐
│ TAB 1 — S1-KienTrucSu                                                  │
│  • Hỏi bạn muốn thêm/sửa gì (ngôn ngữ đời thường)                     │
│  • Đặt câu hỏi làm rõ, tóm tắt, xác nhận với bạn                       │
│  • Tự dịch sang đặc tả kỹ thuật + chia danh sách TASK                  │
│  • Trình bày kế hoạch (tóm tắt dễ hiểu + chi tiết kỹ thuật)            │
│  • Hỏi: "Bạn đồng ý kế hoạch này chứ?"                                │
│  • Tạo branch                                                           │
│  • ❓ Hỏi xác nhận chuyển sang S2 → mở Tab 2                           │
└──────────────────────────────────────┬────────────────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│ TAB 2 — S2-ThoCode                                                     │
│  • Viết code + unit test theo từng TASK                                │
│  • Tự kiểm tra: tsc, lint, test                                        │
│  • Tổng kết công việc đã làm                                           │
│  • ❓ Hỏi xác nhận chuyển sang S3 → mở Tab 3                           │
└──────────────────────────────────────┬────────────────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│ TAB 3 — S3-SoatLoi                                                     │
│  • Review 7 tiêu chí bảo mật + chất lượng, sửa lỗi, clear code        │
│  • Viết chú thích tiếng Việt                                           │
│  • Quy trình test chuyên nghiệp: viết bổ sung unit/integration test,   │
│    chạy npm test + build + lint, đối chiếu thiết kế S1                │
│  • ❓ Hỏi xác nhận chuyển sang S4 → mở Tab 4                           │
└──────────────────────────────────────┬────────────────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│ TAB 4 — S4-GhiChep                                                     │
│  • Cập nhật FEATURE_LOG.md, openapi.yaml                               │
│  • Viết hướng dẫn admin + người dùng                                   │
│  • ❓ Hỏi xác nhận chuyển sang S5 → mở Tab 5                           │
└──────────────────────────────────────┬────────────────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│ TAB 5 — S5-ThuNghiem (bạn test thực tế)                               │
│  • Đưa checklist test UI/UX cụ thể từng bước                           │
│  • Bạn test → báo Pass/Fail                                            │
│  • Nếu Fail: S5 tự sửa và yêu cầu test lại                             │
│  • ❓ Hỏi xác nhận chuyển sang S6 → mở Tab 6                           │
└──────────────────────────────────────┬────────────────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│ TAB 6 — S6-GiangGiai                                                   │
│  • Hỏi bạn có gì chưa hiểu, giải thích chi tiết                        │
│  • Ghi GLOSSARY.md, ADR (nếu có quyết định thiết kế quan trọng)        │
│  • ❓ Hỏi xác nhận chuyển sang S8 → mở Tab 8                           │
└──────────────────────────────────────┬────────────────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│ TAB 8 — S8-GiamSat (QA/QC tổng thể)                                    │
│  • Đối chiếu toàn bộ kết quả (S1→S6) với yêu cầu gốc                   │
│  • Checklist quality gate                                              │
│  • ĐẠT → cập nhật TASKS.md/PROJECT_OVERVIEW.md, ❓ hỏi xác nhận → mở Tab 7│
│  • KHÔNG ĐẠT → trả về session phụ trách (S2-S6) để sửa, rồi rà soát lại│
└──────────────────────────────────────┬────────────────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│ TAB 7 — S7-DongGoi                                                     │
│  • Push branch lên GitHub, chờ CI pass                                 │
│  • Hỏi: "Bạn có muốn merge không?"                                    │
│  • Nếu có: merge vào master                                            │
│  • Hỏi định hướng tiếp theo:                                           │
│     1️⃣ Làm tính năng mới → mở Tab 1 (S1)                              │
│     2️⃣ Đủ tính năng, triển khai thật → mở Tab 9 (S9)                  │
└──────────────────────────────────────────────────────────────────────┘
```

### Khi dự án hoàn thiện — TAB 9 (S9-CoVan)

Chỉ chạy 1 lần khi S7 xác nhận dự án đã đủ tính năng:
- Xác nhận trạng thái dự án (đọc TASKS.md, PROJECT_OVERVIEW.md)
- Hỏi mục tiêu triển khai, tư vấn/tranh luận phương án phù hợp
- Hướng dẫn từng bước triển khai + chi phí dự kiến
- Đồng hành xử lý sự cố, ghi lại `docs/DEPLOYMENT.md`

---

## Việc bạn cần làm trong mỗi vòng

| Thời điểm | Bạn làm gì | Tab nào |
|-----------|-----------|---------|
| Bắt đầu | Mô tả yêu cầu bằng lời thường, trả lời câu hỏi làm rõ | Tab 1 |
| Giữa | Xác nhận kế hoạch (có/không thay đổi) | Tab 1 |
| Mỗi bước | Xác nhận chuyển giao sang session tiếp theo | Tab hiện tại |
| Giữa | Test thực tế theo checklist | Tab 5 |
| Cuối | Xác nhận merge vào master + chọn hướng tiếp theo | Tab 7 |
| Tùy chọn | Hỏi thắc mắc về code | Tab 6 |
| Khi hoàn thiện | Quyết định phương án triển khai, theo hướng dẫn từng bước | Tab 9 |

**Tất cả việc còn lại (viết code, review, test tự động, docs, push) các session tự làm.**

---

## Cơ chế giao tiếp giữa các session

Các session dùng 2 công cụ built-in của Claude Code:

- **`list_sessions`** — tìm session đang mở theo tên
- **`send_message`** — gửi lệnh sang session khác (yêu cầu bạn xác nhận)

Mỗi lần một session gửi lệnh sang session khác, bạn sẽ thấy **popup xác nhận** → bấm **Enter** để đồng ý.

---

## Cấu trúc thư mục workflow

```
workflow/
├── start-session.sh           # Script khởi động session theo số (1-9)
├── open-next.sh               # Script tự động mở tab tiếp theo
└── roles/
    ├── session-1-kien-truc-su.md  # S1: thu thập yêu cầu + thiết kế + lập kế hoạch
    ├── session-2-tho-code.md      # S2: viết code + test
    ├── session-3-soat-loi.md      # S3: review + test chuyên nghiệp
    ├── session-4-ghi-chep.md      # S4: viết tài liệu
    ├── session-5-thu-nghiem.md    # S5: kiểm thử thủ công
    ├── session-6-giang-giai.md    # S6: giải thích kỹ thuật
    ├── session-7-dong-goi.md      # S7: push, CI, merge
    ├── session-8-giam-sat.md      # S8: QA/QC tổng thể
    └── session-9-co-van.md        # S9: tư vấn triển khai
```

---

## Tài liệu liên quan

| File | Mô tả |
|------|-------|
| `docs/PROJECT_OVERVIEW.md` | Tổng quan dự án — duy trì bởi S8 |
| `docs/TASKS.md` | Theo dõi tiến độ từng tính năng — duy trì bởi S8 |
| `docs/GAMEPLAY.md` | Luật chơi/luồng ôn tập (nếu có) — duy trì bởi S8 |
| `docs/FEATURE_LOG.md` | Log chi tiết từng tính năng đã làm |
| `docs/CODE_REVIEW_LOG.md` | Lịch sử review code |
| `docs/TEST_CASES.md` | Test cases cho từng tính năng |
| `docs/GLOSSARY.md` | Giải thích thuật ngữ kỹ thuật |
| `docs/adr/` | Architecture Decision Records |
| `docs/api/openapi.yaml` | API contract |
| `docs/guides/admin-guide.md` | Hướng dẫn sử dụng cho admin |
| `docs/guides/user-guide.md` | Hướng dẫn sử dụng cho người dùng |
| `docs/DEPLOYMENT.md` | Thông tin triển khai thực tế — duy trì bởi S9 |
| `.github/workflows/ci.yml` | CI pipeline: typecheck/lint/build cho FE+BE |

---

## Tiêu chí review (S3 áp dụng cho mọi tính năng)

1. **Atomic transaction** — Các thao tác DB liên quan có được wrap trong transaction?
2. **Race condition** — Xử lý đồng thời, đặc biệt với điểm và đấu trường
3. **Error handling** — Đầy đủ try/catch, custom error class, HTTP status đúng
4. **SQL injection / Input validation** — Mọi input từ client đều được validate
5. **N+1 query / Index** — Không loop gọi DB, các trường filter có index
6. **TypeScript** — Không có `any` type
7. **Edge cases** — Điểm âm, user không tồn tại, disconnect giữa chừng

Cộng thêm **quy trình test chuyên nghiệp**: unit test + integration test phân loại
Happy path / Edge case / Error case, chạy `npm test` + `npm run build` + `npm run lint` đều PASS.

---

## Quality Gate (S8) trước khi merge

```
□ Tất cả TASK trong kế hoạch S1 đã hoàn thành
□ API/DB đúng như thiết kế ban đầu
□ Review 7 tiêu chí của S3: không còn lỗi tồn đọng
□ Test tự động: tất cả PASS, build + lint PASS
□ Test thủ công (S5): tất cả PASS
□ Tài liệu (S4 + S6): đầy đủ
□ Không có yêu cầu nào của người dùng bị bỏ sót/làm sai
```

Nếu KHÔNG ĐẠT, S8 trả về đúng session phụ trách:

| Vấn đề | Trả về |
|---|---|
| Logic/code sai, thiếu task | S2-ThoCode |
| Code chất lượng kém, thiếu test | S3-SoatLoi |
| Tài liệu thiếu/sai | S4-GhiChep |
| Test case không đủ | S5-ThuNghiem |
| Giải thích/glossary thiếu | S6-GiangGiai |

---

## Khắc phục sự cố

### Session bị treo hoặc lỗi
```bash
# Khởi động lại session cụ thể (1-9)
./workflow/start-session.sh <số>
```

### Tab không tự mở
Chạy thủ công trong terminal mới:
```bash
cd /Users/quangnd512/Desktop/claude/quiz_dh && ./workflow/start-session.sh <số_tiếp_theo>
```

### `claude` không tìm thấy
```bash
source ~/.zshrc
claude --version
```

### CI fail ở Session 7
```bash
gh run view --log-failed   # xem log lỗi cụ thể
```
S7 sẽ tự sửa lỗi, commit, push lại và chờ CI chạy lại.
