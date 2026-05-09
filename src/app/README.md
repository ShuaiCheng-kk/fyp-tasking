# app/

Next.js App Router pages and layouts.

Each folder here becomes a URL route.

```
app/
├── layout.tsx          ← root HTML shell, fonts, global providers
├── page.tsx            ← home page  /
├── globals.css         ← global Tailwind base styles
│
├── (auth)/             ← login / register pages  (route group, no URL prefix)
├── dashboard/          ← /dashboard
├── users/              ← /users  (User Management module)
├── recruitment/        ← /recruitment
├── attendance/         ← /attendance
├── notifications/      ← /notifications
├── profile/            ← /profile
└── communication/      ← /communication
```

Roles that use these routes: Owner, Manager, Employee, Casual Worker, Guest.
