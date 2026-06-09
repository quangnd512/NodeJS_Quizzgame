# 🔄 QuizzGame — Quy trình phát triển 7 Session

## Tổng quan

Dự án QuizzGame sử dụng quy trình phát triển tự động gồm **7 session Claude Code** phối hợp với nhau. Mỗi session đảm nhận một vai trò chuyên biệt trong vòng đời phát triển tính năng.

```
Bạn nhập prompt
      │
      ▼
[S1 Planner] ──► [S2 Coder] ──► [S3 Reviewer] ──► [S4 Writer]
                                                         │
[S1 Planner] ◄── [S7 Deployer] ◄── [S6 Explainer] ◄── [S5 Tester]
```

---

## Vai trò từng session

| Session | Tên | Nhiệm vụ chính |
|---------|-----|----------------|
| S1 | **Planner** | Tiếp nhận prompt → phân tích → lập kế hoạch → tạo branch |
| S2 | **Coder** | Viết toàn bộ code theo kế hoạch từ S1 |
| S3 | **Reviewer** | Review 7 tiêu chí, sửa lỗi, clear code, viết chú thích tiếng Việt, tạo test case |
| S4 | **Writer** | Cập nhật FEATURE_LOG.md, hướng dẫn admin, hướng dẫn người dùng |
| S5 | **Tester** | Đưa ra checklist test thực tế, hướng dẫn từng bước, sửa bug nếu fail |
| S6 | **Explainer** | Giải thích thuật toán/câu lệnh, viết GLOSSARY.md |
| S7 | **Deployer** | Push code, hỏi merge, thông báo hoàn thành, báo S1 vòng mới |

---

## Cài đặt lần đầu

### Yêu cầu
- macOS với Claude Code desktop app đã cài
- Node.js v18+ (qua nvm)
- Git đã cấu hình với GitHub

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

Session 1 sẽ khởi động. Khi mỗi session hoàn thành công việc, nó **tự động mở tab terminal mới** cho session tiếp theo — bạn không cần mở tay.

---

## Quy trình làm việc chi tiết

### Vòng 1 tính năng mới

```
┌─────────────────────────────────────────────────────────┐
│ BƯỚC 1 — Bạn nhập prompt ở Tab 1 (S1-Planner)          │
│   Ví dụ: "Làm tính năng phòng chờ game 2 người"        │
└─────────────────────────────┬───────────────────────────┘
                              │ S1 phân tích + hỏi xác nhận
                              ▼
┌─────────────────────────────────────────────────────────┐
│ BƯỚC 2 — S1 tạo branch + tự mở Tab 2 (S2-Coder)       │
│   Branch: feature/game-room                             │
│   S2 viết toàn bộ code                                 │
└─────────────────────────────┬───────────────────────────┘
                              │ code xong → tự mở Tab 3
                              ▼
┌─────────────────────────────────────────────────────────┐
│ BƯỚC 3 — Tab 3 (S3-Reviewer) tự động                   │
│   • Review 7 tiêu chí bảo mật + chất lượng             │
│   • Sửa lỗi, clear code, viết chú thích tiếng Việt     │
│   • Tạo test cases                                      │
└─────────────────────────────┬───────────────────────────┘
                              │ review xong → tự mở Tab 4
                              ▼
┌─────────────────────────────────────────────────────────┐
│ BƯỚC 4 — Tab 4 (S4-Writer) tự động                     │
│   • Cập nhật FEATURE_LOG.md                             │
│   • Viết hướng dẫn admin + người dùng                  │
└─────────────────────────────┬───────────────────────────┘
                              │ docs xong → tự mở Tab 5
                              ▼
┌─────────────────────────────────────────────────────────┐
│ BƯỚC 5 — Bạn test thực tế ở Tab 5 (S5-Tester)         │
│   • S5 đưa checklist test cụ thể từng bước             │
│   • Bạn test → báo Pass/Fail                           │
│   • Nếu Fail: S5 tự sửa và yêu cầu test lại           │
└─────────────────────────────┬───────────────────────────┘
                              │ tất cả pass → tự mở Tab 6
                              ▼
┌─────────────────────────────────────────────────────────┐
│ BƯỚC 6 — Tab 6 (S6-Explainer) tự động                  │
│   • Hỏi bạn có gì chưa hiểu                            │
│   • Giải thích chi tiết nếu có câu hỏi                 │
│   • Ghi vào GLOSSARY.md                                │
└─────────────────────────────┬───────────────────────────┘
                              │ xong → tự mở Tab 7
                              ▼
┌─────────────────────────────────────────────────────────┐
│ BƯỚC 7 — Bạn xác nhận ở Tab 7 (S7-Deployer)           │
│   • S7 push branch lên GitHub                          │
│   • Hỏi: "Bạn có muốn merge không?"                   │
│   • Nếu có: merge vào master → báo S1 vòng mới        │
└─────────────────────────────────────────────────────────┘
```

---

## Việc bạn cần làm trong mỗi vòng

| Thời điểm | Bạn làm gì | Tab nào |
|-----------|-----------|---------|
| Bắt đầu | Nhập prompt tính năng mới | Tab 1 |
| Giữa | Xác nhận kế hoạch (có/không thay đổi) | Tab 1 |
| Giữa | Test thực tế theo checklist | Tab 5 |
| Cuối | Xác nhận merge vào master | Tab 7 |
| Tùy chọn | Hỏi thắc mắc về code | Tab 6 |

**Tất cả việc còn lại (viết code, review, docs, push) các session tự làm.**

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
├── WORKFLOW_GUIDE.md          # Hướng dẫn nhanh
├── start-session.sh           # Script khởi động session theo số
├── open-next.sh               # Script tự động mở tab tiếp theo
└── roles/
    ├── session-1-planner.md   # Role S1: lập kế hoạch
    ├── session-2-coder.md     # Role S2: viết code
    ├── session-3-reviewer.md  # Role S3: review code
    ├── session-4-writer.md    # Role S4: viết tài liệu
    ├── session-5-tester.md    # Role S5: kiểm thử
    ├── session-6-explainer.md # Role S6: giải thích
    └── session-7-deployer.md  # Role S7: push & merge
```

---

## Tài liệu liên quan

| File | Mô tả |
|------|-------|
| `docs/FEATURE_LOG.md` | Log chi tiết từng tính năng đã làm |
| `docs/CODE_REVIEW_LOG.md` | Lịch sử review code |
| `docs/TEST_CASES.md` | Test cases cho từng tính năng |
| `docs/GLOSSARY.md` | Giải thích thuật ngữ kỹ thuật |
| `docs/guides/admin-guide.md` | Hướng dẫn sử dụng cho admin |
| `docs/guides/user-guide.md` | Hướng dẫn sử dụng cho người dùng |

---

## Tiêu chí review (S3 áp dụng cho mọi tính năng)

1. **Atomic transaction** — Các thao tác DB liên quan có được wrap trong transaction?
2. **Race condition** — Xử lý đồng thời, đặc biệt với điểm và đấu trường
3. **Error handling** — Đầy đủ try/catch, custom error class, HTTP status đúng
4. **SQL injection / Input validation** — Mọi input từ client đều được validate
5. **N+1 query / Index** — Không loop gọi DB, các trường filter có index
6. **TypeScript** — Không có `any` type
7. **Edge cases** — Điểm âm, user không tồn tại, disconnect giữa chừng

---

## Khắc phục sự cố

### Session bị treo hoặc lỗi
```bash
# Khởi động lại session cụ thể
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
