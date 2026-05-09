#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  Tasking — one-click dev server (Mac / Linux)
#  Requires: Node.js 18+
# ─────────────────────────────────────────────────────────
set -e

# Check for .env.local
if [ ! -f ".env.local" ]; then
  echo "[!] .env.local not found."
  echo "    Copy .env.example to .env.local and fill in your Supabase keys."
  echo "    e.g.  cp .env.example .env.local"
  exit 1
fi

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "[*] Installing dependencies..."
  npm install
fi

echo "[*] Starting dev server at http://localhost:3000"
npm run dev
