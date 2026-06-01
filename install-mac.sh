#!/bin/bash
# WebKita Desktop — installer 1-klik untuk Mac
set -e
cd "$(dirname "$0")"

echo "=========================================="
echo "   WebKita Desktop v2 — Installer (Mac)"
echo "=========================================="
echo ""

# 1. Cek Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js belum ada. Menginstal lewat Homebrew..."
  if ! command -v brew >/dev/null 2>&1; then
    echo "Memasang Homebrew dulu (butuh password Mac kamu)..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    [ -d /opt/homebrew/bin ] && eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
  brew install node
else
  echo "✅ Node.js: $(node -v)"
fi

# 2. Instal komponen
echo ""
echo "Memasang komponen app..."
npm install --no-audit --no-fund

# 3. Build UI
if [ ! -f ui/dist/index.html ]; then
  echo "Menyiapkan tampilan..."
  cd ui && npm install --no-audit --no-fund && npm run build && cd ..
fi

# 4. Jalankan
echo ""
echo "✅ Membuka WebKita..."
npm start
