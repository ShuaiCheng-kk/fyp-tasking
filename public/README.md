# public/

Static assets served directly at the root URL (no build step).

```
public/
├── images/         ← logos, hero images, team photos
├── icons/          ← app icons, favicons (non-SVG-in-code)
└── fonts/          ← self-hosted fonts (if not using next/font)
```

Access in code as `/images/logo.png` — no import needed.
Files here are never processed by webpack/Next.js.
