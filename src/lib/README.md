# lib/

Database clients, API helpers, and shared server-side utilities.

```
lib/
├── supabase.ts         ← Supabase client (server components & API routes)
├── supabase-browser.ts ← Supabase client for client components
├── openai.ts           ← OpenAI / Gemini API wrapper for AI features
├── utils.ts            ← general-purpose helpers (date formatting, etc.)
└── types.ts            ← shared TypeScript types / database row types
```

Import with: `import { supabase } from '@/lib/supabase'`
