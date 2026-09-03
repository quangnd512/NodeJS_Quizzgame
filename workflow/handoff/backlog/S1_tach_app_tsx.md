[BACKLOG — NỢ KỸ THUẬT, ưu tiên CAO]

# Tách `frontend/src/App.tsx` (7.018 dòng)

## Vấn đề
Toàn bộ giao diện web nằm trong MỘT file 7.018 dòng: đăng nhập, ôn tập, thi đấu,
bảng xếp hạng, hồ sơ, quản trị — tất cả trong một component.

## Hệ quả đang gánh
- **Không viết được test**: frontend có 5 file nguồn / 1 file test. Không phải lười —
  là không tách được phần nào ra để test riêng
- **S3 review kém hiệu quả**: phải đọc 7.000 dòng để review một thay đổi nhỏ,
  dễ bỏ sót tác động chéo
- **Sửa một chỗ dễ hỏng chỗ khác**: mọi state nằm chung một scope

## Đề xuất cách tách
Chia theo **màn hình**, mỗi vòng S1→S8 tách 2-3 màn hình (KHÔNG tách một lần):

```
frontend/src/
  screens/     LoginScreen, OnboardingScreen, ProfileScreen,
               PracticeScreen, ExamScreen, BattleScreen,
               LeaderboardScreen, AdminScreen
  components/  phần dùng chung (nút, thẻ, modal...)
  hooks/       logic tái sử dụng (useAuth, useSocket...)
  lib/         đã có sẵn — api.ts, battleSocket.ts, firebase.ts
```

## Ràng buộc bắt buộc
- **Mỗi vòng tách xong phải viết test cho phần vừa tách** — nếu không thì chỉ đổi chỗ
  vấn đề chứ không giải quyết
- **Không đổi hành vi** trong lúc tách. Tách và thêm tính năng là hai việc riêng,
  gộp lại sẽ không biết lỗi đến từ đâu
- S5 phải test kỹ regression sau mỗi vòng — đây là thay đổi rủi ro cao

## Khi nào làm
Nên xen kẽ giữa các tính năng mới, đừng dồn. Ví dụ: một vòng tính năng mới,
một vòng tách 2-3 màn hình.

📄 Nguồn: S3 phát hiện qua tiêu chí review #9 (sức khoẻ kiến trúc), 2026-09-03
