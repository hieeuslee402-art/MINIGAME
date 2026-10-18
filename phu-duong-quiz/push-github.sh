#!/usr/bin/env bash
# =============================================================================
# push-github.sh — đưa dự án lên GitHub chỉ với 1 lệnh.
#
# Cách dùng:
#   ./push-github.sh https://github.com/<tài-khoản>/<tên-repo>.git
#
# Yêu cầu:
#   • Đã tạo repo TRỐNG trên GitHub (không tick "Add a README").
#   • Máy đã đăng nhập GitHub (Personal Access Token hoặc SSH).
#
# Sau khi push, vào repo → Settings → Pages → Source: "GitHub Actions"
# (workflow trong .github/workflows/deploy.yml sẽ tự xuất bản site).
# =============================================================================
set -euo pipefail

REMOTE_URL="${1:-}"

if [[ -z "$REMOTE_URL" ]]; then
  echo "Thiếu đường dẫn repo."
  echo "Ví dụ: ./push-github.sh https://github.com/ten-tai-khoan/mini-game-phu-duong.git"
  exit 1
fi

cd "$(dirname "$0")"

if [[ ! -d .git ]]; then
  git init
  git checkout -b main
fi

git branch -M main

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

echo "→ Đang push lên: $REMOTE_URL"
git add -A
git diff --cached --quiet || git commit -m "Cập nhật mini game phú dưỡng"
git push -u origin main

echo
echo "✔ Đã push xong."
echo "  Bật GitHub Pages: Settings → Pages → Source: GitHub Actions"
echo "  Sau ~1 phút, web sẽ chạy tại: https://<tài-khoản>.github.io/<tên-repo>/"
