@echo off
REM ─────────────────────────────────────────────────────────
REM  Tasking — one-click dev server (Windows)
REM  Requires: Node.js 18+
REM ─────────────────────────────────────────────────────────

REM Check for .env.local
if not exist ".env.local" (
    echo [!] .env.local not found.
    echo     Copy .env.example to .env.local and fill in your Supabase keys.
    echo     e.g.  copy .env.example .env.local
    pause
    exit /b 1
)

REM Install dependencies if node_modules is missing
if not exist "node_modules" (
    echo [*] Installing dependencies...
    npm install
)

echo [*] Starting dev server at http://localhost:3000
npm run dev
