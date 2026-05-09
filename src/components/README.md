# components/

Reusable React UI components shared across multiple pages.

```
components/
├── ui/             ← low-level primitives (Button, Input, Modal, Badge…)
├── layout/         ← Navbar, Sidebar, Footer, PageShell
├── forms/          ← form components shared across modules
└── shared/         ← cards, tables, loading spinners, empty states
```

Rules:
- No page-level business logic here — keep components generic.
- Import from `@/components/...` using the tsconfig path alias.
- Name files in PascalCase matching the exported component (e.g. `TaskCard.tsx`).
