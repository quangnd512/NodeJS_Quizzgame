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

## Stack dự án — NGUỒN SỰ THẬT DUY NHẤT
<!-- ⚠️ ĐỔI TOÀN BỘ MỤC NÀY khi dùng cho dự án khác -->
<!-- ⚠️ KHÔNG khai báo stack ở bất kỳ file role nào khác — chỉ ở đây, tránh mâu thuẫn -->

Dự án có **3 phần**. Mọi TASK phải xác định rõ thuộc phần nào.

| Phần | Thư mục | Stack |
|------|---------|-------|
| Backend | `backend/` | Node.js + Express 4 + TypeScript 5, Prisma **v6** (KHÔNG v7), Socket.io 4, firebase-admin |
| Web | `frontend/` | React **19** + Vite 8 + TypeScript 6, socket.io-client, firebase web SDK |
| Mobile | `mobile/` | React Native 0.86 + **Expo 57** + TypeScript 6, React Navigation 7, firebase web SDK |

**Hạ tầng**: PostgreSQL cổng `5433`, Redis cổng `6379`, backend chạy cổng `4000`,
web dev cổng mặc định Vite (5173, tự tăng nếu bận — Vite proxy `/api` và `/socket.io` sang 4000).

**Quy ước code chung**: TypeScript strict, KHÔNG dùng `any`, module NodeNext (không `require`),
custom error class + `ERROR_CODE_TO_HTTP_STATUS`, middleware `verifyAppToken` cho route sau `/login`.

### ⚠️ Lệnh kiểm tra khác nhau theo từng phần — KHÔNG chạy mù

Mỗi phần có script khác nhau. Chạy lệnh không tồn tại sẽ báo lỗi giả:

| Phần | Kiểm tra bằng | KHÔNG có |
|------|---------------|----------|
| `backend/` | `npm test` (vitest), `npm run build`, các `npm run smoke:*` | ✗ `lint` |
| `frontend/` | `npm run lint`, `npm test` (vitest + jsdom), `npm run build` | — |
| `mobile/` | `npm run lint`, `npm run typecheck`, `npm test` (jest-expo) | ✗ `build` (EAS Build lo) |

**Viết test ở đâu:**
- `backend/` → `src/**/__tests__/*.test.ts` (vitest, mock Prisma — không cần DB thật)
- `frontend/` → `src/**/*.test.ts(x)` (vitest + @testing-library/react)
- `mobile/` → `src/**/__tests__/*.test.ts(x)` (jest-expo + @testing-library/react-native;
  mock `expo-secure-store` có sẵn trong `mobile/jest.setup.js`)

**CI** (`.github/workflows/ci.yml`) chạy test cho **cả 3 phần** — test fail sẽ chặn merge.

### 🚨 Khi một lệnh npm treo ở 0% CPU — kiểm tra `node_modules` TRƯỚC

Triệu chứng: lệnh chạy hàng chục phút, không in gì, **0.0% CPU** (không phải chậm — là đứng).

```bash
du -sh node_modules && find node_modules -type f | wc -l
```
Nếu dung lượng nhỏ bất thường so với số file (VD: 3.9MB cho 56.000 file) → **node_modules
hỏng**, file có tên nhưng rỗng ruột. Xảy ra khi `npm install` chạy lúc ổ đĩa gần đầy:
npm không ghi được nội dung nhưng **vẫn thoát với mã 0 như thành công**.

```bash
du -sh node_modules/react-native   # 0B = chắc chắn hỏng
rm -rf node_modules && npm install --legacy-peer-deps
```

Đây là chẩn đoán ĐÚNG cho triệu chứng treo, không phải "máy yếu" hay "cấu hình sai".

Trước khi chạy, nếu không chắc: `node -e "console.log(Object.keys(require('./<phần>/package.json').scripts))"`

## Git
<!-- ⚠️ KIỂM TRA LẠI MỤC NÀY khi dùng cho dự án khác (tên nhánh chính có thể là main) -->
- Nhánh chính: **`master`** (không phải `main`)
- Branch hiện tại xem bằng: `git branch --show-current`
- Không tự push lên master — chỉ push feature branch
- Commit message: `feat/fix/chore(scope): mô tả ngắn`
- **Merge BẮT BUỘC qua Pull Request** (`gh pr create` → `gh pr merge`), không bao giờ
  `git checkout master && git merge` cục bộ — merge cục bộ bỏ qua toàn bộ CI và
  branch protection
- **Git hook**: chạy `./workflow/setup-hooks.sh` một lần sau khi clone. Hook tự chạy
  typecheck/lint của phần vừa sửa trước mỗi commit

## Tự động hoá đang có
| Cơ chế | File | Làm gì |
|---|---|---|
| CI | `.github/workflows/ci.yml` | typecheck + test + build cho cả 3 phần, đo độ phủ |
| Bảo mật | `.github/workflows/security.yml` | CodeQL, npm audit, quét secret (Gitleaks) |
| Cập nhật thư viện | `.github/dependabot.yml` | Tự tạo PR khi có bản vá bảo mật (hàng tuần) |
| Git hook | `.githooks/pre-commit` | Chặn commit nếu typecheck/lint hỏng |

## Sức khoẻ kiến trúc
S3 kiểm tra kích thước file ở tiêu chí review #9. Ngưỡng: **>1.000 dòng thì bắt buộc
báo S1 lập kế hoạch tách**. Nợ hiện tại: `frontend/src/App.tsx` = 7.018 dòng
(xem `workflow/handoff/backlog/S1_tach_app_tsx.md`).

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
↑                           ↑ người dùng chọn có/không                │
└───────────────── vòng tiếp theo ────────────────────────────────────┘

S8 trả lại được S2/S3/S4/S5/S6 — tối đa 3 lần rồi phải hỏi người dùng
S7 phát hiện lỗi sau merge → quy trình khẩn cấp (rollback code + DB) trong S7
S9 khi người dùng xác nhận HOÀN THÀNH → chốt sổ: lập MAINTENANCE.md + tự đánh giá quy trình
```

## Sổ bảo trì `docs/MAINTENANCE.md`
Do **S9 lập** khi dự án hoàn thành, do **người dùng tự ghi** khi gặp trục trặc lúc dùng thật.

- **S1 phải đọc file này ở Bước 0c** mỗi khi mở session (nếu dự án đã ra mắt) và chủ động
  báo nếu có mục chưa xử lý — đừng chờ người dùng nhớ ra
- Mục ghi `Khẩn cấp` được ưu tiên hơn tính năng mới
- Sửa xong → chuyển mục từ "🆕 CẦN XỬ LÝ" sang "✅ ĐÃ XỬ LÝ", **không xoá**
