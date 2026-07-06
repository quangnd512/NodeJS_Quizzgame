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

case "$SESSION" in
  1) FILE="workflow/roles/session-1-kien-truc-su.md" ;;
  2) FILE="workflow/roles/session-2-tho-code.md" ;;
  3) FILE="workflow/roles/session-3-soat-loi.md" ;;
  4) FILE="workflow/roles/session-4-ghi-chep.md" ;;
  5) FILE="workflow/roles/session-5-thu-nghiem.md" ;;
  6) FILE="workflow/roles/session-6-giang-giai.md" ;;
  7) FILE="workflow/roles/session-7-dong-goi.md" ;;
  8) FILE="workflow/roles/session-8-giam-sat.md" ;;
  9) FILE="workflow/roles/session-9-co-van.md" ;;
  *)
    echo "Lỗi: session phải từ 1 đến 9"
    exit 1
    ;;
esac

if [ ! -f "$FILE" ]; then
  echo "Lỗi: không tìm thấy file $FILE"
  exit 1
fi

echo "Đang mở S${SESSION}..."
"$CLAUDE_BIN" --system-prompt "$(cat "$FILE")"
