# 🔄 QuizzGame — 7-Session Workflow Guide

## Tổng quan

```
Bạn nhập prompt
      │
      ▼
[S1 Planner] ──lệnh──► [S2 Coder] ──lệnh──► [S3 Reviewer] ──lệnh──► [S4 Writer]
                                                                            │
[S1 Planner] ◄──lệnh── [S7 Deployer] ◄──lệnh── [S6 Explainer] ◄──lệnh── [S5 Tester]
```

Mỗi session làm xong → gửi lệnh sang session kế tiếp → bạn chỉ cần **xác nhận** và **test thực tế**.

---

## Khởi động lần đầu

### Mở 7 tab terminal, mỗi tab chạy 1 lệnh:

```bash
# Tab 1
cd /Users/quangnd512/Desktop/claude/quiz_dh
./workflow/start-session.sh 1

# Tab 2
cd /Users/quangnd512/Desktop/claude/quiz_dh
./workflow/start-session.sh 2

# Tab 3
cd /Users/quangnd512/Desktop/claude/quiz_dh
./workflow/start-session.sh 3

# Tab 4
cd /Users/quangnd512/Desktop/claude/quiz_dh
./workflow/start-session.sh 4

# Tab 5
cd /Users/quangnd512/Desktop/claude/quiz_dh
./workflow/start-session.sh 5

# Tab 6
cd /Users/quangnd512/Desktop/claude/quiz_dh
./workflow/start-session.sh 6

# Tab 7
cd /Users/quangnd512/Desktop/claude/quiz_dh
./workflow/start-session.sh 7
```

---

## Vai trò từng session

| Session | Tên | Nhiệm vụ | Nhận lệnh từ | Gửi lệnh cho |
|---------|-----|----------|-------------|-------------|
| S1 | Planner | Phân tích & lập kế hoạch | Bạn / S7 | S2 |
| S2 | Coder | Viết code | S1 | S3 |
| S3 | Reviewer | Review, sửa lỗi, chú thích | S2 | S4 |
| S4 | Writer | Viết tài liệu | S3 | S5 |
| S5 | Tester | Kiểm thử thực tế | S4 | S6 |
| S6 | Explainer | Giải thích kỹ thuật | S5 | S7 |
| S7 | Deployer | Push & merge GitHub | S6 | S1 |

---

## Việc BẠN cần làm

1. **Tab S1**: Nhập prompt tính năng mới → xác nhận kế hoạch
2. **Tab S5**: Test thực tế theo checklist → báo Pass/Fail
3. **Tab S6**: Hỏi nếu có gì chưa hiểu
4. **Tab S7**: Xác nhận có muốn merge không

**Tất cả việc còn lại các session tự làm.**

---

## Cơ chế giao tiếp

Các session dùng 2 tool để phối hợp:
- `list_sessions` — tìm session khác đang mở
- `send_message` — gửi lệnh (bạn cần xác nhận mỗi lần gửi)

---

## Lưu ý

- Giữ **tất cả 7 tab mở** trong suốt quá trình
- Mỗi khi session nhận được tin nhắn, **chuyển sang tab đó** để xem
- Nếu session bị lỗi, chạy lại: `./workflow/start-session.sh <số>`
- Backend và Frontend phải chạy khi S5 test: mở thêm 2 tab chạy `npm run dev`

---

## File structure

```
workflow/
├── WORKFLOW_GUIDE.md          ← File này
├── start-session.sh           ← Script khởi động
└── roles/
    ├── session-1-planner.md
    ├── session-2-coder.md
    ├── session-3-reviewer.md
    ├── session-4-writer.md
    ├── session-5-tester.md
    ├── session-6-explainer.md
    └── session-7-deployer.md
```
