#!/bin/bash
# Script khởi động session theo số
# Cách dùng: ./workflow/start-session.sh <số>
# Ví dụ: ./workflow/start-session.sh 2

SESSION=$1
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "$SESSION" ]; then
  echo "❌ Thiếu số session. Ví dụ: ./workflow/start-session.sh 2"
  exit 1
fi

ROLE_FILES=(
  ""
  "session-1-planner.md"
  "session-2-coder.md"
  "session-3-reviewer.md"
  "session-4-writer.md"
  "session-5-tester.md"
  "session-6-explainer.md"
  "session-7-deployer.md"
)

ROLE_NAMES=(
  ""
  "S1-Planner"
  "S2-Coder"
  "S3-Reviewer"
  "S4-Writer"
  "S5-Tester"
  "S6-Explainer"
  "S7-Deployer"
)

if [ "$SESSION" -lt 1 ] || [ "$SESSION" -gt 7 ]; then
  echo "❌ Session phải từ 1 đến 7"
  exit 1
fi

ROLE_FILE="${ROLE_FILES[$SESSION]}"
ROLE_NAME="${ROLE_NAMES[$SESSION]}"
ROLE_PATH="$PROJECT_DIR/workflow/roles/$ROLE_FILE"

if [ ! -f "$ROLE_PATH" ]; then
  echo "❌ Không tìm thấy file role: $ROLE_PATH"
  exit 1
fi

echo "🚀 Khởi động Session $SESSION: $ROLE_NAME"
echo "📁 Project: $PROJECT_DIR"
echo ""

# Đổi tên tab terminal (nếu dùng iTerm2 hoặc Terminal.app)
echo -ne "\033]0;QuizzGame | $ROLE_NAME\007"

# Tìm đường dẫn claude (hỗ trợ cả cài qua app lẫn npm/brew)
CLAUDE_BIN=""
for candidate in \
  "/Users/quangnd512/Library/Application Support/Claude/claude-code/2.1.165/claude.app/Contents/MacOS/claude" \
  "/usr/local/bin/claude" \
  "/opt/homebrew/bin/claude" \
  "$HOME/.local/bin/claude"
do
  if command -v "$candidate" &>/dev/null 2>&1 || [ -x "$candidate" ]; then
    CLAUDE_BIN="$candidate"
    break
  fi
done

if [ -z "$CLAUDE_BIN" ]; then
  echo "❌ Không tìm thấy lệnh claude."
  echo "   Hãy mở thủ công: cd $PROJECT_DIR && claude"
  exit 1
fi

echo "✅ Dùng claude tại: $CLAUDE_BIN"
echo ""

# Đi vào thư mục project và khởi động claude với role
cd "$PROJECT_DIR"
"$CLAUDE_BIN" "$(cat "$ROLE_PATH")

---
Bạn đang là **$ROLE_NAME** trong dự án QuizzGame tại: $PROJECT_DIR
Hãy bắt đầu theo đúng quy trình trong vai trò của bạn."
