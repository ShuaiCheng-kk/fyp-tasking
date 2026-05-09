# Tasking

Smart task allocation web app for SMEs managing casual workers.

Built with **Next.js 16**, **React 19**, **Supabase** (PostgreSQL + Auth + Storage), and **Tailwind CSS**.
AI features powered by OpenAI / Gemini API.

---

## Roles

| Role | Description |
|------|-------------|
| Owner | Full system access, billing, settings |
| Manager | Create tasks, manage shifts, view reports |
| Employee | View assigned tasks, clock in/out |
| Casual Worker | Accept/decline tasks, track earnings |
| Guest User | Read-only preview access |

## Modules

1. **User Management** — accounts, roles, permissions
2. **Recruitment** — job posts, applications, onboarding
3. **Attendance** — clock-in/out, timesheets, leave
4. **Notification** — push alerts, email, in-app messages
5. **Profile & Access** — personal info, role switching
6. **Communication** — team chat, announcements

---

## Quick Start

### Windows
```bat
start.bat
```

### Mac / Linux
```bash
chmod +x start.sh && ./start.sh
```

Both scripts will:
1. Warn you if `.env.local` is missing
2. Run `npm install` if `node_modules` is absent
3. Launch the dev server at http://localhost:3000

---

## First-time Setup

```bash
cp .env.example .env.local   # then edit with your Supabase keys
```

See `.env.example` for all required environment variables.

---

## Project Structure

```
fyp-tasking/
├── src/
│   ├── app/            # pages & routing (Next.js App Router)
│   ├── components/     # reusable UI components
│   └── lib/            # Supabase client, API helpers, types
├── public/             # static assets (images, icons)
├── .env.example        # environment variable template
├── start.bat           # one-click dev server (Windows)
└── start.sh            # one-click dev server (Mac/Linux)
```

Each folder contains a `README.md` with more detail.

---

## Manual Commands

```bash
npm run dev      # development server with hot reload
npm run build    # production build
npm run start    # serve production build
npm run lint     # ESLint check
```
