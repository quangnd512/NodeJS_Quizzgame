# QuizzGame — Quy tắc chung cho mọi session

> ⚠️ **KHI COPY WORKFLOW SANG DỰ ÁN KHÁC**: file này được nạp tự động vào **mọi** session.
> Phải viết lại mục "Stack dự án" và "Git" bên dưới cho dự án mới, nếu không cả 9 session
> sẽ làm việc theo stack sai. Xem S1 Bước 0b mục 7.

## Model mỗi session (tự động qua start.sh)
| Session | Model | Lý do |
|---------|-------|-------|
| S1 Kiến Trúc Sư | sonnet | Phân tích, lập kế hoạch phức tạp |
| S2 Thợ Code | sonnet | Viết code chính xác |
| S3 Soát Lỗi | sonnet | Review & fix bugs |
| S4 Ghi Chép | haiku | Viết docs — tác vụ đơn giản |
| S5 Thử Nghiệm | haiku | Tạo test case — tác vụ đơn giản |
| S6 Giảng Giải | haiku | Giải thích — tác vụ đơn giản |
| S7 Đóng Gói | haiku | Git/CI — tác vụ đơn giản |
| S8 Giám Sát | sonnet | QA tổng thể — cần đánh giá sâu |
| S9 Cố Vấn | sonnet | Tư vấn deploy — cần reasoning |

## Khởi động session (Bước 0 — mọi session đều làm)
```bash
cat workflow/STATUS.md
cat workflow/handoff/PENDING/S<số>.md 2>/dev/null || echo "(không có lệnh pending)"
```
- Có PENDING → thực hiện theo, xong thì `mv` sang `workflow/handoff/archive/S<số>.done.md`
- Cập nhật STATUS.md: ghi session đang làm gì (1 dòng)

## Tiết kiệm token
- Chỉ đọc file khi thực sự cần — không đọc lại file đã đọc trong cùng session
- PENDING file: tối đa 30 dòng — chỉ ghi task, file ảnh hưởng, yêu cầu cụ thể
- Handoff done file: tối đa 20 dòng — done gì, file nào thay đổi, pending gì
- Không giải thích dài dòng trong file handoff — dùng bullet point ngắn
- Không đọc toàn bộ file lớn nếu chỉ cần 1 phần — dùng offset/limit
- **STATUS.md**: chỉ đọc phần "Tính năng đang triển khai" + dòng của session mình trong
  bảng — KHÔNG cần đọc lại lịch sử các tính năng đã Done trước đó
- **Không dán lại toàn văn**: khi PENDING dẫn nguồn từ session trước, trích dẫn đường dẫn
  + số dòng (`archive/S3.done.md dòng 5-12`) thay vì copy-paste lại nội dung — đọc gốc
  khi cần chi tiết, đỡ tốn token double và tránh sai lệch khi tóm tắt (xem mục dưới)

## Chống "tam sao thất bản" giữa các session
Mỗi session tóm tắt lại việc mình làm khi bàn giao — nhưng tóm tắt luôn có nguy cơ bỏ sót ý.
Quy tắc bắt buộc khi ghi PENDING cho session kế tiếp:
- Luôn kèm dòng: `📄 Chi tiết đầy đủ: workflow/handoff/archive/SX.done.md`
- Session nhận việc: nếu tóm tắt không đủ rõ để làm ngay, **đọc file gốc** trước khi hỏi lại
  người dùng — đừng đoán ý dựa trên bản tóm tắt mơ hồ

## Stack dự án
<!-- ⚠️ ĐỔI TOÀN BỘ MỤC NÀY khi dùng cho dự án khác -->
- Backend: Node.js + Express + TypeScript, PostgreSQL + Prisma
- Mobile: React Native + Expo 57 + TypeScript
- Auth: Firebase + JWT
- Thư mục: `backend/` và `mobile/`

## Git
<!-- ⚠️ KIỂM TRA LẠI MỤC NÀY khi dùng cho dự án khác (tên nhánh chính có thể là main) -->
- Branch hiện tại xem bằng: `git branch --show-current`
- Không tự push lên main/master — chỉ push feature branch
- Commit message: `feat/fix/chore(scope): mô tả ngắn`

## Workflow — 3 thư mục handoff (KHÔNG lẫn nhau)
| Thư mục | Chứa gì |
|---------|---------|
| `workflow/handoff/PENDING/` | Lệnh **đang chờ** — chỉ `SX.md`. Rỗng = hết việc chờ |
| `workflow/handoff/backlog/` | Kế hoạch dài hạn chưa tới lượt — chỉ S1 đọc |
| `workflow/handoff/archive/` | Lệnh đã xong (`SX.done.md`) — không đọc thường xuyên |

- Xong lệnh: `mv workflow/handoff/PENDING/SX.md workflow/handoff/archive/SX.done.md`
- Không để `SX.md` và `SX.done.md` cùng nằm trong `PENDING/`
- STATUS.md: cập nhật ngắn gọn, chỉ ghi session nào đang làm gì
- Mở session tiếp: `./workflow/open.sh <số>`

## Khi nào PHẢI hỏi xác nhận, khi nào KHÔNG cần

Hỏi xác nhận ở mọi bước làm workflow chậm và đòi hỏi bạn có mặt liên tục. Chỉ hỏi ở chỗ
thật sự có rủi ro — các thao tác đọc/kiểm tra không cần dừng lại chờ:

| Loại hành động | Có cần hỏi trước? |
|---|---|
| Đọc file, chạy test, chạy lint/build, phân tích code | ❌ Không cần — cứ làm luôn |
| Sửa code trên feature branch, viết docs, viết test | ❌ Không cần — cứ làm luôn |
| Chuyển giao sang session tiếp theo (mở tab mới) | ✅ Luôn hỏi |
| Merge vào master/main | ✅ Luôn hỏi |
| Push lên remote, tạo/xóa branch trên GitHub | ✅ Luôn hỏi |
| Xóa dữ liệu, revert/reset, thao tác không thể hoàn tác | ✅ Luôn hỏi |
| Deploy, thay đổi cấu hình production | ✅ Luôn hỏi |

Nguyên tắc: **rủi ro thấp + trong phạm vi 1 session → tự làm; rủi ro cao hoặc ảnh hưởng
ra ngoài (session khác, remote, production) → luôn hỏi**.

## Luồng session
```
S1 → S2 → S3 → S4 → S5 →  [S6 tùy chọn]  → S8 → S7 → (S9 nếu deploy)
                            ↑ người dùng chọn có/không
S8 trả lại được S2/S3/S4/S5/S6 — tối đa 3 lần rồi phải hỏi người dùng
S7 phát hiện lỗi sau merge → quy trình khẩn cấp (rollback/hotfix) trong S7
```
