# Hutton Brand System

SITE PULSE is styled on-brand with Hutton (source: hutton.build). Brand pulled
from the logo SVG (a vibrant gradient over a near-black wordmark) and site CSS.

## Colors (`app/globals.css`)
Brand palette comes from the logo gradient:
- `--color-brand-blue: #00b3ff`
- `--color-brand-purple: #a37df0`
- `--color-brand-magenta: #ff008c`

Dark base (matches the near-black wordmark):
- `--color-ink: #14161b` · `--color-ink-soft: #1f242e` · `--color-ink-line: #2b313c`

Signature gradient: `.brand-gradient` (blue → purple → magenta), used sparingly on
the logo mark, the live pulse dot, and the active-nav accent. `.brand-text-gradient`
for gradient text.

## Team colors map to the brand
Real Estate = brand-blue · Development = brand-purple · Construction = brand-magenta
(`lib/teams.ts`). Health stays semantic: on-track emerald / at-risk amber / blocked
rose. Progress bars + focus rings use brand-blue.

## Typography
- Headings: **Barlow Condensed** (closest free match to Hutton's Helvetica Neue
  Condensed Bold) — bold, UPPERCASE, tracking-wide → Tailwind `font-display` + `uppercase`.
- Body: **Open Sans** (Hutton's actual body font).
- Both loaded via `next/font/google` in `app/layout.tsx` (vars `--font-barlow`, `--font-open-sans`).

## ⚠️ Tailwind v4 gotcha
Brand color tokens are declared in a **non-inline `@theme {}`** block so they're
emitted as real `:root` CSS variables. Custom classes like `.brand-gradient` read
`var(--color-brand-*)`, which **breaks under `@theme inline`** (inline doesn't emit
the vars). Fonts/background stay in a separate `@theme inline {}` block.

## Tone
Bold, industrial, energetic ("We Know Dirt", "Think Big and Do Big"). Crisp,
architectural UI: tight radii (`rounded-lg`), hairline dividers, strong contrast.

## If Hutton provides an official brand kit
Swap in exact licensed fonts, precise hex values, and logo files. The current
fonts/colors are close free approximations sampled from the public site.
