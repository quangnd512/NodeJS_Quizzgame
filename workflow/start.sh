#!/usr/bin/env bash

CLAUDE_BIN="${HOME}/.local/bin/claude"
SESSION=$1

if [ -z "$SESSION" ]; then
  echo "Cách dùng: ./workflow/start.sh <số session>"
  echo ""
  echo "  ./workflow/start.sh 1   → S1-KienTrucSu"
  echo "  ./workflow/start.sh 2   → S2-ThoCode"
  echo "  ./workflow/start.sh 3   → S3-SoatLoi"
  echo "  ./workflow/start.sh 4   → S4-GhiChep"
  echo "  ./workflow/start.sh 5   → S5-ThuNghiem"
  echo "  ./workflow/start.sh 6   → S6-GiangGiai"
  echo "  ./workflow/start.sh 7   → S7-DongGoi"
  echo "  ./workflow/start.sh 8   → S8-GiamSat"
  echo "  ./workflow/start.sh 9   → S9-CoVan"
  exit 1
fi

# Model phù hợp cho từng session:
# sonnet → phân tích, lập kế hoạch, viết code, review, QA, tư vấn
# haiku  → viết docs, test case, giải thích, git/CI (tác vụ đơn giản, tiết kiệm token)
case "$SESSION" in
  1) FILE="workflow/roles/session-1-kien-truc-su.md"; MODEL="claude-sonnet-4-6" ;;
  2) FILE="workflow/roles/session-2-tho-code.md";     MODEL="claude-sonnet-4-6" ;;
  3) FILE="workflow/roles/session-3-soat-loi.md";     MODEL="claude-sonnet-4-6" ;;
  4) FILE="workflow/roles/session-4-ghi-chep.md";     MODEL="claude-haiku-4-5-20251001" ;;
  5) FILE="workflow/roles/session-5-thu-nghiem.md";   MODEL="claude-haiku-4-5-20251001" ;;
  6) FILE="workflow/roles/session-6-giang-giai.md";   MODEL="claude-haiku-4-5-20251001" ;;
  7) FILE="workflow/roles/session-7-dong-goi.md";     MODEL="claude-haiku-4-5-20251001" ;;
  8) FILE="workflow/roles/session-8-giam-sat.md";     MODEL="claude-sonnet-4-6" ;;
  9) FILE="workflow/roles/session-9-co-van.md";       MODEL="claude-sonnet-4-6" ;;
  *)
    echo "Lỗi: session phải từ 1 đến 9"
    exit 1
    ;;
esac

if [ ! -f "$FILE" ]; then
  echo "Lỗi: không tìm thấy file $FILE"
  exit 1
fi

echo "Đang mở S${SESSION} với model $MODEL..."
"$CLAUDE_BIN" --model "$MODEL" --system-prompt "$(cat "$FILE")"
