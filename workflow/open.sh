#!/usr/bin/env bash
# Mở session N trong một tab Terminal mới
# Dùng: ./workflow/open.sh <số session>
# Ví dụ: ./workflow/open.sh 8

SESSION=$1
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "$SESSION" ]; then
  echo "Cách dùng: ./workflow/open.sh <số session>"
  exit 1
fi

case "$SESSION" in
  1) LABEL="S1-KienTrucSu" ;;
  2) LABEL="S2-ThoCode" ;;
  3) LABEL="S3-SoatLoi" ;;
  4) LABEL="S4-GhiChep" ;;
  5) LABEL="S5-ThuNghiem" ;;
  6) LABEL="S6-GiangGiai" ;;
  7) LABEL="S7-DongGoi" ;;
  8) LABEL="S8-GiamSat" ;;
  9) LABEL="S9-CoVan" ;;
  *)
    echo "Lỗi: session phải từ 1 đến 9"
    exit 1
    ;;
esac

CMD="cd \"$PROJECT_DIR\" && ./workflow/start.sh $SESSION"

# Thử mở tab mới trong Terminal.app (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  osascript \
    -e 'tell application "Terminal"' \
    -e '  activate' \
    -e "  do script \"$CMD\"" \
    -e 'end tell'
  echo "✅ Đã mở tab mới cho $LABEL"
else
  # Linux: thử mở gnome-terminal hoặc xterm
  if command -v gnome-terminal &>/dev/null; then
    gnome-terminal -- bash -c "$CMD; exec bash" &
  elif command -v xterm &>/dev/null; then
    xterm -e "$CMD" &
  else
    echo "⚠️  Không thể tự mở terminal. Chạy thủ công: ./workflow/start.sh $SESSION"
  fi
fi
