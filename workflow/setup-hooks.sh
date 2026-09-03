#!/usr/bin/env bash
# Cai dat git hook cho du an — chay MOT LAN duy nhat sau khi clone repo.
#
# Vi sao can: git hook nam trong .git/hooks/ va KHONG duoc commit len GitHub,
# nen moi may phai tu cai. Lenh duoi tro git sang thu muc .githooks/ (co commit)
# de hook dung chung cho ca nhom, khong phai copy tay.

set -e
cd "$(dirname "$0")/.."

git config core.hooksPath .githooks
chmod +x .githooks/*

echo "✅ Da cai git hook."
echo ""
echo "Tu gio moi lan 'git commit', may se tu kiem tra typecheck/lint cua phan ban vua sua."
echo "Neu co loi -> commit bi chan lai, do bi day code hong len GitHub."
echo ""
echo "Bo qua trong truong hop khan cap:  git commit --no-verify"
echo "Go bo hook:                        git config --unset core.hooksPath"
