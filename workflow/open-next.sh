#!/bin/bash
# Tự động mở tab terminal mới và khởi động session tiếp theo
# Cách dùng: ./workflow/open-next.sh <số_session_tiếp_theo>
# Ví dụ: ./workflow/open-next.sh 3  → mở tab mới chạy Session 3

NEXT=$1
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$PROJECT_DIR/workflow/start-session.sh"
CMD="cd '$PROJECT_DIR' && '$SCRIPT' $NEXT"

echo "📂 Mở Session $NEXT trong tab mới..."

# Thử iTerm2 trước, nếu không có thì dùng Terminal.app
if osascript -e 'id of application "iTerm2"' &>/dev/null 2>&1; then
  osascript <<EOF
tell application "iTerm2"
  activate
  tell current window
    create tab with default profile
    tell current session
      write text "$CMD"
    end tell
  end tell
end tell
EOF
else
  osascript <<EOF
tell application "Terminal"
  activate
  tell application "System Events" to keystroke "t" using command down
  delay 0.8
  do script "$CMD" in front window
end tell
EOF
fi

echo "✅ Tab Session $NEXT đã được mở!"
