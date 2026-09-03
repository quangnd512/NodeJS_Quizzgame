# Thiết lập GitHub — bảo vệ nhánh master

> Những việc trong file này **chỉ làm một lần**, và **phải do bạn tự bấm trên web GitHub**
> — Claude không có quyền đổi cài đặt repo của bạn.
>
> Sau khi làm xong, code hỏng sẽ **không thể** vào `master` kể cả khi ai đó bấm nhầm.

---

## 1. Bật Branch Protection cho `master` (quan trọng nhất)

Vào: **github.com/quangnd512/NodeJS_Quizzgame** → tab **Settings** → mục **Branches**
→ nút **Add branch protection rule**

Điền:

| Ô | Điền gì |
|---|---|
| Branch name pattern | `master` |

Tích các ô sau:

- ☑️ **Require a pull request before merging**
  → Không ai merge thẳng vào master được nữa, kể cả bạn

- ☑️ **Require status checks to pass before merging**
  → Rồi tìm và chọn các check sau (chúng chỉ hiện ra sau lần chạy CI đầu tiên,
    nên nếu chưa thấy thì push một lần rồi quay lại):
  - `Backend - typecheck, test & build`
  - `Frontend - lint & build`
  - `Mobile - lint, typecheck & test`
  - `CodeQL - quet lo hong trong code`
  - `Gitleaks - tim secret bi commit nham`

- ☑️ **Require branches to be up to date before merging**
  → Bắt buộc cập nhật nhánh trước khi merge, tránh xung đột ngầm

- ☑️ **Require conversation resolution before merging**
  → Mọi góp ý trong PR phải được xử lý xong

Nhấn **Create**.

> ⚠️ **Không tích** "Include administrators" nếu bạn làm một mình — khi có sự cố khẩn
> cấp bạn vẫn cần đường thoát. Nhưng nếu sau này có thêm người, hãy tích vào.

---

## 2. Bật quét bảo mật

Vào **Settings** → **Code security and analysis**, bật:

- ☑️ **Dependency graph** — GitHub đọc `package.json` để biết bạn dùng thư viện gì
- ☑️ **Dependabot alerts** — cảnh báo khi thư viện có lỗ hổng
- ☑️ **Dependabot security updates** — tự tạo PR vá lỗ hổng
- ☑️ **Secret scanning** — cảnh báo nếu API key bị commit nhầm
- ☑️ **Push protection** — chặn ngay lúc push nếu phát hiện secret

File `.github/dependabot.yml` trong repo lo phần cập nhật thư viện định kỳ hàng tuần.

---

## 3. Cài `gh` để S7 tạo Pull Request được

```bash
brew install gh
gh auth login
```

Chọn: GitHub.com → HTTPS → Login with a web browser.

Kiểm tra đã xong chưa:
```bash
gh auth status
```

---

## Sau khi thiết lập xong, quy trình thay đổi thế nào

**Trước:**
```
S7 → git merge vào master tại máy → push
     (CI có đỏ cũng không ai chặn)
```

**Sau:**
```
S7 → push nhánh → gh pr create → CI + Security chạy
   → CI xanh hết → hỏi bạn → gh pr merge
     (CI đỏ thì GitHub CHẶN, không merge được)
```

---

## Đọc Pull Request của Dependabot thế nào

Hàng tuần thứ Hai, Dependabot sẽ tự tạo PR nâng version thư viện.

| Nhãn PR | Nên làm gì |
|---|---|
| `security` | **Ưu tiên merge sớm** — đang vá lỗ hổng thật |
| Nâng version thường | Chờ CI xanh rồi merge, không vội |
| CI đỏ sau khi nâng | Đóng PR lại, nhờ S1 xử lý riêng như một task |

Bạn không cần hiểu nội dung thay đổi — chỉ cần nhìn CI xanh hay đỏ.
